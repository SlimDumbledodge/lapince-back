import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Inject } from "@nestjs/common";
import * as schema from "../../../db/schema"
import { RecurringTransactionService } from "./recurring-transaction.service";
import { TransactionsService } from "src/transactions/transactions.service";

@Processor('recurringTransaction')
export class RecurringTransactionProcessor extends WorkerHost {

  constructor(
    @Inject(RecurringTransactionService) private recurringTransactionService: RecurringTransactionService,
    @Inject(TransactionsService) private transactionsService: TransactionsService,
  ) {
    super();
  }

  /**
   * Process a job for recurring transactions
   * @param job
   */
  async process(job: Job<{ transactionParentId: string, userId: string }>) {
    const { transactionParentId, userId } = job.data;

    // create the child transactions
    const transaction = await this.transactionsService.createChildTransactions(transactionParentId, userId);

    if (!transaction) {
      return;
    }

    // reschedule the next recurring transaction job for each child transaction
    await this.recurringTransactionService.scheduleRecurringTransaction(transaction, userId, false);
  }
}