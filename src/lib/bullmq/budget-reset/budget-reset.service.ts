import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import * as schema from "../../../db/schema"

@Injectable()
export class BudgetResetService {
  constructor(@InjectQueue('budgetReset') private queue: Queue) {}

  async scheduleBudgetReset(budget: schema.Budget) {
    const delay = this.calculateNextResetDelay(budget.lastResetDate, budget.recurringFrequency ?? 30);

    await this.queue.add(
      'reset-budget',
      { budgetId: budget.id },
      {
        delay,
        jobId: `budget-${budget.id}`,
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

  private calculateNextResetDelay(lastResetDate: string | Date, frequencyInDays: number): number {
    const now = new Date();
    const last = new Date(lastResetDate);
    
    const nextReset = new Date(last.getTime() + frequencyInDays * 24 * 60 * 60 * 1000);
  
    // Set the time to midnight
    nextReset.setHours(0, 0, 0, 0);
  
    const delay = nextReset.getTime() - now.getTime();
    return delay > 0 ? delay : 0;
  }

  async removeBudgetResetJob(budgetId: string) {
    const jobId = `budget-${budgetId}`;
    const job = await this.queue.getJob(jobId);
    
    if (job) {
      await job.remove();
    }
  }
}