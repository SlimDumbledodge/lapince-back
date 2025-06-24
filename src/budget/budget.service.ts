import { Injectable, Inject, NotFoundException, forwardRef } from '@nestjs/common';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from 'src/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { CategoriesService } from 'src/categories/categories.service';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween'
import { BudgetResetService } from 'src/lib/bullmq/budget-reset/budget-reset.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { TransactionsService } from 'src/transactions/transactions.service';

dayjs.extend(isBetween);

@Injectable()
export class BudgetService {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(CategoriesService) private readonly categoriesService: CategoriesService,
    @Inject(BudgetResetService) private readonly budgetResetService: BudgetResetService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => TransactionsService)) private readonly transactionsService: TransactionsService,
  ) {}

  /**
   * Creates a new budget for a specific user and category.
   * Also schedules recurring reset if applicable.
   *
   * @param createBudgetDto - Budget creation payload.
   * @param userId - The ID of the user creating the budget.
   * @returns The created budget.
   * @throws NotFoundException - If category doesn't exist or budget already exists for the category.
   */
  async create(createBudgetDto: CreateBudgetDto, userId: string): Promise<schema.Budget>  {
    // Verify if the category exists
    const category = await this.categoriesService.findOne(createBudgetDto.categoryId, userId);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Verify if the user has already a budget for this category
    const existingBudget = await this.findOneByCategoryId(createBudgetDto.categoryId, userId);
    if (existingBudget) {
      throw new NotFoundException('You already have a budget for this category');
    }

    // Get all transactions for this category for this month after the recurringStartDate and set the actual amount to the sum of all transactions
    const startDate = createBudgetDto.recurringStartDate ? dayjs(createBudgetDto.recurringStartDate) : dayjs();
    const today = dayjs();

    // Adjust the start date to the next recurring frequency if it is before today
    let adjustedDate = startDate;
    while (adjustedDate.add(createBudgetDto.recurringFrequency || 30, 'day').isBefore(today) || adjustedDate.add(createBudgetDto.recurringFrequency || 30, 'day').isSame(today)) {
      adjustedDate = adjustedDate.add(createBudgetDto.recurringFrequency || 30, 'day');
    }

    const totalSinceStart = await this.transactionsService.findAllByCategoryId(createBudgetDto.categoryId, userId, adjustedDate.toDate());

    const actualAmount = totalSinceStart.reduce((sum, transaction) => {
      return sum + (transaction.transactionType === 1 ? -transaction.amount : transaction.amount);
    }, 0);

    const budget = await this.db.insert(schema.budgets).values({
      ...createBudgetDto,
      actualAmount,
      userId,
      recurringStartDate: adjustedDate.toISOString(),
      lastResetDate: adjustedDate.toISOString() ?? new Date().toISOString(),
      createdAt: new Date(),
    }).returning();    

    // create a schedule for reset the budget
    if (createBudgetDto.recurringFrequency) {
      await this.budgetResetService.scheduleBudgetReset(budget[0]);
    }

    return budget[0];
  }

  /**
   * Retrieves all budgets for a specific user.
   *
   * @param userId - The ID of the user.
   * @returns A list of budgets belonging to the user.
   */
  async findAllByUserId(userId: string): Promise<schema.Budget[]> {
    return this.db.select().from(schema.budgets).where(eq(schema.budgets.userId, userId)).orderBy(desc(schema.budgets.createdAt));
  }

  /**
   * Retrieves a specific budget by its ID, ensuring it belongs to the given user.
   *
   * @param id - The budget ID.
   * @param userId - The ID of the user requesting the budget.
   * @returns The found budget.
   * @throws NotFoundException - If no matching budget is found.
   */
  async findOne(id: string, userId: string): Promise<schema.Budget> {
    const result = await this.db
      .select()
      .from(schema.budgets)
      .where(and(eq(schema.budgets.id, id), eq(schema.budgets.userId, userId)));

    if (result.length === 0) {
      throw new NotFoundException('Budget not found');
    }

    return result[0];
  }


  /**
   * Retrieves a budget by its category ID for a specific user.
   *
   * @param categoryId - The category ID to look up the budget.
   * @param userId - The ID of the user.
   * @returns The budget if found, otherwise null.
   */
  async findOneByCategoryId(categoryId: string, userId: string): Promise<schema.Budget | null> {
    const result = await this.db
     .select()
     .from(schema.budgets)
     .where(and(eq(schema.budgets.categoryId, categoryId), eq(schema.budgets.userId, userId)));

    if (result.length === 0) {
      return null;
    } else {
      return result[0];
    }
  }

  /**
   * Updates an existing budget's total amount and recurring frequency.
   *
   * @param id - The ID of the budget to update.
   * @param updateBudgetDto - Payload containing update values.
   * @param userId - The ID of the user requesting the update.
   * @returns The updated budget.
   * @throws NotFoundException - If the budget doesn't exist or doesn't belong to the user.
   */
  async update(id: string, updateBudgetDto: UpdateBudgetDto, userId: string): Promise<schema.Budget> {
    const budget = await this.findOne(id, userId);
    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    const startDate = updateBudgetDto.recurringStartDate ? dayjs(updateBudgetDto.recurringStartDate) : undefined;
    const today = dayjs();

    let adjustedDate = startDate;
    let actualAmount = budget.actualAmount;
    if (adjustedDate) {
      while (adjustedDate.add(updateBudgetDto.recurringFrequency || budget.recurringFrequency || 30, 'day').isBefore(today) || adjustedDate.add(updateBudgetDto.recurringFrequency || budget.recurringFrequency || 30, 'day').isSame(today)) {
        adjustedDate = adjustedDate.add(updateBudgetDto.recurringFrequency || budget.recurringFrequency || 30, 'day');
      }

      const totalSinceStart = await this.transactionsService.findAllByCategoryId(budget.categoryId, userId, adjustedDate.toDate());

      actualAmount = totalSinceStart.reduce((sum, transaction) => {
        return sum + (transaction.transactionType === 1 ? -transaction.amount : transaction.amount);
      }, 0);
    }

    return this.db.transaction(async (tx) => {
      const result = await tx
      .update(schema.budgets)
      .set({
        totalAmount: updateBudgetDto.totalAmount,
        actualAmount,
        lastResetDate: adjustedDate ? adjustedDate.toISOString() : budget.lastResetDate,
        recurringStartDate: adjustedDate?.toISOString(),
        recurringFrequency: updateBudgetDto.recurringFrequency,
        updatedAt: new Date(),
      })
      .where(eq(schema.budgets.id, id))
      .returning();

      // Update the budget reset job if the recurring frequency or recurringStartDate has changed
      if (updateBudgetDto.recurringFrequency && budget.recurringFrequency !== updateBudgetDto.recurringFrequency) {
        await this.budgetResetService.removeBudgetResetJob(id);
        await this.budgetResetService.scheduleBudgetReset(result[0]);
      } else if (adjustedDate && budget.recurringStartDate !== adjustedDate.toISOString()) {
        await this.budgetResetService.removeBudgetResetJob(id);
        await this.budgetResetService.scheduleBudgetReset(result[0]);
      }

      return result[0];
    });
  }

  /**
   * Updates the actual amount of a budget based on a transaction.
   * Validates transaction date falls within the current budget period.
   * Sends notifications if budget reaches or exceeds 75% or 100%.
   *
   * @param categoryId - The category ID associated with the transaction.
   * @param userId - The user ID performing the transaction.
   * @param type - 1 for income (subtract), 2 for expense (add).
   * @param amount - The transaction amount.
   * @param transactionDate - The date of the transaction.
   * @returns The updated budget or null if outside the current period.
   */
  async updateActualAmount(categoryId: string, userId: string, type: number, amount: number, transactionDate: string | Date): Promise<schema.Budget | null> {
    const budget = await this.findOneByCategoryId(categoryId, userId);
      if (!budget) {
        return null;
      }

      let actualAmount = budget.actualAmount;
      if (type === 1) {
        actualAmount -= amount;
        if (actualAmount < 0) {
          actualAmount = 0;
        }
      } else if (type === 2) {
        actualAmount += amount;
      }

      // Verify if the transaction is in this budget period
      const startDate = dayjs(budget.lastResetDate);
      const endDate = dayjs(budget.lastResetDate).add(budget.recurringFrequency ?? 30, 'days');
      const transactionDay = dayjs(transactionDate);

      if (!transactionDay.isBetween(startDate, endDate, 'day', '[)')) {
        return null;
      }

      const result = await this.db
      .update(schema.budgets)
      .set({
        actualAmount,
        updatedAt: new Date(),
      })
      .where(eq(schema.budgets.id, budget.id))
      .returning();

      if (result.length === 0) {
        return null;
      } else {

      // verify if the budget is reached or at 75% and send a notification if it is reached
      if (actualAmount >= budget.totalAmount * 0.75) {

        const category = await this.categoriesService.findOne(budget.categoryId, userId);

        if (actualAmount >= budget.totalAmount) {
          await this.notificationsService.create({
            type: "budget",
            message: `Your budget for ${category.name} is reached !!!`,
            level: "error",
          }, userId);
          
        } else {

          await this.notificationsService.create({
            type: "budget",
            message: `Your budget for ${category.name} is above 75% !!!`,
            level: "warning",
          }, userId);
        }
      }

      return result[0];
    }
  }

  /**
   * Resets a budget's actual amount and updates the last reset date.
   * Intended to be called by a scheduled job.
   *
   * @param id - The ID of the budget to reset.
   * @returns The updated budget after reset or null if not found.
   */
  async resetActualAmount(id: string): Promise<schema.Budget | null> {
    const budget = await this.db
     .select()
     .from(schema.budgets)
     .where(eq(schema.budgets.id, id));

    if (budget.length === 0) {
      return null;
    }

    const result = await this.db
    .update(schema.budgets)
    .set({
      actualAmount: 0,
      lastResetDate: new Date().toISOString(),
      updatedAt: new Date(),
     })
    .where(eq(schema.budgets.id, id))
    .returning();

    // send a notification to the user that the budget has been reset
    if (result.length > 0) {
      const budgetData = result[0];
      await this.notificationsService.create({
        type: "budget",
        message: `Your budget for ${budgetData.categoryId} has been reset.`,
        level: "info",
      }, budgetData.userId);
    }

    if (result.length === 0) {
      return null;
    } else {
      return result[0];
    }
  }

  /**
   * Deletes a budget by ID, ensuring it belongs to the user.
   *
   * @param id - The ID of the budget to delete.
   * @param userId - The user ID requesting the deletion.
   * @returns void
   */
  async remove(id: string, userId: string): Promise<void> {
    return this.db.transaction(async (tx) => {
      await tx
        .delete(schema.budgets)
        .where(and(eq(schema.budgets.id, id), eq(schema.budgets.userId, userId)))
        .then(() => undefined);

      // Remove the budget from the budget reset queue if it exists
      await this.budgetResetService.removeBudgetResetJob(id);
    });
  }
}
