import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { DrizzleModule } from 'src/db/drizzle/drizzle.module';
import { UserAccountModule } from 'src/user-account/user-account.module';

@Module({
  imports: [DrizzleModule, UserAccountModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
