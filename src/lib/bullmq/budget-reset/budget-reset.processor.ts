import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Inject, forwardRef } from "@nestjs/common";
import * as schema from "../../../db/schema"
import { BudgetResetService } from "./budget-reset.service";
import { BudgetService } from "src/budget/budget.service";

@Processor('budgetReset')
export class BudgetResetProcessor extends WorkerHost {

  constructor(
    @Inject(BudgetResetService) private budgetResetService: BudgetResetService,
    @Inject(BudgetService) private budgetService: BudgetService,  
  ) {
    super();
  }

  /**
   * Add a job to the queue for the budget reset
   * @param job 
   * @returns 
   */
  async process(job: Job<{budgetId: string}>) {
    const budget = await this.budgetService.resetActualAmount(job.data.budgetId);

    if (!budget) {
      return;
    }

    // reschedule the next reset job
    await this.budgetResetService.scheduleBudgetReset(budget);
  }
}