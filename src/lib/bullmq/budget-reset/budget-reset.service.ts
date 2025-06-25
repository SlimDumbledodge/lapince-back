import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import * as schema from "../../../db/schema"
import { convertFrequencyToDayjsPeriod } from "src/common/convert/convert-frequency";
import dayjs, { ManipulateType } from "dayjs";

@Injectable()
export class BudgetResetService {
  constructor(@InjectQueue('budgetReset') private queue: Queue) {}

  async scheduleBudgetReset(budget: schema.Budget) {
    if (!budget.recurringFrequency) {
      throw new Error("Budget does not have a recurring frequency set.");
    }

    const { value: frequencyValue, unit: frequencyUnit } = convertFrequencyToDayjsPeriod(budget.recurringFrequency);

    const delay = this.calculateNextResetDelay(budget.lastResetDate, { value: frequencyValue, unit: frequencyUnit });

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

  private calculateNextResetDelay(lastResetDate: string | Date, frequencyInDays: { value: number; unit: ManipulateType }): number {
    const now = dayjs();
    const last = dayjs(lastResetDate);

    const nextReset = last.add(frequencyInDays.value, frequencyInDays.unit);
    if (nextReset.isBefore(now)) {
      // If the next reset is in the past, we need to schedule it for the next period
      nextReset.add(frequencyInDays.value, frequencyInDays.unit);
    }

    // Set the time to midnight
    nextReset.startOf('day');

    const delay = nextReset.diff(now, 'milliseconds');
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