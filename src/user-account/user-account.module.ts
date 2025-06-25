import { Module } from '@nestjs/common';
import { UserAccountService } from './user-account.service';
import { UserAccountController } from './user-account.controller';
import { DrizzleModule } from 'src/db/drizzle/drizzle.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [DrizzleModule, NotificationsModule],
  controllers: [UserAccountController],
  providers: [UserAccountService],
  exports: [UserAccountService],
})
export class UserAccountModule {}
