import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { DrizzleModule } from 'src/db/drizzle/drizzle.module';
import { UserAccountModule } from 'src/user-account/user-account.module';
import { CategoriesModule } from 'src/categories/categories.module';

@Module({
  imports: [DrizzleModule, UserAccountModule, CategoriesModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
