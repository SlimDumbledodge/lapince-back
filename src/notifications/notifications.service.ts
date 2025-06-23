import { Injectable, Inject, BadRequestException, Optional } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto, UpdateMultipleNotificationsDto } from './dto/update-notification.dto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import * as schema from 'src/db/schema';
import { eq, and, or, desc, count, inArray } from 'drizzle-orm';
import { SlackService } from 'src/slack/slack.service';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Optional() @Inject(SlackService) private readonly slackService?: SlackService
  ) {}

  /**
   * Create a new notification
   * @param userId
   * @param createNotificationDto 
   * @returns 
   */
  async create(createNotificationDto: CreateNotificationDto, userId: string): Promise<schema.Notification> {
    const notification = await this.db.insert(schema.notifications).values({
      ...createNotificationDto,
      userId,
      createdAt: new Date(),
    }).returning();

    // If Slack integration is enabled, send a notification to Slack
    if (this.slackService) {
      // TODO : Implement a more structured message format with levels, attachments and user mentions
      await this.slackService.postToSlack(`New notification for user ${userId}: ${createNotificationDto.message}`);
    }

    return notification[0];
  }

  /**
   * Find all notifications for a user
   * @param userId
   * @param isRead
   * @param limit
   * @param page
   * @returns 
   */
  async findAll(userId: string, isRead: boolean, limit: number, page: number): Promise<{data: schema.Notification[], limit: number, page: number, total: number}> {
    const conditions = [eq(schema.notifications.userId, userId)];

    if (!isRead) {
      conditions.push(eq(schema.notifications.isRead, false));
    }
  
    const result = await this.db
      .select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit)
      .offset(page * limit);

    // get the total count of notifications for the user
    const totalCount = await this.db
      .select({ count: count() })
      .from(schema.notifications)
      .where(and(...conditions));
  
    return {
      data: result,
      limit,
      page,
      total: totalCount[0].count,
    };
  }

  /**
   * Find a notification by id
   * @param id 
   * @param userId
   * @returns 
   */
  async findOne(id: string, userId: string): Promise<schema.Notification> {
    const result = await this.db.select().from(schema.notifications).where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, userId)));

    if (result.length === 0) {
      throw new BadRequestException('Notification not found');
    }

    return result[0];
  }

  /**
   * Update a notification status
   * @param id 
   * @param updateNotificationDto 
   * @param userId
   * @returns 
   */
  async update(id: string, updateNotificationDto: UpdateNotificationDto, userId: string): Promise<schema.Notification> {
    // Verify if the user can update the notification
    const notification = await this.findOne(id, userId);
    if (notification.isRead) {
      throw new BadRequestException('Notification already read');
    }

    const result = await this.db.update(schema.notifications).set({
      ...updateNotificationDto,
      updatedAt: new Date(),
    }).where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, userId))).returning();

    return result[0];
  }

  /**
   * Update multiple notifications
   * @param updateNotificationDto 
   * @param userId
   * @returns 
   */
  async updateMultiple(updateNotificationDto: UpdateMultipleNotificationsDto, userId: string): Promise<schema.Notification[]> {
    if (updateNotificationDto.ids.length === 0) {
      throw new BadRequestException('No notification IDs provided');
    }

    const notifications = await this.db
      .select()
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, userId), inArray(schema.notifications.id, updateNotificationDto.ids)));

    if (notifications.length !== updateNotificationDto.ids.length) {
      throw new BadRequestException('Some notifications not found or do not belong to the user');
    }

    const result = await this.db
      .update(schema.notifications)
      .set({
        isRead: updateNotificationDto.isRead,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.notifications.userId, userId), inArray(schema.notifications.id, updateNotificationDto.ids)))
      .returning();

    return result;
  }

  /**
   * Delete a notification
   * @param id 
   * @param userId
   * @returns 
   */
  async remove(id: string, userId: string): Promise<void>  {
    await this.findOne(id, userId);

    return this.db
      .delete(schema.notifications)
      .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, userId)))
      .then(() => undefined);
  }
}
