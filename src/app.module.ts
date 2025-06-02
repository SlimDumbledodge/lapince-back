import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DrizzleModule } from './db/drizzle/drizzle.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import {AuthModule} from './auth/auth.module';
import {AuthMiddleware} from "./auth/auth.middleware";
import { UserAccountModule } from './user-account/user-account.module';
import { BudgetModule } from './budget/budget.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CategoriesModule } from './categories/categories.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT ?? "6379", 10) || 6379,
      },
    }),
    DrizzleModule,
    UsersModule,
    AuthModule,
    UserAccountModule,
    BudgetModule,
    TransactionsModule,
    CategoriesModule,
    NotificationsModule
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): any {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        'auth/(.*)'
      )
      .forRoutes('*');
  }
}
