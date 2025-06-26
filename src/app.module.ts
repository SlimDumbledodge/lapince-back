import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
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
import { BudgetResetModule } from './lib/bullmq/budget-reset/budget-reset.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MailModule } from './mail/mail.module';
import { HomeModule } from './home/home.module';
import { SlackModule } from './slack/slack.module';
import { BullBoardModule } from "@bull-board/nestjs";
import { ExpressAdapter } from "@bull-board/express";
import basicAuth from "express-basic-auth";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      useFactory: async () => ({
        connection: {
          host: process.env.CACHE_HOST,
          port: parseInt(process.env.CACHE_PORT?? "6379", 10) || 6379,
          password: process.env.CACHE_PASSWORD,
          db: parseInt(process.env.CACHE_DB?? "0", 10) || 0,
        },
      }),
    }),
    BullBoardModule.forRoot({
      adapter: ExpressAdapter,
      route: '/admin/queues',
      middleware: basicAuth({
        challenge: true,
        users: { admin: "admin" },
      }),
    }),
    ScheduleModule.forRoot(),
    DrizzleModule,
    UsersModule,
    AuthModule,
    UserAccountModule,
    BudgetModule,
    TransactionsModule,
    CategoriesModule,
    NotificationsModule,
    BudgetResetModule,
    MailModule,
    HomeModule,
    SlackModule.register({
      enable: process.env.SLACK_ENABLED === 'true',
      isGlobal: true,
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): any {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'auth/signup', method: RequestMethod.POST },
        { path: 'auth/signin', method: RequestMethod.POST },
        { path: 'auth/token/refresh', method: RequestMethod.POST },
        { path: 'auth/forgot-password', method: RequestMethod.POST },
        { path: 'auth/reset-password', method: RequestMethod.POST },
        { path: '/admin/queues', method: RequestMethod.ALL }, // Exclude Bull Board routes
        { path: 'google-oauth/google-auth', method: RequestMethod.GET },
        { path: 'google-oauth/google-callback', method: RequestMethod.GET },
      )
      .forRoutes({
        path: '*splat',
        method: RequestMethod.ALL,
      });
  }
}
