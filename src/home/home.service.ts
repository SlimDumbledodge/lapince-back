import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import dayjs, { Dayjs } from 'dayjs';
import { eq, and, gte, lte } from 'drizzle-orm';
import { UserAccountService } from 'src/user-account/user-account.service';
import Decimal from 'decimal.js';

@Injectable()
export class HomeService {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    private readonly userAccountService: UserAccountService,
  ) { }

  /**
   * Get all home data
   * @param userId - The ID of the user
   * @param startDate - The start date in ISO format (optional)
   * @param endDate - The end date in ISO format (optional)
   */
  async findAll(userId: string, startDate?: string, endDate?: string) {
    // Get the user account to ensure it exists
    const userAccount = await this.userAccountService.findOneByUserId(userId);

    const hebdo = await this.getHebdo(userAccount.id);
    const last6Months = await this.getLast6MonthsData(userAccount.id);
    const byCategories = await this.getByCategoriesBetweenDates(
      userAccount.id,
      startDate ? dayjs(startDate) : undefined,
      endDate ? dayjs(endDate) : undefined,
    );

    return {
      hebdo: {
        total: hebdo.totalSum,
        perDay: hebdo.totalPerDay,
      },
      last6Months: {
        totalIncome: last6Months.totalIncome,
        totalExpense: last6Months.totalExpense,
        byMonth: last6Months.totalByMonth,
      },
      byCategories: {
        totalByCategory: byCategories.totalByCategory,
        startDate: byCategories.startDate,
        endDate: byCategories.endDate,
      },
    };
  }

  /**
   * Get the hebdo data
   * @param userId - The ID of the user
   */
  private async getHebdo(userAccountId: string) {
    const startOfWeek = dayjs().startOf('week').startOf('day').toDate();
    const endOfWeek = dayjs().endOf('week').endOf('day').toDate();

    const result = await this.db
      .select({
        id: schema.transactions.id,
        amount: schema.transactions.amount,
        transactionType: schema.transactions.transactionType,
        date: schema.transactions.date,
      })
      .from(schema.transactions)
      .where(and(
        eq(schema.transactions.userAccountId, userAccountId),
        gte(schema.transactions.date, startOfWeek),
        lte(schema.transactions.date, endOfWeek),
      ))
      .orderBy(schema.transactions.date);

    // Initialise un tableau vide pour totaliser par jour
    const totalPerDay: { date: Date; amount: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = dayjs(startOfWeek).add(i, 'day').startOf('day').toDate();
      totalPerDay.push({ date, amount: 0 });
    }

    for (const trx of result) {
      const date = dayjs(trx.date).startOf('day').toDate();

      const existing = totalPerDay.find(d => d.date.getTime() === date.getTime());

      if (existing) {
        if (trx.transactionType === 2) { // Only sum expenses
          existing.amount += trx.amount;
        }
      }
    }

    return {
      start: startOfWeek,
      end: endOfWeek,
      totalPerDay,
      totalSum: totalPerDay.reduce((sum, day) => sum + day.amount, 0),
    };
  }

  /**
   * Get data for last 6 months
   * @param userAccountId - The ID of the user
   */
  private async getLast6MonthsData(userAccountId: string) {
    const startDate = dayjs().subtract(5, 'month').startOf('month').toDate();
    const endDate = dayjs().endOf('month').toDate();

    const result = await this.db
      .select({
        id: schema.transactions.id,
        amount: schema.transactions.amount,
        date: schema.transactions.date,
        transactionType: schema.transactions.transactionType,
      })
      .from(schema.transactions)
      .where(and(
        eq(schema.transactions.userAccountId, userAccountId),
        gte(schema.transactions.date, startDate),
        lte(schema.transactions.date, endDate),
      ))
      .orderBy(schema.transactions.date);

    const totalByMonth: { month: string; income: number; expense: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const month = dayjs().subtract(5 - i, 'month').format('YYYY-MM');
      totalByMonth.push({ month, income: 0, expense: 0 });
    }

    for (const trx of result) {
      const month = dayjs(trx.date).format('YYYY-MM');
      const monthData = totalByMonth.find(m => m.month === month);
      if (!monthData) continue;

      if (trx.transactionType === 1) {
        monthData.income = Number(
          new Decimal(monthData.income).plus(trx.amount).toFixed(2)
        );
      } else if (trx.transactionType === 2) {
        monthData.expense = Number(
          new Decimal(monthData.expense).plus(trx.amount).toFixed(2)
        );
      }
    }

    return {
      totalByMonth,
      totalIncome: totalByMonth.reduce((sum, month) => sum + month.income, 0),
      totalExpense: totalByMonth.reduce((sum, month) => sum + month.expense, 0),
    };
  }

  /**
   * Get by categories between two dates
   * @param userAccountId - The ID of the user
   * @param startDate - The start date in ISO format
   * @param endDate - The end date in ISO format
   */
  private async getByCategoriesBetweenDates(
    userAccountId: string,
    startDate: Dayjs = dayjs().startOf('month'),
    endDate: Dayjs = dayjs().endOf('month')
  ) {
    // Verify the date format
    if (!dayjs(startDate).isValid() || !dayjs(endDate).isValid()) {
      throw new BadRequestException('Invalid date format. Use ISO format (YYYY-MM-DD).');
    }

    // Ensure startDate is before endDate
    if (dayjs(startDate).isAfter(endDate)) {
      throw new BadRequestException('Start date must be before end date.');
    }

    const result = await this.db
      .select({
        id: schema.transactions.id,
        amount: schema.transactions.amount,
        date: schema.transactions.date,
        transactionType: schema.transactions.transactionType,
        categoryId: schema.transactions.categoryId,
      })
      .from(schema.transactions)
      .where(and(
        eq(schema.transactions.userAccountId, userAccountId),
        gte(schema.transactions.date, startDate.toDate()),
        lte(schema.transactions.date, endDate.toDate()),
      ))
      .orderBy(schema.transactions.date);

    const totalByCategory: { categoryId: string; total: number }[] = [];

    for (const trx of result) {      
      // If the transaction type is expense, we only want to sum expense
      if (trx.transactionType === 2) {
        const existingExpenses = totalByCategory.find(c => c.categoryId === trx.categoryId && c.total > 0);
        if (existingExpenses) {
          existingExpenses.total = Number(
            new Decimal(existingExpenses.total).plus(trx.amount).toFixed(2)
          )
        } else {
          totalByCategory.push({ categoryId: trx.categoryId, total: trx.amount });
        }
      }
    }

    return {
      totalByCategory,
      startDate,
      endDate,
    }
  }
}
