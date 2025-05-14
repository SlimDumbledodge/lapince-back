import { Module } from '@nestjs/common';
import { DrizzleModule } from './db/drizzle/drizzle.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DrizzleModule,
  ],
})
export class AppModule {}
