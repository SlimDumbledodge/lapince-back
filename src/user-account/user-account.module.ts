import { Module } from '@nestjs/common';
import { UserAccountService } from './user-account.service';
import { UserAccountController } from './user-account.controller';
import { DrizzleModule } from 'src/db/drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [UserAccountController],
  providers: [UserAccountService],
})
export class UserAccountModule {}
