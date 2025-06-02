import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DrizzleAsyncProvider } from "src/db/drizzle/drizzle.provider";
import * as schema from "src/db/schema";
import { eq } from "drizzle-orm";
import { BudgetResetService } from "./budget-reset.service";

@Injectable()
export class BudgetInitService implements OnModuleInit  {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(BudgetResetService) private readonly budgetResetService: BudgetResetService,
  ) {}

  async onModuleInit() {
    const budgets = await this.db.select().from(schema.budgets);
    for (const budget of budgets) {
      await this.budgetResetService.scheduleBudgetReset(budget);
    }
  }
}