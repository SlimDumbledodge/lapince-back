import { Injectable, Inject } from '@nestjs/common';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import dayjs from 'dayjs';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
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
   */
  async findAll(userId: string) {
    // Get the user account to ensure it exists
    const userAccount = await this.userAccountService.findOneByUserId(userId);

    const hebdo = await this.getHebdo(userAccount.id);
    const last6Months = await this.getLast6MonthsData(userAccount.id);

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
        existing.amount += trx.amount;
      } else {
        totalPerDay.push({ date, amount: trx.amount });
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
  async getLast6MonthsData(userAccountId: string) {
    const startDate = dayjs().subtract(5, 'month').startOf('month').toDate();
    const endDate = dayjs().endOf('month').toDate();

    const result = await this.db
      .select({
        id: schema.transactions.id,
        amount: schema.transactions.amount,
        date: schema.transactions.date,
        transactionsType: schema.transactions.transactionsType,
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

      if (trx.transactionsType === 1) {
        monthData.income = Number(
          new Decimal(monthData.income).plus(trx.amount).toFixed(2)
        );
      } else if (trx.transactionsType === 2) {
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
}
