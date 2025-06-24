import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import * as schema from "../../../db/schema"

@Injectable()
export class RecurringTransactionService {
  private readonly logger = new Logger(RecurringTransactionService.name);

  constructor(@InjectQueue('recurringTransaction') private queue: Queue) {}

  /**
   * Schedule a recurring transaction
   * @param transactionId
   * @param userId
   * @param isParent
   * @returns
   */
  async scheduleRecurringTransaction(transaction: schema.Transaction, userId: string, isParent: boolean = true) {
    if (!isParent && transaction.recurringParentId === null) {
      this.logger.error("Cannot schedule a child transaction without a parent ID", { transactionId: transaction.id });
      throw new Error("Cannot schedule a child transaction without a parent ID");
    }

    const parentId = isParent ? transaction.id : transaction.recurringParentId;

    const delay = this.calculateNextTransactionDelay(transaction.date, transaction.recurringFrequency ?? 30, transaction.recurringEndDate);

    if (delay === 0) {
      this.logger.debug(`No further transactions scheduled for ${transaction.id} as the end date has passed or the next transaction is in the past.`);
      return;
    }

    await this.queue.add(
      'create-child-transactions',
      { transactionParentId: parentId, userId: userId },
      {
        delay, 
        jobId: `transaction-${transaction.id}`,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    );
  }

  private calculateNextTransactionDelay(lastTransactionDate: string | Date, frequencyInDays: number, endDate: Date | null): number {
    const now = new Date();
    const last = new Date(lastTransactionDate);
    
    const nextTransaction = new Date(last.getTime() + frequencyInDays * 24 * 60 * 60 * 1000);

    if (endDate && new Date(endDate) < nextTransaction) {
      this.logger.debug(`Recurring transaction ended on ${endDate}. No further transactions will be scheduled.`);
      return 0; // No further transactions if the end date has passed
    }
  
    const delay = nextTransaction.getTime() - now.getTime();
    return delay > 0 ? delay : 0;
  }

  async cancelRecurringTransaction(transactionId: string) {
    this.logger.debug(`Cancelling recurring transaction for ID: ${transactionId}`);
    
    // Remove the job from the queue if it exists
    const jobId = `transaction-${transactionId}`;
    const job = await this.queue.getJob(jobId);
    
    if (job) {
      await job.remove();
      this.logger.debug(`Recurring transaction job ${jobId} removed from the queue.`);
    } else {
      this.logger.debug(`No recurring transaction job found for ID: ${transactionId}`);
    }
  }
}