import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DrizzleAsyncProvider } from "src/db/drizzle/drizzle.provider";
import * as schema from "src/db/schema";
import { eq } from "drizzle-orm";
import { RecurringTransactionService } from "./recurring-transaction.service";

@Injectable()
export class TransactionInitService implements OnModuleInit {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(RecurringTransactionService) private readonly reccuringTransactionService: RecurringTransactionService,
  ) { }

  async onModuleInit() {
    const trx = await this.db.select({
        transaction: schema.transactions,
        transactionRecurringInfo: schema.transactionRecurringInfo,
      })
      .from(schema.transactionRecurringInfo)
      .leftJoin(schema.transactions, eq(schema.transactionRecurringInfo.lastTransactionId, schema.transactions.id))

    const accounts = await this.db.select().from(schema.userAccounts);

    for (const transaction of trx) {

      if (!transaction.transaction) {
        console.warn(`Transaction not found for recurring info ${transaction.transactionRecurringInfo.id}`);
        continue;
      }

      const account = accounts.find(acc => acc.id === transaction.transaction?.userAccountId);
      if (!account) {
        console.warn(`Account not found for transaction ${transaction.transaction?.id}`);
        continue;
      } else {
        await this.reccuringTransactionService.scheduleRecurringTransaction(transaction.transaction, account.userId, true);
      }
    }
  }
}