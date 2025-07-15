import { Module, forwardRef } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { DrizzleModule } from 'src/db/drizzle/drizzle.module';
import { UserAccountModule } from 'src/user-account/user-account.module';
import { CategoriesModule } from 'src/categories/categories.module';
import { BudgetModule } from 'src/budget/budget.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { RecurringTransactionModule } from 'src/lib/bullmq/recurring-transaction/recurring-transaction.module';
import { RecurringTransactionHelper } from './services/recurring-transaction.helper';
import { TransactionFinderService } from './services/transaction-finder.service';
import { TransactionUpdateService } from './services/transaction-update.service';

/**
 * Module for transaction management
 */
@Module({
  imports: [
    DrizzleModule, 
    UserAccountModule,
    CategoriesModule,
    forwardRef(() => BudgetModule),
    NotificationsModule,
    forwardRef(() => RecurringTransactionModule),
  ],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    RecurringTransactionHelper,
    TransactionFinderService,
    TransactionUpdateService
  ],
  exports: [
    TransactionsService,
    RecurringTransactionHelper,
    TransactionFinderService
  ],
})
export class TransactionsModule {}
