import { Module, forwardRef } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { RecurringTransactionService } from "./recurring-transaction.service";
import { RecurringTransactionProcessor } from "./recurring-transaction.processor";
import { TransactionsModule } from "src/transactions/transactions.module";
import { TransactionInitService } from "./transaction-init.service";
import { DrizzleModule } from "src/db/drizzle/drizzle.module";
import { BullBoardModule } from "@bull-board/nestjs";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'recurringTransaction',
    }),
    forwardRef(() => TransactionsModule),
    DrizzleModule,
    BullBoardModule.forFeature({
      name: 'recurringTransaction',
      adapter: BullMQAdapter,
    }),
  ],
  providers: [RecurringTransactionService, RecurringTransactionProcessor, TransactionInitService],
  exports: [RecurringTransactionService],
})
export class RecurringTransactionModule {}