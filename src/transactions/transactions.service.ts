import { Injectable, Inject, NotFoundException, forwardRef, BadRequestException } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from 'src/db/schema';
import { eq, and, desc, count, gte, sum, or, lte, sql } from 'drizzle-orm';
import { UserAccountService } from 'src/user-account/user-account.service';
import { CategoriesService } from 'src/categories/categories.service';
import { BudgetService } from 'src/budget/budget.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { RecurringTransactionService } from 'src/lib/bullmq/recurring-transaction/recurring-transaction.service';
import dayjs from 'dayjs';
import { convertFrequencyToDayjsPeriod } from 'src/common/convert/convert-frequency';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(UserAccountService) private readonly userAccountService: UserAccountService,
    @Inject(CategoriesService) private readonly categoriesService: CategoriesService,
    @Inject(forwardRef(() => BudgetService)) private readonly budgetService: BudgetService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Inject(RecurringTransactionService) private readonly recurringTransactionService: RecurringTransactionService,
  ) { }

  /**
   * Creates a new transaction for a given user.
   * 
   * This process includes:
   * - Retrieving the associated user account
   * - Validating the transaction category
   * - Inserting the transaction into the database
   * - Updating the actual amount of the related category's budget
   * - Updating the total amount of the user's account
   * - Handling recurring transactions if applicable (scheduling and storing related info)
   * 
   * All operations are wrapped in a single SQL transaction to ensure data consistency.
   * 
   * @param {CreateTransactionDto} createTransactionDto - The data for the transaction to be created, including amount, date, category, etc.
   * @param {string} userId - The ID of the user creating the transaction
   * @returns {Promise<schema.Transaction>} The newly created transaction
   * 
   * @throws {NotFoundException} If the user account is not found
   * @throws {Error} If an error occurs during the database transaction
   */
  async create(createTransactionDto: CreateTransactionDto, userId: string): Promise<{ transaction: schema.Transaction, totalUserAccountAmount: number }> {
    // Get the user account
    const userAccount = await this.userAccountService.findOneByUserId(userId);
    if (!userAccount) {
      throw new NotFoundException('User account not found');
    }

    return this.db.transaction(async (tx) => {
      // validate the transaction category
      const category = await this.categoriesService.findOne(createTransactionDto.categoryId, userId);

      // create the transaction
      const result: schema.Transaction[] = await tx.insert(schema.transactions).values({
        ...createTransactionDto,
        date: new Date(createTransactionDto.date),
        recurringStartDate: createTransactionDto.date ? new Date(createTransactionDto.date) : null,
        recurringEndDate: createTransactionDto.recurringEndDate ? new Date(createTransactionDto.recurringEndDate) : null,
        userAccountId: userAccount.id,
        createdAt: new Date(),
      }).returning();

      // Update the actual amount of the category budget
      await this.budgetService.updateActualAmount(
        createTransactionDto.categoryId,
        userId,
        createTransactionDto.transactionType,
        createTransactionDto.amount,
        createTransactionDto.date,
      );

      // update the total amount of the user account
      let userAccountChange = await this.userAccountService.updateTotalAmount(userId, createTransactionDto.transactionType, createTransactionDto.amount);

      // Verify if the transaction is recurring
      if (createTransactionDto.isRecurring) {

        // Calc if exists transaction between start date and now, and add it
        let adjustedDate = dayjs(result[0].date);
        let lastTransaction = result[0];

        const { value: frequencyValue, unit: frequencyUnit } = convertFrequencyToDayjsPeriod(result[0].recurringFrequency || 'monthly');

        while (adjustedDate.add(frequencyValue, frequencyUnit).isBefore(dayjs())) {
          adjustedDate = adjustedDate.add(frequencyValue, frequencyUnit);

          // If the adjusted date is before the current date, we need to create a new transaction
          const { id, ...rest } = lastTransaction;
          const newTransaction: schema.NewTransaction = {
            ...rest,
            description: lastTransaction.description ? (/\(Child\)\s*$/i.test(lastTransaction.description) ? lastTransaction.description : `${lastTransaction.description} (Child)`) : 'Recurring Transaction',
            date: adjustedDate.toDate(),
            recurringStartDate: createTransactionDto.date ? new Date(createTransactionDto.date) : null,
            recurringEndDate: createTransactionDto.recurringEndDate ? new Date(createTransactionDto.recurringEndDate) : null,
            recurringParentId: result[0].id, // Link to the parent transaction
            createdAt: new Date(),
          };

          // Insert the new transaction
          const newResult: schema.Transaction[] = await tx.insert(schema.transactions).values(newTransaction).returning();
          lastTransaction = newResult[0];

          // Verify if the new transaction is in the actual budget period and update it
          await this.budgetService.updateActualAmount(
            newTransaction.categoryId,
            userId,
            newResult[0].transactionType,
            newResult[0].amount,
            newResult[0].date,
          );

          // Update the total amount of the user account
          const newTotalAmount = await this.userAccountService.updateTotalAmount(userId, newResult[0].transactionType, newResult[0].amount);
          userAccountChange = newTotalAmount;
        }

        const recurringResult = { ...lastTransaction, lastTransactionDate: adjustedDate.toDate(), lastTransactionId: lastTransaction.id };

        // Schedule the recurring transaction
        await this.recurringTransactionService.scheduleRecurringTransaction(recurringResult, userId, recurringResult.id === result[0].id);

        // Store the recurring transaction info
        await tx.insert(schema.transactionRecurringInfo).values({
          transactionParentId: result[0].id,
          lastTransactionDate: recurringResult.lastTransactionDate,
          lastTransactionId: recurringResult.lastTransactionId,
          createdAt: new Date(),
        });
      }

      // return the transaction
      return {
        transaction: result[0],
        totalUserAccountAmount: userAccountChange.amount,
      };
    })
  }

  /**
   * Creates a child transaction based on a recurring parent transaction.
   * 
   * This process includes:
   * - Retrieving the parent transaction and validating its existence
   * - Validating the category associated with the parent transaction
   * - Creating a new child transaction with updated description and current date
   * - Updating the recurring transaction metadata (last transaction date and ID)
   * - Updating the actual amount of the corresponding budget category
   * - Updating the total amount of the user's account
   * - Sending a notification about the creation of the child transaction
   * 
   * All operations are executed within a single SQL transaction to maintain data consistency.
   * 
   * @param {string} transactionParentId - The ID of the parent transaction from which the child is derived
   * @param {string} userId - The ID of the user for whom the child transaction is created
   * @returns {Promise<schema.Transaction>} The newly created child transaction
   * 
   * @throws {NotFoundException} If the parent transaction is not found
   * @throws {Error} If an error occurs during the database transaction
   */
  async createChildTransactions(transactionParentId: string, userId: string): Promise<schema.Transaction> {
    // Get the parent transaction
    const parentTransaction = await this.findOne(transactionParentId, userId);
    if (!parentTransaction) {
      throw new NotFoundException('Parent transaction not found');
    }

    return this.db.transaction(async (tx) => {
      await this.categoriesService.findOne(parentTransaction.categoryId, userId);

      // Update the description of the child transaction
      const description = parentTransaction.description ? `${parentTransaction.description} (Child)` : 'Child Transaction';

      // Create the child transaction
      const childTransaction = await tx.insert(schema.transactions).values({
        ...parentTransaction,
        id: undefined, // Generate a new ID
        description: description,
        recurringParentId: parentTransaction.id, // Set the parent ID
        date: new Date(),
        createdAt: new Date(),
      }).returning();

      // Update the last transaction date and ID in the recurring info
      await tx.update(schema.transactionRecurringInfo)
        .set({
          lastTransactionDate: childTransaction[0].date,
          lastTransactionId: childTransaction[0].id,
          updatedAt: new Date(),
        })
        .where(eq(schema.transactionRecurringInfo.transactionParentId, parentTransaction.id));

      // Update the actual amount of the category budget
      await this.budgetService.updateActualAmount(
        parentTransaction.categoryId,
        userId,
        parentTransaction.transactionType,
        parentTransaction.amount,
        childTransaction[0].date,
      );

      // Update the total amount of the user account
      await this.userAccountService.updateTotalAmount(userId, parentTransaction.transactionType, parentTransaction.amount);

      // Send a notification for the child transaction
      await this.notificationsService.create({
        message: `Child transaction created for ${description}`,
        type: 'transaction',
        level: 'info',
      }, userId);

      return childTransaction[0];
    });
  }

  /**
   * Get all transactions for a user with pagination
   * @param userId
   * @param limit
   * @param page
   * @returns 
   */
  async findAll(userId: string, limit: number = 10, page: number = 0): Promise<{ data: schema.Transaction[], limit: number, page: number, total: number, lastPage: number }> {
    // Get the user account
    const userAccount = await this.userAccountService.findOneByUserId(userId);

    if (!userAccount) {
      throw new NotFoundException('User account not found');
    }

    const result = await this.db
      .select({
        transaction: schema.transactions,
        category: schema.categories
      })
      .from(schema.transactions)
      .leftJoin(schema.categories, eq(schema.categories.id, schema.transactions.categoryId))
      .where(eq(schema.transactions.userAccountId, userAccount.id))
      .limit(limit)
      .offset(page * limit)
      .orderBy(desc(schema.transactions.date));

    const data = result.map(row => ({
      ...row.transaction,
      category: row.category ?? null
    }));

    // Get the total count of transactions for the user
    // TODO : Make this more efficient by caching the count
    const totalCount = await this.db
      .select({ count: count() })
      .from(schema.transactions)
      .where(eq(schema.transactions.userAccountId, userAccount.id));

    return {
      data,
      limit: limit,
      page: page,
      total: totalCount[0].count,
      lastPage: Math.ceil(totalCount[0].count / limit) - 1
    }
  }

  /**
   * Get all transactions by category id
   * @param categoryId 
   * @param userId 
   * @param startDate 
   * @returns 
   */
  async findAllByCategoryId(categoryId: string, userId: string, startDate?: Date) {
    const userAccount = await this.userAccountService.findOneByUserId(userId);

    if (!userAccount) {
      throw new NotFoundException('User account not found');
    }

    const startDateCondition = startDate
      ? and(gte(schema.transactions.date, startDate), eq(schema.transactions.userAccountId, userAccount.id), eq(schema.transactions.categoryId, categoryId))
      : and(eq(schema.transactions.userAccountId, userAccount.id), eq(schema.transactions.categoryId, categoryId));

    return await this.db
      .select()
      .from(schema.transactions)
      .where(startDateCondition)
  }

  /**
   * Get a transaction by id
   * @param id 
   * @param userId
   * @returns 
   */
  async findOne(id: string, userId: string): Promise<schema.Transaction> {
    // Get the user account
    const userAccount = await this.userAccountService.findOneByUserId(userId);
    if (!userAccount) {
      throw new NotFoundException('User account not found');
    }

    const result = await this.db
      .select({
        transaction: schema.transactions,
        category: schema.categories
      })
      .from(schema.transactions)
      .leftJoin(schema.categories, eq(schema.categories.id, schema.transactions.categoryId))
      .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userAccountId, userAccount.id)))

    const data = result.map(row => ({
      ...row.transaction,
      category: row.category ?? null
    }));

    if (result.length === 0) {
      throw new NotFoundException('Transaction not found');
    }

    return data[0];
  }

  /**
   * Update a transaction
   * @param id 
   * @param userId
   * @param updateTransactionDto 
   * @param updateNextChilds
   * @returns 
   */
  async update(id: string, updateTransactionDto: UpdateTransactionDto, userId: string, updateNextChilds: boolean = false): Promise<schema.Transaction> {
    // Get the user account
    const userAccount = await this.userAccountService.findOneByUserId(userId);
    if (!userAccount) {
      throw new NotFoundException('User account not found');
    }

    // Get the transaction
    const transaction = await this.findOne(id, userId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // If change the category, verify it
    if (updateTransactionDto.categoryId) {
      const category = await this.categoriesService.findOne(updateTransactionDto.categoryId, userId);
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    // If the transaction is a child of a recurring transaction, we cannot update it to be recurring or recurring related fields
    if (transaction.recurringParentId && (updateTransactionDto.isRecurring || updateTransactionDto.recurringFrequency || updateTransactionDto.recurringEndDate)) {
      throw new BadRequestException('Cannot add a recurrency on a child transaction !');
    }

    // If the transaction is a child of a recurring transaction, we cannot change only his category
    if (transaction.recurringParentId && updateTransactionDto.categoryId && (updateTransactionDto.categoryId !== transaction.categoryId)) {
      throw new BadRequestException('Cannot change the category of a child transaction of a recurring transaction ! If you want to change the category, please update the category of the parent transaction.');
    }

    // If the transaction is a child of a recurring transaction, we cannot change the transaction type (In Future, we can allow this)
    if (transaction.recurringParentId && updateTransactionDto.transactionType && (updateTransactionDto.transactionType !== transaction.transactionType)) {
      throw new BadRequestException('Cannot change the transaction type of a child transaction of a recurring transaction ! If you want to change the transaction type, please stop the recurring transaction first.');
    }

    return await this.db.transaction(async (tx) => {
      // update the transaction
      const result = await tx
        .update(schema.transactions)
        .set({
          amount: updateTransactionDto.amount ?? transaction.amount,
          transactionType: updateTransactionDto.transactionType ?? transaction.transactionType,
          description: updateTransactionDto.description ?? transaction.description,
          categoryId: updateTransactionDto.categoryId ?? transaction.categoryId,
          date: updateTransactionDto.date ? new Date(updateTransactionDto.date) : transaction.date,
          updatedAt: new Date(),

          isRecurring: updateTransactionDto.isRecurring ?? transaction.isRecurring,
          recurringFrequency: updateTransactionDto.recurringFrequency ?? transaction.recurringFrequency,
        })
        .where(eq(schema.transactions.id, id))
        .returning();

      // Is update to recurring
      let userAccountChange;
      if (updateTransactionDto.isRecurring && !transaction.isRecurring) {
        if (!updateTransactionDto.recurringFrequency) {
          throw new BadRequestException('Recurring frequency is required to create a recurring transaction');
        }

        // Calc if exists transaction between start date and now, and add it
        let adjustedDate = dayjs(result[0].date);
        let lastTransaction = result[0];

        const { value: frequencyValue, unit: frequencyUnit } = convertFrequencyToDayjsPeriod(result[0].recurringFrequency || 'monthly');

        while (adjustedDate.add(frequencyValue, frequencyUnit).isBefore(dayjs())) {
          adjustedDate = adjustedDate.add(frequencyValue, frequencyUnit);

          // If the adjusted date is before the current date, we need to create a new transaction
          const { id, ...rest } = lastTransaction;
          const newTransaction: schema.NewTransaction = {
            ...rest,
            description: lastTransaction.description ? (/\(Child\)\s*$/i.test(lastTransaction.description) ? lastTransaction.description : `${lastTransaction.description} (Child)`) : 'Recurring Transaction',
            date: adjustedDate.toDate(),
            recurringStartDate: new Date(result[0].date) ,
            recurringEndDate: result[0].recurringEndDate,
            recurringParentId: result[0].id, // Link to the parent transaction
            createdAt: new Date(),
          };

          // Insert the new transaction
          const newResult: schema.Transaction[] = await tx.insert(schema.transactions).values(newTransaction).returning();
          lastTransaction = newResult[0];

          // Verify if the new transaction is in the actual budget period and update it
          await this.budgetService.updateActualAmount(
            newTransaction.categoryId,
            userId,
            newResult[0].transactionType,
            newResult[0].amount,
            newResult[0].date,
            tx
          );

          // Update the total amount of the user account
          const newTotalAmount = await this.userAccountService.updateTotalAmount(userId, newResult[0].transactionType, newResult[0].amount);
          userAccountChange = newTotalAmount;
        }

        const recurringResult = { ...lastTransaction, lastTransactionDate: adjustedDate.toDate(), lastTransactionId: lastTransaction.id };

        // Schedule the recurring transaction
        await this.recurringTransactionService.scheduleRecurringTransaction(recurringResult, userId, recurringResult.id === result[0].id);

        // Store the recurring transaction info
        await tx.insert(schema.transactionRecurringInfo).values({
          transactionParentId: result[0].id,
          lastTransactionDate: recurringResult.lastTransactionDate,
          lastTransactionId: recurringResult.lastTransactionId,
          createdAt: new Date(),
        });


      }

      // Get the amount diff and transaction type
      const amountDiff = updateTransactionDto.amount ? updateTransactionDto.amount - transaction.amount : 0;
      let totalAmountDiff = amountDiff;
      const amountType = amountDiff > 0 ? 2 : 1;

      // Verify and update the budget
      if (updateTransactionDto.amount) { // If if the same category       
        if (amountDiff !== 0) {

          // If it's a parent transaction of a recurring transaction, and updateNextChilds is true, we need to update all child transactions
          if (transaction.isRecurring && !transaction.recurringParentId && updateNextChilds) {
            // Update all child transactions of the parent transaction with the same initial amount
            const data = await tx
              .update(schema.transactions)
              .set({
                amount: result[0].amount,
              })
              .where(
                and(
                  eq(schema.transactions.recurringParentId, transaction.id),
                  eq(schema.transactions.amount, transaction.amount)
                )
              ).returning();

            // add all new diff in the total amountDiff
            totalAmountDiff += amountDiff * data.length;

            const budget = await tx
              .select()
              .from(schema.budgets)
              .where(eq(schema.budgets.categoryId, result[0].categoryId))
              .then((result) => result[0]);

            if (budget) {
              // If a budget exist with the new category, we find all child transactions of the parent transaction in the actual budget period
              const { value, unit } = convertFrequencyToDayjsPeriod(budget.recurringFrequency || 'monthly');
              const startDateBudgetPeriod = dayjs(budget.lastResetDate).toDate();
              const endDateBudgetPeriod = dayjs(budget.lastResetDate).add(value, unit).toDate();

              let totalAmountDiffForThisBudget = 0;
              for (const transaction of data) {
                if (transaction.date >= startDateBudgetPeriod && transaction.date <= endDateBudgetPeriod) {
                  totalAmountDiff += Math.abs(amountDiff);
                }
              }

              await this.budgetService.updateActualAmount(
                updateTransactionDto.categoryId ?? transaction.categoryId,
                userId,
                amountType,
                Math.abs((result[0].date >= startDateBudgetPeriod && result[0].date <= endDateBudgetPeriod) ? amountDiff : 0) + totalAmountDiffForThisBudget,
                dayjs().toDate(),
                tx
              );
            }

          } else {
            await this.budgetService.updateActualAmount(
              updateTransactionDto.categoryId ?? transaction.categoryId,
              userId,
              amountType,
              Math.abs(amountDiff),
              updateTransactionDto.date ?? transaction.date,
              tx
            );
          }
        }
      } else if (updateTransactionDto.categoryId && (updateTransactionDto.categoryId !== transaction.categoryId)) { // If change the category

        // If it's a parent transaction of a recurring transaction, we need to update all of his child transactions
        if (transaction.isRecurring && !transaction.recurringParentId) {
          // Update all child transactions of the parent transaction

          // get the total amount of parent + child transactions for update budget amount in budget period
          const newBudgetCategory = await tx
            .select()
            .from(schema.budgets)
            .where(eq(schema.budgets.categoryId, updateTransactionDto.categoryId))
            .then((result) => result[0]);

          if (newBudgetCategory) {
            // If a budget exist with the new category, we find all child transactions of the parent transaction in the actual budget period
            const { value, unit } = convertFrequencyToDayjsPeriod(newBudgetCategory.recurringFrequency || 'monthly');
            const startDateBudgetPeriod = dayjs(newBudgetCategory.lastResetDate).toDate();
            const endDateBudgetPeriod = dayjs(newBudgetCategory.lastResetDate).add(value, unit).toDate();

            const childTransactions = await tx
              .select({
                sumAmount: sum(schema.transactions.amount),
              })
              .from(schema.transactions)
              .where(
                and(
                  or(
                    eq(schema.transactions.recurringParentId, transaction.id),
                    eq(schema.transactions.id, transaction.id), // Include the parent transaction itself
                  ),
                  gte(schema.transactions.date, startDateBudgetPeriod),
                  lte(schema.transactions.date, endDateBudgetPeriod),
                )
              )
              .then((result) => result[0]);

            // If there are child transactions, we update the budget amount
            if (childTransactions && childTransactions.sumAmount) {
              // Update the actual amount of the old category budget
              await this.budgetService.updateActualAmount(
                transaction.categoryId,
                userId,
                transaction.transactionType,
                -parseInt(childTransactions.sumAmount),
                dayjs().toDate(),
                tx
              );

              // Update the actual amount of the new category budget
              await this.budgetService.updateActualAmount(
                updateTransactionDto.categoryId,
                userId,
                updateTransactionDto.transactionType ?? transaction.transactionType,
                parseInt(childTransactions.sumAmount) ?? 0,
                dayjs().toDate(),
                tx
              );
            }
          }

          await tx
            .update(schema.transactions)
            .set({
              categoryId: updateTransactionDto.categoryId,
              updatedAt: new Date(),
            })
            .where(
              eq(schema.transactions.recurringParentId, transaction.id),
            );

        } else {
          // Update the actual amount of the old category budget
          await this.budgetService.updateActualAmount(
            transaction.categoryId,
            userId,
            transaction.transactionType,
            -transaction.amount,
            transaction.date,
            tx
          );

          // Update the actual amount of the new category budget
          await this.budgetService.updateActualAmount(
            updateTransactionDto.categoryId,
            userId,
            updateTransactionDto.transactionType ?? transaction.transactionType,
            updateTransactionDto.amount ?? 0,
            updateTransactionDto.date ?? transaction.date,
            tx
          );
        }
      }

      // Update the total amount of the user account
      await this.userAccountService.updateTotalAmount(userId, amountType, Math.abs(totalAmountDiff));

      return result[0];
    })
  }

  /**
   * Delete a transaction
   * @param id 
   * @param userId
   * @param removeChildren - If true, remove all child transactions of a recurring transaction
   * @returns 
   */
  async remove(id: string, userId: string, removeChildren: boolean): Promise<{ message: string }> {
    // Get the user account
    const userAccount = await this.userAccountService.findOneByUserId(userId);
    if (!userAccount) {
      throw new NotFoundException('User account not found');
    }
    // Get the transaction
    const transaction = await this.findOne(id, userId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return await this.db.transaction(async (tx) => {

      // If the transaction is recurring, verify if it is a parent or child transaction
      if (transaction.isRecurring) {
        if (transaction.recurringParentId) {
          // If it is a child transaction, verify if it's the last child transaction
          const recurringInfo = await tx
            .select()
            .from(schema.transactionRecurringInfo)
            .where(eq(schema.transactionRecurringInfo.transactionParentId, transaction.recurringParentId))
            .orderBy(desc(schema.transactionRecurringInfo.lastTransactionDate))
            .limit(1)
            .then((result) => result[0]);

          if (recurringInfo && recurringInfo.lastTransactionId === transaction.id) {
            // If it is the last child transaction, we need replace the lastChildId in the transaction info by the previous one
            const previousChild = await tx
              .select()
              .from(schema.transactions)
              .where(eq(schema.transactions.recurringParentId, transaction.recurringParentId))
              .orderBy(desc(schema.transactions.date))
              .limit(2)
              .then((result) => {
                if (result.length < 2) {
                  return null; // No previous child transaction
                }
                return result[1]; // Return the second last transaction
              });

            if (previousChild) {
              await tx
                .update(schema.transactionRecurringInfo)
                .set({ lastTransactionId: previousChild.id })
                .where(eq(schema.transactionRecurringInfo.id, recurringInfo.id));
            } else {
              // If there is no previous child transaction, last transaction is the parent transaction
              await tx
                .update(schema.transactionRecurringInfo)
                .set({ lastTransactionId: transaction.recurringParentId })
                .where(eq(schema.transactionRecurringInfo.id, recurringInfo.id));
            }
          }
        } else {
          // If it is a parent transaction, we need to stop the recurring transaction
          throw new BadRequestException('Cannot delete a parent transaction of a recurring transaction directly. Please stop the recurring transaction first !');
        }
      }

      // If removeChildren is true, we need to remove all child transactions of the recurring transaction
      if (removeChildren && !transaction.recurringParentId) {
        await tx
          .delete(schema.transactions)
          .where(eq(schema.transactions.recurringParentId, id));
        // TODO : Update the total Account Amount and Budget for the user and the budget category
      } else {
        // make the recurringParentId null at child transactions
        await tx
          .update(schema.transactions)
          .set({ recurringParentId: null, isOrphaned: true, updatedAt: new Date() })
          .where(eq(schema.transactions.recurringParentId, id));
      }

      // Delete the transaction
      await tx
        .delete(schema.transactions)
        .where(eq(schema.transactions.id, id))

      // Update the actual amount of the category budget
      await this.budgetService.updateActualAmount(
        transaction.categoryId,
        userId,
        1,
        transaction.amount,
        transaction.date,
      )

      // Update the total amount of the user account
      await this.userAccountService.updateTotalAmount(userId, 1, transaction.amount);

      return { message: 'Transaction removed successfully' };
    })
  }

  /**
   * Stop de recurring transaction
   * @param transactionParentId
   * @param userId
   */
  async stopRecurringTransaction(transactionId: string, userId: string) {
    // Verify if the transaction id provided is the parent or a child transaction
    const transaction = await this.findOne(transactionId, userId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (!transaction.isRecurring) {
      throw new NotFoundException('Transaction is not a recurring transaction');
    }

    if (!transaction.recurringParentId) {
      // If recurringParentId is null, it means this is a parent transaction
      // We need to find list child transactions and cancel them

      return await this.db.transaction(async (tx) => {
        const lastChild = await tx
          .select()
          .from(schema.transactionRecurringInfo)
          .where(eq(schema.transactionRecurringInfo.transactionParentId, transactionId))
          .orderBy(desc(schema.transactionRecurringInfo.lastTransactionDate))
          .limit(1)
          .then((result) => result[0]);

        if (!lastChild) {
          throw new NotFoundException('No child transactions found for this parent transaction');
        }

        await this.recurringTransactionService.cancelRecurringTransaction(lastChild.lastTransactionId);

        // Remove the recurring info from the database
        await tx.delete(schema.transactionRecurringInfo)
          .where(eq(schema.transactionRecurringInfo.transactionParentId, transactionId));

        // Make the parent transaction not recurring
        await tx.update(schema.transactions)
          .set({
            isRecurring: false,
            recurringFrequency: null,
            recurringEndDate: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.transactions.id, transactionId));

        // Make child transactions not recurring
        await tx.update(schema.transactions)
          .set({
            isRecurring: false,
            recurringFrequency: null,
            recurringEndDate: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.transactions.recurringParentId, transactionId));

        return { message: 'Recurring transaction stopped successfully' };
      });
    } else {
      // If recurringParentId is not null, it means this is a child transaction
      // We need to cancel the last child transaction of the parent transaction

      const parentTransaction = await this.findOne(transaction.recurringParentId, userId);

      return await this.db.transaction(async (tx) => {
        if (!parentTransaction) {
          throw new NotFoundException('Parent transaction not found');
        }

        if (!parentTransaction.isRecurring) {
          throw new NotFoundException('Parent transaction is not a recurring transaction');
        }

        const lastChild = await tx
          .select()
          .from(schema.transactionRecurringInfo)
          .where(eq(schema.transactionRecurringInfo.transactionParentId, parentTransaction.id))
          .orderBy(desc(schema.transactionRecurringInfo.lastTransactionDate))
          .limit(1)
          .then((result) => result[0]);

        if (!lastChild) {
          throw new NotFoundException('No child transactions found for this parent transaction');
        }

        await this.recurringTransactionService.cancelRecurringTransaction(lastChild.lastTransactionId);

        // Remove the recurring info from the database
        await tx.delete(schema.transactionRecurringInfo)
          .where(eq(schema.transactionRecurringInfo.transactionParentId, parentTransaction.id));

        // Make the parent transaction not recurring
        await tx.update(schema.transactions)
          .set({
            isRecurring: false,
            recurringFrequency: null,
            recurringEndDate: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.transactions.id, parentTransaction.id));

        // Make the childs transaction not recurring
        await tx.update(schema.transactions)
          .set({
            isRecurring: false,
            recurringFrequency: null,
            recurringEndDate: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.transactions.recurringParentId, parentTransaction.id));

        return { message: 'Recurring transaction stopped successfully' };
      });
    }
  }
}
