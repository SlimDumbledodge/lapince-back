import { Injectable, Inject, BadRequestException, forwardRef } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from 'src/db/schema';
import { eq, and, sum, or, lte, gte } from 'drizzle-orm';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { BudgetService } from 'src/budget/budget.service';
import { DatabaseTransaction } from '../interfaces/transaction-interfaces';
import dayjs from 'dayjs';
import { convertFrequencyToDayjsPeriod } from 'src/common/convert/convert-frequency';

/**
 * Service for handling transaction updates
 */
@Injectable()
export class TransactionUpdateService {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(forwardRef(() => BudgetService)) private readonly budgetService: BudgetService,
  ) {}

  /**
   * Validate update conditions for a child transaction
   * @param transaction Current transaction
   * @param updateTransactionDto Update data
   */
  validateChildTransactionUpdate(transaction: schema.Transaction, updateTransactionDto: UpdateTransactionDto): void {
    // Cannot update recurring properties on a child transaction
    if (transaction.recurringParentId && 
        (updateTransactionDto.isRecurring || 
         updateTransactionDto.recurringFrequency || 
         updateTransactionDto.recurringEndDate)) {
      throw new BadRequestException('Cannot add a recurrency on a child transaction!');
    }

    // Cannot change category of a child transaction
    if (transaction.recurringParentId && 
        updateTransactionDto.categoryId && 
        (updateTransactionDto.categoryId !== transaction.categoryId)) {
      throw new BadRequestException(
        'Cannot change the category of a child transaction of a recurring transaction! ' +
        'If you want to change the category, please update the category of the parent transaction.'
      );
    }

    // Cannot change transaction type of a child transaction
    if (transaction.recurringParentId && 
        updateTransactionDto.transactionType && 
        (updateTransactionDto.transactionType !== transaction.transactionType)) {
      throw new BadRequestException(
        'Cannot change the transaction type of a child transaction of a recurring transaction! ' +
        'If you want to change the transaction type, please stop the recurring transaction first.'
      );
    }
  }

  /**
   * Handle amount changes in a transaction
   * @param transaction Original transaction
   * @param updateTransactionDto Update data
   * @param userId User ID
   * @param tx Database transaction
   * @param updateNextChilds Whether to update next child transactions
   * @returns Total amount difference
   */
  async handleAmountUpdate(
    transaction: schema.Transaction,
    updateTransactionDto: UpdateTransactionDto,
    userId: string,
    tx: DatabaseTransaction,
    updateNextChilds: boolean
  ): Promise<number> {
    // If no amount change, return 0
    if (!updateTransactionDto.amount || updateTransactionDto.amount === transaction.amount) {
      return 0;
    }

    const amountDiff = updateTransactionDto.amount - transaction.amount;
    let totalAmountDiff = amountDiff;
    const amountType = amountDiff > 0 ? 2 : 1;

    // If parent transaction with children and updateNextChilds is true
    if (transaction.isRecurring && !transaction.recurringParentId && updateNextChilds) {
      // Update all child transactions with the same initial amount
      const data = await tx
        .update(schema.transactions)
        .set({ amount: updateTransactionDto.amount })
        .where(
          and(
            eq(schema.transactions.recurringParentId, transaction.id),
            eq(schema.transactions.amount, transaction.amount)
          )
        )
        .returning();

      // Add all child transaction differences to the total
      totalAmountDiff += amountDiff * data.length;

      // Update budget for all affected transactions
      const budget = await tx
        .select()
        .from(schema.budgets)
        .where(eq(schema.budgets.categoryId, transaction.categoryId))
        .then(result => result[0]);

      if (budget) {
        const { value, unit } = convertFrequencyToDayjsPeriod(budget.recurringFrequency || 'monthly');
        const startDateBudgetPeriod = dayjs(budget.lastResetDate).toDate();
        const endDateBudgetPeriod = dayjs(budget.lastResetDate).add(value, unit).toDate();

        let totalAmountDiffForThisBudget = 0;
        for (const childTransaction of data) {
          if (childTransaction.date >= startDateBudgetPeriod && childTransaction.date <= endDateBudgetPeriod) {
            totalAmountDiffForThisBudget += Math.abs(amountDiff);
          }
        }

        const isOriginalInPeriod = (transaction.date >= startDateBudgetPeriod && 
                                  transaction.date <= endDateBudgetPeriod);
        
        await this.budgetService.updateActualAmount(
          transaction.categoryId,
          userId,
          amountType,
          Math.abs(isOriginalInPeriod ? amountDiff : 0) + totalAmountDiffForThisBudget,
          dayjs().toDate(),
          tx
        );
      }
    } else {
      // Simple update for single transaction
      await this.budgetService.updateActualAmount(
        updateTransactionDto.categoryId ?? transaction.categoryId,
        userId,
        amountType,
        Math.abs(amountDiff),
        updateTransactionDto.date ? new Date(updateTransactionDto.date) : transaction.date,
        tx
      );
    }

    return totalAmountDiff;
  }

  /**
   * Handle category changes in a transaction
   * @param transaction Original transaction
   * @param updateTransactionDto Update data
   * @param userId User ID
   * @param tx Database transaction
   */
  async handleCategoryUpdate(
    transaction: schema.Transaction,
    updateTransactionDto: UpdateTransactionDto,
    userId: string,
    tx: DatabaseTransaction
  ): Promise<void> {
    // Skip if category isn't changing
    if (!updateTransactionDto.categoryId || updateTransactionDto.categoryId === transaction.categoryId) {
      return;
    }

    // If it's a parent transaction with children
    if (transaction.isRecurring && !transaction.recurringParentId) {
      // Get the new budget category
      const newBudgetCategory = await tx
        .select()
        .from(schema.budgets)
        .where(eq(schema.budgets.categoryId, updateTransactionDto.categoryId))
        .then(result => result[0]);

      if (newBudgetCategory) {
        // Calculate budget period
        const { value, unit } = convertFrequencyToDayjsPeriod(newBudgetCategory.recurringFrequency || 'monthly');
        const startDateBudgetPeriod = dayjs(newBudgetCategory.lastResetDate).toDate();
        const endDateBudgetPeriod = dayjs(newBudgetCategory.lastResetDate).add(value, unit).toDate();

        // Get sum of all affected transactions in budget period
        const childTransactions = await tx
          .select({
            sumAmount: sum(schema.transactions.amount),
          })
          .from(schema.transactions)
          .where(
            and(
              or(
                eq(schema.transactions.recurringParentId, transaction.id),
                eq(schema.transactions.id, transaction.id),
              ),
              gte(schema.transactions.date, startDateBudgetPeriod),
              lte(schema.transactions.date, endDateBudgetPeriod),
            )
          )
          .then(result => result[0]);

        // Update budgets for old and new categories
        if (childTransactions && childTransactions.sumAmount) {
          const sumAmount = parseInt(childTransactions.sumAmount);
          
          // Decrease old category budget
          await this.budgetService.updateActualAmount(
            transaction.categoryId,
            userId,
            transaction.transactionType,
            -sumAmount,
            dayjs().toDate(),
            tx
          );

          // Increase new category budget
          await this.budgetService.updateActualAmount(
            updateTransactionDto.categoryId,
            userId,
            updateTransactionDto.transactionType ?? transaction.transactionType,
            sumAmount,
            dayjs().toDate(),
            tx
          );
        }
      }

      // Update all child transactions' categories
      await tx
        .update(schema.transactions)
        .set({
          categoryId: updateTransactionDto.categoryId,
          updatedAt: new Date(),
        })
        .where(eq(schema.transactions.recurringParentId, transaction.id));

    } else {
      // Simple update for single transaction
      
      // Decrease old category budget
      await this.budgetService.updateActualAmount(
        transaction.categoryId,
        userId,
        transaction.transactionType,
        -transaction.amount,
        transaction.date,
        tx
      );

      // Increase new category budget
      await this.budgetService.updateActualAmount(
        updateTransactionDto.categoryId,
        userId,
        updateTransactionDto.transactionType ?? transaction.transactionType,
        updateTransactionDto.amount ?? transaction.amount,
        updateTransactionDto.date ? new Date(updateTransactionDto.date) : transaction.date,
        tx
      );
    }
  }
}
