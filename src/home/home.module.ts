import { Module } from '@nestjs/common';
import { HomeService } from './home.service';
import { HomeController } from './home.controller';
import { DrizzleModule } from 'src/db/drizzle/drizzle.module';
import { UserAccountModule } from 'src/user-account/user-account.module';

@Module({
  imports: [DrizzleModule, UserAccountModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
