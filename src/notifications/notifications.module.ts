import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { DrizzleModule } from 'src/db/drizzle/drizzle.module';
import { SlackModule } from 'src/slack/slack.module';

@Module({
  imports: [DrizzleModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
