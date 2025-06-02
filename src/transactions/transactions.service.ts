import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from 'src/db/schema';
import { eq, and } from 'drizzle-orm';
import { UserAccountService } from 'src/user-account/user-account.service';
import { CategoriesService } from 'src/categories/categories.service';
import { BudgetService } from 'src/budget/budget.service';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(UserAccountService) private readonly userAccountService: UserAccountService,
    @Inject(CategoriesService) private readonly categoriesService: CategoriesService,
    @Inject(BudgetService) private readonly budgetService: BudgetService,
  ) { }

  /**
   * Create a new transaction
   * @param createTransactionDto 
   * @param userId
   * @returns 
   */
  async create(createTransactionDto: CreateTransactionDto, userId: string): Promise<schema.Transaction> {
    // Get the user account
    const userAccount = await this.userAccountService.findOneByUserId(userId);
    if (!userAccount) {
      throw new NotFoundException('User account not found');
    }

    return this.db.transaction(async (tx) => {
      // validate the transaction category
      const category = await this.categoriesService.findOne(createTransactionDto.categoryId, userId);

      // create the transaction
      const result = await tx.insert(schema.transactions).values({
        ...createTransactionDto,
        date: new Date(createTransactionDto.date),
        reccuringStartDate: createTransactionDto.RecurringStartDate ? new Date(createTransactionDto.RecurringStartDate) : null,
        reccuringEndDate: createTransactionDto.RecurringEndDate ? new Date(createTransactionDto.RecurringEndDate) : null,
        userAccountId: userAccount.id,
        createdAt: new Date(),
      } as unknown as schema.NewTransaction).returning();

      // Update the actual amount of the category budget
      await this.budgetService.updateActualAmount(
        createTransactionDto.categoryId, 
        userId, 
        createTransactionDto.transactionType, 
        createTransactionDto.amount,
        createTransactionDto.date,
      );

      // update the total amount of the user account
      await this.userAccountService.updateTotalAmount(userId, createTransactionDto.transactionType, createTransactionDto.amount);

      // Verify if the transaction is recurring
      // TODO : make the recurring system

      // return the transaction
      return result[0];
    })

  }

  /**
   * Get all transactions for a user with pagination
   * @param userId
   * @param limit
   * @param page
   * @returns 
   */
  async findAll(userId: string, limit: number = 10, page: number = 0): Promise<{ data: schema.Transaction[], limit: number, page: number }> {
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
      .orderBy(schema.transactions.createdAt)

    const data = result.map(row => ({
      ...row.transaction,
      category: row.category ?? null
    }));

    return {
      data,
      limit: limit,
      page: page,
    }
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
  async update(id: string, updateTransactionDto: UpdateTransactionDto, userId: string): Promise<schema.Transaction> {
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
          reccuringStartDate: updateTransactionDto.RecurringStartDate ? new Date(updateTransactionDto.RecurringStartDate) : transaction.reccuringStartDate,
          reccuringEndDate: updateTransactionDto.RecurringEndDate ? new Date(updateTransactionDto.RecurringEndDate) : transaction.reccuringEndDate,
          updatedAt: new Date(),
        } as unknown as schema.Transaction)
        .where(eq(schema.transactions.id, id))
        .returning();

      // Get the amount diff and transaction type
      const amountDiff = updateTransactionDto.amount ? updateTransactionDto.amount - transaction.amount : 0;
      const amountType = amountDiff > 0 ? 1 : 2;

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
          transaction.transactionsType,
          -transaction.amount,
          transaction.date,
        );

        // Update the actual amount of the new category budget
        await this.budgetService.updateActualAmount(
          updateTransactionDto.categoryId,
          userId,
          updateTransactionDto.transactionType ?? transaction.transactionsType,
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
}
