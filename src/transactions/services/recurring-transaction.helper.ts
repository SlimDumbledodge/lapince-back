import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from 'src/db/schema';
import { eq, desc } from 'drizzle-orm';
import dayjs from 'dayjs';
import { convertFrequencyToDayjsPeriod } from 'src/common/convert/convert-frequency';
import { RecurringTransactionService } from 'src/lib/bullmq/recurring-transaction/recurring-transaction.service';
import { BudgetService } from 'src/budget/budget.service';
import { UserAccountService } from 'src/user-account/user-account.service';
import { RecurringTransactionResult, DatabaseTransaction } from '../interfaces/transaction-interfaces';

/**
 * Helper service for managing recurring transactions
 */
@Injectable()
export class RecurringTransactionHelper {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(RecurringTransactionService) private readonly recurringTransactionService: RecurringTransactionService,
    @Inject(forwardRef(() => BudgetService)) private readonly budgetService: BudgetService,
    @Inject(UserAccountService) private readonly userAccountService: UserAccountService,
  ) {}

  /**
   * Gets the appropriate description for a child transaction
   * @param parentDescription The description of the parent transaction
   * @returns The description for the child transaction
   */
  getChildTransactionDescription(parentDescription: string | null): string {
    if (!parentDescription) return 'Recurring Transaction';
    return /\(Child\)\s*$/i.test(parentDescription) 
      ? parentDescription 
      : `${parentDescription}`; // TODO : Add numbering logic
  }

  /**
   * Processes recurring transactions by creating child transactions for all past occurrences
   * @param parentTransaction The parent transaction
   * @param userId The ID of the user
   * @param tx Optional database transaction
   * @returns The result of the recurring transaction processing
   */
  async processRecurringTransactions(
    parentTransaction: schema.Transaction,
    userId: string,
    tx?: DatabaseTransaction
  ): Promise<RecurringTransactionResult> {
    const db = tx || this.db;
    
    let adjustedDate = dayjs(parentTransaction.date);
    let lastTransaction = parentTransaction;
    const { value: frequencyValue, unit: frequencyUnit } = convertFrequencyToDayjsPeriod(
      parentTransaction.recurringFrequency || 'monthly'
    );

    // Generate all missed transactions between start date and now
    while (adjustedDate.add(frequencyValue, frequencyUnit).isBefore(dayjs())) {
      adjustedDate = adjustedDate.add(frequencyValue, frequencyUnit);

      // Create a new child transaction
      const { id, ...rest } = lastTransaction;
      const childDescription = this.getChildTransactionDescription(lastTransaction.description);
      
      const newTransaction: schema.NewTransaction = {
        ...rest,
        description: childDescription,
        date: adjustedDate.toDate(),
        recurringStartDate: parentTransaction.recurringStartDate,
        recurringEndDate: parentTransaction.recurringEndDate,
        recurringParentId: parentTransaction.id,
        createdAt: new Date(),
      };

      // Insert the new transaction
      const newResult: schema.Transaction[] = await db.insert(schema.transactions)
        .values(newTransaction)
        .returning();
      
      lastTransaction = newResult[0];

      // Update budget and total account amount
      await this.budgetService.updateActualAmount(
        newTransaction.categoryId,
        userId,
        newResult[0].transactionType,
        newResult[0].amount,
        newResult[0].date,
        tx
      );

      await this.userAccountService.updateTotalAmount(
        userId, 
        newResult[0].transactionType, 
        newResult[0].amount
      );
    }

    return {
      lastTransactionDate: adjustedDate.toDate(),
      lastTransactionId: lastTransaction.id,
      transaction: lastTransaction
    };
  }

  /**
   * Stores recurring transaction information and schedules future occurrences
   * @param recurringResult The result of processing recurring transactions
   * @param userId The ID of the user
   * @param isFirstTransaction Whether this is the first transaction
   * @param tx Optional database transaction
   */
  async storeAndScheduleRecurringTransaction(
    recurringResult: RecurringTransactionResult,
    userId: string,
    isFirstTransaction: boolean,
    tx?: DatabaseTransaction
  ): Promise<void> {
    const db = tx || this.db;
    
    // Schedule the recurring transaction
    await this.recurringTransactionService.scheduleRecurringTransaction(
      recurringResult.transaction, 
      userId, 
      isFirstTransaction
    );

    // Store the recurring transaction info
    await db.insert(schema.transactionRecurringInfo).values({
      transactionParentId: recurringResult.transaction.recurringParentId || recurringResult.transaction.id,
      lastTransactionDate: recurringResult.lastTransactionDate,
      lastTransactionId: recurringResult.lastTransactionId,
      createdAt: new Date(),
    });
  }

  /**
   * Convert transaction to recurring
   * @param transaction Updated transaction
   * @param userId User ID
   * @param tx Database transaction
   */
  async convertToRecurring(
    transaction: schema.Transaction,
    userId: string,
    tx: DatabaseTransaction
  ): Promise<any> {
    if (!transaction.recurringFrequency) {
      throw new Error('Recurring frequency is required to create a recurring transaction');
    }

    // Process recurring transactions
    const recurringResult = await this.processRecurringTransactions(transaction, userId, tx);
    
    // Schedule and store recurring info
    await this.storeAndScheduleRecurringTransaction(
      {
        transaction,
        lastTransactionDate: recurringResult.lastTransactionDate,
        lastTransactionId: recurringResult.lastTransactionId
      },
      userId,
      recurringResult.transaction.id === transaction.id,
      tx
    );

    // Get updated user account information
    return await this.userAccountService.findOneByUserId(userId);
  }

  /**
   * Common logic to stop a recurring transaction
   * @param parentId Parent transaction ID
   * @param tx Database transaction
   */
  async stopRecurringTransactionLogic(parentId: string, tx: DatabaseTransaction): Promise<void> {
    // Find the last child transaction
    const lastChild = await tx
      .select()
      .from(schema.transactionRecurringInfo)
      .where(eq(schema.transactionRecurringInfo.transactionParentId, parentId))
      .orderBy(desc(schema.transactionRecurringInfo.lastTransactionDate))
      .limit(1)
      .then(result => result[0]);

    if (!lastChild) {
      throw new Error('No child transactions found for this parent transaction');
    }

    // Cancel the recurring transaction
    await this.recurringTransactionService.cancelRecurringTransaction(lastChild.lastTransactionId);

    // Remove recurring info
    await tx.delete(schema.transactionRecurringInfo)
      .where(eq(schema.transactionRecurringInfo.transactionParentId, parentId));

    // Update parent transaction
    await tx.update(schema.transactions)
      .set({
        isRecurring: false,
        recurringFrequency: null,
        recurringEndDate: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.transactions.id, parentId));

    // Update child transactions
    await tx.update(schema.transactions)
      .set({
        isRecurring: false,
        recurringFrequency: null,
        recurringEndDate: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.transactions.recurringParentId, parentId));
  }

  /**
   * Handle removal of a recurring child transaction
   * @param transaction Transaction to remove
   * @param recurringParentId Parent ID
   * @param tx Database transaction
   */
  async handleRecurringChildRemoval(
    transaction: schema.Transaction,
    recurringParentId: string,
    tx: DatabaseTransaction
  ): Promise<void> {
    // Check if it's the last child transaction
    const recurringInfo = await tx
      .select()
      .from(schema.transactionRecurringInfo)
      .where(eq(schema.transactionRecurringInfo.transactionParentId, recurringParentId))
      .orderBy(desc(schema.transactionRecurringInfo.lastTransactionDate))
      .limit(1)
      .then(result => result[0]);

    if (!recurringInfo || recurringInfo.lastTransactionId !== transaction.id) {
      return; // Not the last child, nothing special to do
    }

    // Find the previous child transaction
    const previousChild = await tx
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.recurringParentId, recurringParentId))
      .orderBy(desc(schema.transactions.date))
      .limit(2)
      .then(result => {
        if (result.length < 2) return null;
        return result[1]; // Second last transaction
      });

    // Update the recurring info with new last transaction
    if (previousChild) {
      await tx
        .update(schema.transactionRecurringInfo)
        .set({ lastTransactionId: previousChild.id })
        .where(eq(schema.transactionRecurringInfo.id, recurringInfo.id));
    } else {
      // If no previous child, parent becomes the last transaction
      await tx
        .update(schema.transactionRecurringInfo)
        .set({ lastTransactionId: recurringParentId })
        .where(eq(schema.transactionRecurringInfo.id, recurringInfo.id));
    }
  }
}
