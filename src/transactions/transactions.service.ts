import { Injectable, Inject, NotFoundException, forwardRef, BadRequestException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from 'src/db/schema';
import { eq } from 'drizzle-orm';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { UserAccountService } from 'src/user-account/user-account.service';
import { CategoriesService } from 'src/categories/categories.service';
import { BudgetService } from 'src/budget/budget.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { RecurringTransactionHelper } from './services/recurring-transaction.helper';
import { TransactionFinderService } from './services/transaction-finder.service';
import { TransactionUpdateService } from './services/transaction-update.service';

/**
 * Main service for managing transactions
 */
@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(UserAccountService) private readonly userAccountService: UserAccountService,
    @Inject(CategoriesService) private readonly categoriesService: CategoriesService,
    @Inject(forwardRef(() => BudgetService)) private readonly budgetService: BudgetService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Inject(RecurringTransactionHelper) private readonly recurringTransactionHelper: RecurringTransactionHelper,
    @Inject(TransactionFinderService) private readonly transactionFinderService: TransactionFinderService,
    @Inject(TransactionUpdateService) private readonly transactionUpdateService: TransactionUpdateService,
  ) { }

  /**
   * Verifies that the user account exists and returns it
   * @param userId The ID of the user
   * @returns The user account
   * @throws NotFoundException if the user account is not found
   */
  private async getUserAccount(userId: string): Promise<schema.UserAccount> {
    const userAccount = await this.userAccountService.findOneByUserId(userId);
    if (!userAccount) {
      throw new NotFoundException('User account not found');
    }
    return userAccount;
  }

  /**
   * Creates a new transaction for a given user.
   * 
   * This process includes:
   * - Retrieving the associated user account
   * - Validating the transaction category
   * - Inserting the transaction into the database
   * - Updating the actual amount of the related category's budget
   * - Updating the total amount of the user's account
   * - Handling recurring transactions if applicable
   * 
   * @param {CreateTransactionDto} createTransactionDto - The data for the transaction to be created
   * @param {string} userId - The ID of the user creating the transaction
   * @returns {Promise<{ transaction: schema.Transaction, totalUserAccountAmount: number }>}
   */
  async create(createTransactionDto: CreateTransactionDto, userId: string): Promise<{ transaction: schema.Transaction, totalUserAccountAmount: number }> {
    // Get the user account
    const userAccount = await this.getUserAccount(userId);

    return this.db.transaction(async (tx) => {
      // Validate the transaction category
      await this.categoriesService.findOne(createTransactionDto.categoryId, userId);

      // Create the transaction
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
        tx
      );

      // Update the total amount of the user account
      let userAccountChange = await this.userAccountService.updateTotalAmount(
        userId, 
        createTransactionDto.transactionType, 
        createTransactionDto.amount
      );

      // Handle recurring transactions if applicable
      if (createTransactionDto.isRecurring) {
        const recurringResult = await this.recurringTransactionHelper.processRecurringTransactions(result[0], userId, tx);
        
        // Store recurring info and schedule future transactions
        await this.recurringTransactionHelper.storeAndScheduleRecurringTransaction(
          {
            transaction: result[0],
            lastTransactionDate: recurringResult.lastTransactionDate,
            lastTransactionId: recurringResult.lastTransactionId
          },
          userId,
          recurringResult.lastTransactionId === result[0].id,
          tx
        );
        
        // Update account change if new transactions were created
        if (recurringResult.lastTransactionId !== result[0].id) {
          userAccountChange = await this.userAccountService.findOneByUserId(userId);
        }
      }

      // Return the transaction and updated account amount
      return {
        transaction: result[0],
        totalUserAccountAmount: userAccountChange.amount,
      };
    });
  }

  /**
   * Creates a child transaction based on a recurring parent transaction.
   * 
   * @param {string} transactionParentId - The ID of the parent transaction
   * @param {string} userId - The ID of the user
   * @returns {Promise<schema.Transaction>} The newly created child transaction
   */
  async createChildTransactions(transactionParentId: string, userId: string): Promise<schema.Transaction> {
    // Get the parent transaction
    const parentTransaction = await this.findOne(transactionParentId, userId);

    return this.db.transaction(async (tx) => {
      // Validate category
      await this.categoriesService.findOne(parentTransaction.categoryId, userId);

      // Create child transaction with appropriate description
      const description = this.recurringTransactionHelper.getChildTransactionDescription(parentTransaction.description);
      
      // Insert the child transaction
      const childTransaction = await tx.insert(schema.transactions).values({
        ...parentTransaction,
        id: undefined, // Generate a new ID
        description,
        recurringParentId: parentTransaction.id,
        date: new Date(),
        createdAt: new Date(),
      }).returning();

      // Update recurring transaction metadata
      await tx.update(schema.transactionRecurringInfo)
        .set({
          lastTransactionDate: childTransaction[0].date,
          lastTransactionId: childTransaction[0].id,
          updatedAt: new Date(),
        })
        .where(eq(schema.transactionRecurringInfo.transactionParentId, parentTransaction.id));

      // Update budget and account totals
      await this.budgetService.updateActualAmount(
        parentTransaction.categoryId,
        userId,
        parentTransaction.transactionType,
        parentTransaction.amount,
        childTransaction[0].date,
        tx
      );

      await this.userAccountService.updateTotalAmount(
        userId, 
        parentTransaction.transactionType, 
        parentTransaction.amount
      );

      // Send notification
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
   */
  async findAll(userId: string, limit: number = 10, page: number = 0) {
    return this.transactionFinderService.findAll(userId, limit, page);
  }

  /**
   * Get all transactions by category id
   */
  async findAllByCategoryId(categoryId: string, userId: string, startDate?: Date) {
    return this.transactionFinderService.findAllByCategoryId(categoryId, userId, startDate);
  }

  /**
   * Get a transaction by id
   */
  async findOne(id: string, userId: string): Promise<schema.Transaction> {
    return this.transactionFinderService.findOne(id, userId);
  }

  /**
   * Update a transaction
   * 
   * @param id Transaction ID
   * @param updateTransactionDto Data to update
   * @param userId User ID
   * @param updateNextChilds Whether to update child transactions
   * @returns Updated transaction
   */
  async update(
    id: string, 
    updateTransactionDto: UpdateTransactionDto, 
    userId: string, 
    updateNextChilds: boolean = false
  ): Promise<schema.Transaction> {
    // Get user account and transaction
    await this.getUserAccount(userId);
    const transaction = await this.findOne(id, userId);
    
    // Validate category if changing
    if (updateTransactionDto.categoryId) {
      await this.categoriesService.findOne(updateTransactionDto.categoryId, userId);
    }
    
    // Validate child transaction update constraints
    this.transactionUpdateService.validateChildTransactionUpdate(transaction, updateTransactionDto);

    return this.db.transaction(async (tx) => {
      // Update the transaction
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

      let userAccountChange;
      let totalAmountDiff = 0;
      
      // Handle transition from non-recurring to recurring
      if (updateTransactionDto.isRecurring && !transaction.isRecurring) {
        userAccountChange = await this.recurringTransactionHelper.convertToRecurring(result[0], userId, tx);
      }

      // Handle amount changes
      if (updateTransactionDto.amount) {
        totalAmountDiff = await this.transactionUpdateService.handleAmountUpdate(
          transaction, 
          updateTransactionDto, 
          userId, 
          tx, 
          updateNextChilds
        );
      }
      
      // Handle category changes
      if (updateTransactionDto.categoryId && (updateTransactionDto.categoryId !== transaction.categoryId)) {
        await this.transactionUpdateService.handleCategoryUpdate(transaction, updateTransactionDto, userId, tx);
      }

      // Update user account total amount if needed
      if (totalAmountDiff !== 0) {
        const amountType = totalAmountDiff > 0 ? 2 : 1;
        await this.userAccountService.updateTotalAmount(userId, amountType, Math.abs(totalAmountDiff));
      }

      return result[0];
    });
  }

  /**
   * Delete a transaction
   * 
   * @param id Transaction ID
   * @param userId User ID
   * @param removeChildren If true, removes all child transactions
   */
  async remove(
    id: string, 
    userId: string, 
    removeChildren: boolean
  ): Promise<{ message: string }> {
    // Get user account and transaction
    await this.getUserAccount(userId);
    const transaction = await this.findOne(id, userId);

    return this.db.transaction(async (tx) => {
      // Handle recurring transaction scenarios
      if (transaction.isRecurring) {
        if (transaction.recurringParentId) {
          // Handle child transaction removal
          await this.recurringTransactionHelper.handleRecurringChildRemoval(transaction, transaction.recurringParentId, tx);
        } else {
          // Cannot delete parent transaction directly
          throw new BadRequestException(
            'Cannot delete a parent transaction of a recurring transaction directly. ' +
            'Please stop the recurring transaction first!'
          );
        }
      }

      // Handle child transactions if this is a parent transaction
      if (removeChildren && !transaction.recurringParentId) {
        // Delete all child transactions
        await tx
          .delete(schema.transactions)
          .where(eq(schema.transactions.recurringParentId, id));
      } else {
        // Mark child transactions as orphaned
        await tx
          .update(schema.transactions)
          .set({ 
            recurringParentId: null, 
            isOrphaned: true, 
            updatedAt: new Date() 
          })
          .where(eq(schema.transactions.recurringParentId, id));
      }

      // Delete the transaction
      await tx
        .delete(schema.transactions)
        .where(eq(schema.transactions.id, id));

      // Update budget and account totals
      await this.budgetService.updateActualAmount(
        transaction.categoryId,
        userId,
        1, // Opposite of transaction type to reduce amount
        transaction.amount,
        transaction.date,
        tx
      );

      await this.userAccountService.updateTotalAmount(
        userId, 
        1, 
        transaction.amount
      );

      return { message: 'Transaction removed successfully' };
    });
  }

  /**
   * Stop a recurring transaction
   * 
   * @param transactionId ID of the transaction (can be parent or child)
   * @param userId User ID
   */
  async stopRecurringTransaction(transactionId: string, userId: string) {
    // Get the transaction
    const transaction = await this.findOne(transactionId, userId);

    if (!transaction.isRecurring) {
      throw new NotFoundException('Transaction is not a recurring transaction');
    }

    return this.db.transaction(async (tx) => {
      // Determine if this is a parent or child transaction
      const parentId = transaction.recurringParentId || transaction.id;
      
      // If it's a child, verify parent exists
      if (transaction.recurringParentId) {
        const parentTransaction = await this.findOne(transaction.recurringParentId, userId);
        if (!parentTransaction) {
          throw new NotFoundException('Parent transaction not found');
        }
        
        if (!parentTransaction.isRecurring) {
          throw new NotFoundException('Parent transaction is not a recurring transaction');
        }
      }
      
      // Stop the recurring transaction
      await this.recurringTransactionHelper.stopRecurringTransactionLogic(parentId, tx);
      
      return { message: 'Recurring transaction stopped successfully' };
    });
  }
}
