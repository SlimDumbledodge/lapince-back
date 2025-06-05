import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DrizzleAsyncProvider } from "src/db/drizzle/drizzle.provider";
import * as schema from "src/db/schema";
import { eq } from "drizzle-orm";
import { RecurringTransactionService } from "./reccuring-transaction.service";

@Injectable()
export class TransactionInitService implements OnModuleInit {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(RecurringTransactionService) private readonly reccuringTransactionService: RecurringTransactionService,
  ) { }

  async onModuleInit() {
    const trx = await this.db.select({
        transaction: schema.transactions,
      })
      .from(schema.transactionReccuringInfo)
      .leftJoin(schema.transactions, eq(schema.transactionReccuringInfo.lastTransactionId, schema.transactions.id))

    const accounts = await this.db.select().from(schema.userAccounts);

    for (const transaction of trx) {
      const account = accounts.find(acc => acc.id === transaction.transaction.userAccountId);
      if (!account) {
        console.warn(`Account not found for transaction ${transaction.transaction.id}`);
        continue;
      } else {
        await this.reccuringTransactionService.scheduleRecurringTransaction(transaction.transaction, account.userId, true);
      }
    }
  }
}