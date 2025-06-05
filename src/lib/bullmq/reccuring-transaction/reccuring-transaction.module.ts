import { Module, forwardRef } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { RecurringTransactionService } from "./reccuring-transaction.service";
import { RecurringTransactionProcessor } from "./reccuring-transaction.processor";
import { TransactionsModule } from "src/transactions/transactions.module";
import { TransactionInitService } from "./transaction-init.service";
import { DrizzleModule } from "src/db/drizzle/drizzle.module";

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'recurringTransaction',
    }),
    forwardRef(() => TransactionsModule),
    DrizzleModule,
  ],
  providers: [RecurringTransactionService, RecurringTransactionProcessor, TransactionInitService],
  exports: [RecurringTransactionService],
})
export class RecurringTransactionModule {}