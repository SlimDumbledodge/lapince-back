import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from 'src/db/schema';
import { eq, and } from 'drizzle-orm';
import { UserAccountService } from 'src/user-account/user-account.service';
import dayjs from 'dayjs';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(UserAccountService) private readonly userAccountService: UserAccountService,
  ) {}

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

    // validate the transaction category
    // TODO : make the category system

    // create the transaction
    const result = await this.db.insert(schema.transactions).values({
      ...createTransactionDto,
      date : new Date(createTransactionDto.date),
      reccuringStartDate : createTransactionDto.RecurringStartDate ? new Date(createTransactionDto.RecurringStartDate) : null,
      reccuringEndDate : createTransactionDto.RecurringEndDate ? new Date(createTransactionDto.RecurringEndDate) : null,
      userAccountId: userAccount.id,
      createdAt: new Date(),
    } as unknown as schema.NewTransaction).returning();

    // verify in the category budget is enough and update it

    // Verify if the transaction is recurring
    // TODO : make the recurring system

    // return the transaction
    return result[0];
  }

  /**
   * Get all transactions for a user with pagination
   * @param userId
   * @param limit
   * @param page
   * @returns 
   */
  async findAll(userId: string, limit: number = 10, page: number = 0): Promise<{data: schema.Transaction[], limit: number, page: number}> {
    // Get the user account
    const userAccount = await this.userAccountService.findOneByUserId(userId);

    if (!userAccount) {
      throw new NotFoundException('User account not found');
    }

    const result = await this.db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.userAccountId, userAccount.id))
      .limit(limit)
      .offset(page * limit)
      .orderBy(schema.transactions.createdAt)
    // TODO : join the category table
    // .innerJoin(schema.categories, eq(schema.categories.id, schema.transactions.categoryId))

    return {
      data: result,
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
     .select()
     .from(schema.transactions)
     .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userAccountId, userAccount.id)))
    // TODO : join the category table
    // .innerJoin(schema.categories, eq(schema.categories.id, schema.transactions.categoryId))

    if (!result) {
      throw new NotFoundException('Transaction not found');
    }

    return result[0];
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

    // update the transaction
    const result = await this.db
    .update(schema.transactions)
    .set({
      ...updateTransactionDto,
      date : updateTransactionDto.date ? new Date(updateTransactionDto.date) : transaction.date,
      reccuringStartDate : updateTransactionDto.RecurringStartDate ? new Date(updateTransactionDto.RecurringStartDate) : transaction.reccuringStartDate,
      reccuringEndDate : updateTransactionDto.RecurringEndDate ? new Date(updateTransactionDto.RecurringEndDate) : transaction.reccuringEndDate,
      updatedAt: new Date(),
    } as unknown as schema.Transaction).returning()

    // Verify and update the budget

    // verify if the transaction is recurring
    // TODO : make the recurring system

    return result[0];
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
    // Delete the transaction
    return this.db
    .delete(schema.transactions)
    .where(eq(schema.transactions.id, id))
    .then(() => undefined)
  }
}
