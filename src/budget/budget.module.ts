import { Module, forwardRef } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { BudgetController } from './budget.controller';
import { DrizzleModule } from 'src/db/drizzle/drizzle.module';
import { CategoriesModule } from 'src/categories/categories.module';
import { BudgetResetModule } from 'src/lib/bullmq/budget-reset/budget-reset.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [DrizzleModule, CategoriesModule, forwardRef(() =>BudgetResetModule), NotificationsModule],
  controllers: [BudgetController],
  providers: [BudgetService],
  exports: [BudgetService]
})
export class BudgetModule {}
