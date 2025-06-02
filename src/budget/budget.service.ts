import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from 'src/db/schema';
import { eq, and } from 'drizzle-orm';
import { CategoriesService } from 'src/categories/categories.service';

@Injectable()
export class BudgetService {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(CategoriesService) private readonly categoriesService: CategoriesService,
  ) {}

  /**
   * Create a new budget for a user
   * @param createBudgetDto 
   * @param userId
   * @returns 
   */
  async create(createBudgetDto: CreateBudgetDto, userId: string): Promise<schema.Budget>  {
    // Verify if the category exists
    const category = await this.categoriesService.findOne(createBudgetDto.categoryId, userId);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const budget = await this.db.insert(schema.budgets).values({
      ...createBudgetDto,
      userId,
      createdAt: new Date(),
    }).returning();

    return budget[0];
  }

  /**
   * FInd all budgets by user id
   * @param userId
   * @returns 
   */
  async findAllByUserId(userId: string): Promise<schema.Budget[]> {
    return this.db.select().from(schema.budgets).where(eq(schema.budgets.userId, userId));
  }

  /**
   * Get a budget by is id
   * => Verify if the budget is owned by the user
   * @param id 
   * @param userId
   * @returns 
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
   * Find a budget by category id
   * @param categoryId
   * @param userId
   * @returns
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
   * Update a budget by id
   * @param id (budget Id)
   * @param updateBudgetDto
   * @param userId 
   * @returns 
   */
  async update(id: string, updateBudgetDto: UpdateBudgetDto, userId: string): Promise<schema.Budget> {
    const budget = await this.findOne(id, userId);
    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    const result = await this.db
     .update(schema.budgets)
     .set({
      totalAmount: updateBudgetDto.totalAmount,
      reccuringFrequency: updateBudgetDto.reccuringFrequency,
      updatedAt: new Date(),
     })
     .where(eq(schema.budgets.id, id))
     .returning();

    return result[0];
  }

  /**
   * Update a budget actual amount for a category
   * @param categoryId
   * @param userId
   * @param type (1 = income, 2 = expense)
   * @param amount
   */
  async updateActualAmount(categoryId: string, userId: string, type: number, amount: number): Promise<schema.Budget | null> {
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

      // TODO : verify if the budget is reached or not and send a notification if it is reached

      return result[0];
    }
  }

  /**
   * Delete a budget by id
   * @param id (budget Id)
   * @param userId
   * @returns 
   */
  async remove(id: string, userId: string): Promise<void> {
    return this.db
      .delete(schema.budgets)
      .where(and(eq(schema.budgets.id, id), eq(schema.budgets.userId, userId)))
      .then(() => undefined);
  }
}
