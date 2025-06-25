import { Module, forwardRef } from "@nestjs/common";
import { BudgetInitService } from "./budget-init.service";
import { BudgetResetService } from "./budget-reset.service";
import { BudgetResetProcessor } from "./budget-reset.processor";
import { DrizzleModule } from "src/db/drizzle/drizzle.module";
import { BullModule } from "@nestjs/bullmq";
import { BudgetModule } from "src/budget/budget.module";
import { BullBoardModule } from "@bull-board/nestjs";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";

@Module({
  imports: [
    DrizzleModule,
    forwardRef(() => BudgetModule),
    BullModule.registerQueue({
      name: 'budgetReset',
    }),
    BullBoardModule.forFeature({
      name: 'budgetReset',
      adapter: BullMQAdapter,
    }),
  ],
  providers: [BudgetInitService, BudgetResetService, BudgetResetProcessor], 
  exports: [BudgetResetService]
})
export class BudgetResetModule {}