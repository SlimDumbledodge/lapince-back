import { Injectable, Inject, NotFoundException, forwardRef } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from 'src/db/schema';
import { eq, and, desc, count, gte } from 'drizzle-orm';
import { UserAccountService } from 'src/user-account/user-account.service';
import { CategoriesService } from 'src/categories/categories.service';
import { BudgetService } from 'src/budget/budget.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { RecurringTransactionService } from 'src/lib/bullmq/recurring-transaction/recurring-transaction.service';

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
        recurringStartDate: createTransactionDto.recurringStartDate ? new Date(createTransactionDto.recurringStartDate) : null,
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
      const userAccountChange = await this.userAccountService.updateTotalAmount(userId, createTransactionDto.transactionType, createTransactionDto.amount);

      // Verify if the transaction is recurring
      if (createTransactionDto.isRecurring) {
        // Schedule the recurring transaction
        await this.recurringTransactionService.scheduleRecurringTransaction(result[0], userId, true);

        // Store the recurring transaction info
        await tx.insert(schema.transactionRecurringInfo).values({
          transactionParentId: result[0].id,
          lastTransactionDate: result[0].date,
          lastTransactionId: result[0].id, // Initially, the last transaction is the same as the parent
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
        reccuringParentId: parentTransaction.id, // Set the parent ID
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
   * @returns 
   */
  async update(id: string, updateTransactionDto: UpdateTransactionDto, userId: string) {
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

    return await this.db.transaction(async (tx) => {
      // update the transaction
      const result = await tx
        .update(schema.transactions)
        .set({
          ...updateTransactionDto,
          date: updateTransactionDto.date ? new Date(updateTransactionDto.date) : transaction.date,
          recurringStartDate: updateTransactionDto.recurringStartDate ? new Date(updateTransactionDto.recurringStartDate) : transaction.recurringStartDate,
          recurringEndDate: updateTransactionDto.recurringEndDate ? new Date(updateTransactionDto.recurringEndDate) : transaction.recurringEndDate,
          updatedAt: new Date(),
        })
        .where(eq(schema.transactions.id, id))
        .returning();

      // Get the amount diff and transaction type
      const amountDiff = updateTransactionDto.amount ? updateTransactionDto.amount - transaction.amount : 0;
      const amountType = amountDiff > 0 ? 2 : 1;

      // Verify and update the budget
      if (updateTransactionDto.amount && (!updateTransactionDto.categoryId || (updateTransactionDto.categoryId === transaction.categoryId))) { // If if the same category       
        if (amountDiff !== 0) {
          await this.budgetService.updateActualAmount(
            updateTransactionDto.categoryId ?? transaction.categoryId,
            userId,
            amountType,
            Math.abs(amountDiff),
            updateTransactionDto.date ?? transaction.date,
          );
        }
      } else if (updateTransactionDto.categoryId && (updateTransactionDto.categoryId !== transaction.categoryId)) { // If change the category
        // Update the actual amount of the old category budget
        await this.budgetService.updateActualAmount(
          transaction.categoryId,
          userId,
          transaction.transactionType,
          -transaction.amount,
          transaction.date,
        );

        // Update the actual amount of the new category budget
        await this.budgetService.updateActualAmount(
          updateTransactionDto.categoryId,
          userId,
          updateTransactionDto.transactionType ?? transaction.transactionType,
          updateTransactionDto.amount ?? 0,
          updateTransactionDto.date ?? transaction.date,
        )
      }

      // Update the total amount of the user account
      await this.userAccountService.updateTotalAmount(userId, amountType, Math.abs(amountDiff));

      // verify if the transaction is recurring
      // TODO : make the recurring system

      return result[0];
    })
  }

  /**
   * Delete a transaction
   * @param id 
   * @param userId
   * @returns 
   */
  async remove(id: string, userId: string): Promise<void> {
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

      // verify if the transaction is recurring
      // TODO : make the recurring system
    })
  }

  /**
   * Stop de recurring transaction
   * @param transactionParentId
   */
  // TODO : Implement this method to stop the recurring transaction
}
