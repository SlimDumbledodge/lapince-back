import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DrizzleModule } from 'src/db/drizzle/drizzle.module';
import { UserAccountModule } from 'src/user-account/user-account.module';

@Module({
  imports: [DrizzleModule, UserAccountModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
