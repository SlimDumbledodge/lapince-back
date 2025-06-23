import { Controller, Get, Post, Body, Patch, Param, UsePipes, ParseUUIDPipe, Query, Delete } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationDto, UpdateNotificationSchema } from './dto/update-notification.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { User, UserEntity } from '../decorator/user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get all notifications for the current user
   * @param isRead
   * @param page
   * @param limit
   * @returns 
   */
  @Get()
  findAll(
    @User() user: UserEntity,
    @Query('isRead') isRead: boolean = false,
    @Query('page') page: number = 0,
    @Query('limit') limit: number = 10
  ) {
    return this.notificationsService.findAll(user.id, isRead, limit, page);
  }

  /**
   * Get a notification by id
   * @param id 
   * @returns 
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @User() user: UserEntity,) {
    return this.notificationsService.findOne(id, user.id);
  }

  /**
   * Update a notification
   * @param id 
   * @param updateNotificationDto 
   * @returns 
   */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body(new ZodValidationPipe(UpdateNotificationSchema)) updateNotificationDto: UpdateNotificationDto,
    @User() user: UserEntity,
  ) {
    return this.notificationsService.update(id, updateNotificationDto, user.id);
  }

  /**
   * Update multiple notifications
   * @param updateNotificationDto
   * 
   */

  /**
   * Delete a notification
   * @param id
   * @returns
   */
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @User() user: UserEntity,) {
    return this.notificationsService.remove(id, user.id);
  }
}
