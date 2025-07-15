import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from 'src/db/schema';
import { eq, and, desc, count, gte } from 'drizzle-orm';
import { PaginatedTransactions } from '../interfaces/transaction-interfaces';
import { UserAccountService } from 'src/user-account/user-account.service';

/**
 * Service for retrieving transactions
 */
@Injectable()
export class TransactionFinderService {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(UserAccountService) private readonly userAccountService: UserAccountService,
  ) {}

  /**
   * Get the user account or throw NotFoundException
   * @param userId User ID
   * @returns User account
   */
  private async getUserAccount(userId: string): Promise<schema.UserAccount> {
    const userAccount = await this.userAccountService.findOneByUserId(userId);
    if (!userAccount) {
      throw new NotFoundException('User account not found');
    }
    return userAccount;
  }
  
  /**
   * Get all transactions for a user with pagination
   * @param userId User ID
   * @param limit Number of transactions per page
   * @param page Page number (0-based)
   * @returns Paginated transactions with metadata
   */
  async findAll(
    userId: string, 
    limit: number = 10, 
    page: number = 0
  ): Promise<PaginatedTransactions> {
    // Get the user account
    const userAccount = await this.getUserAccount(userId);

    // Execute both queries in parallel for better performance
    const [transactionsWithCategories, countResult] = await Promise.all([
      this.db
        .select({
          transaction: schema.transactions,
          category: schema.categories
        })
        .from(schema.transactions)
        .leftJoin(schema.categories, eq(schema.categories.id, schema.transactions.categoryId))
        .where(eq(schema.transactions.userAccountId, userAccount.id))
        .limit(limit)
        .offset(page * limit)
        .orderBy(desc(schema.transactions.date)),
      
      this.db
        .select({ count: count() })
        .from(schema.transactions)
        .where(eq(schema.transactions.userAccountId, userAccount.id))
    ]);

    // Map results to include category information
    const data = transactionsWithCategories.map(row => {
      const transaction = row.transaction as any;
      transaction.category = row.category ?? null;
      return transaction;
    });

    const totalCount = countResult[0].count;
    const lastPage = Math.ceil(totalCount / limit) - 1;

    return {
      data,
      limit,
      page,
      total: totalCount,
      lastPage: lastPage >= 0 ? lastPage : 0
    };
  }

  /**
   * Get all transactions by category id with optional date filtering
   * @param categoryId Category ID to filter by
   * @param userId User ID
   * @param startDate Optional start date to filter transactions
   * @returns Array of transactions for the specified category
   */
  async findAllByCategoryId(categoryId: string, userId: string, startDate?: Date) {
    const userAccount = await this.getUserAccount(userId);

    // Build query condition based on whether startDate is provided
    const whereCondition = startDate
      ? and(
          eq(schema.transactions.categoryId, categoryId),
          eq(schema.transactions.userAccountId, userAccount.id),
          gte(schema.transactions.date, startDate)
        )
      : and(
          eq(schema.transactions.categoryId, categoryId), 
          eq(schema.transactions.userAccountId, userAccount.id)
        );

    return this.db
      .select()
      .from(schema.transactions)
      .where(whereCondition)
      .orderBy(desc(schema.transactions.date));
  }

  /**
   * Get a transaction by id with its associated category
   * @param id Transaction ID
   * @param userId User ID
   * @returns Transaction with category information
   * @throws NotFoundException if transaction not found
   */
  async findOne(id: string, userId: string): Promise<schema.Transaction> {
    const userAccount = await this.getUserAccount(userId);

    const result = await this.db
      .select({
        transaction: schema.transactions,
        category: schema.categories
      })
      .from(schema.transactions)
      .leftJoin(schema.categories, eq(schema.categories.id, schema.transactions.categoryId))
      .where(and(
        eq(schema.transactions.id, id), 
        eq(schema.transactions.userAccountId, userAccount.id)
      ))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('Transaction not found');
    }

    // Add category as a property to the transaction object
    const transaction = result[0].transaction as any;
    transaction.category = result[0].category ?? null;
    
    return transaction;
  }
}
