import { Module, forwardRef } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { DrizzleModule } from 'src/db/drizzle/drizzle.module';
import { UserAccountModule } from 'src/user-account/user-account.module';
import { CategoriesModule } from 'src/categories/categories.module';
import { BudgetModule } from 'src/budget/budget.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { RecurringTransactionModule } from 'src/lib/bullmq/reccuring-transaction/reccuring-transaction.module';

@Module({
  imports: [
    DrizzleModule, 
    UserAccountModule, 
    CategoriesModule, 
    BudgetModule,
    NotificationsModule,
    forwardRef(() => RecurringTransactionModule),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
