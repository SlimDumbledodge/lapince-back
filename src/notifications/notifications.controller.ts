import { Controller, Get, Post, Body, Patch, Param, UsePipes, ParseUUIDPipe, Req, Query, BadRequestException, Delete } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationDto, UpdateNotificationSchema } from './dto/update-notification.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { Request } from 'express';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get all notifications for the current user
   * @param req
   * @param isRead
   * @param page
   * @param limit
   * @returns 
   */
  @Get('user')
  findAll(
    @Req() req: Request,
    @Query('isRead') isRead: boolean = false,
    @Query('page') page: number = 0,
    @Query('limit') limit: number = 10
  ) {
    const user = req['user']
    if (!user || !user.id) {
      throw new BadRequestException('User not found')
    }
    return this.notificationsService.findAll(user.id, isRead, limit, page);
  }

  /**
   * Get a notification by id
   * @param id 
   * @param req
   * @returns 
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req['user']
    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }
    return this.notificationsService.findOne(id, user.id);
  }

  /**
   * Update a notification
   * @param id 
   * @param updateNotificationDto 
   * @param req
   * @returns 
   */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body(new ZodValidationPipe(UpdateNotificationSchema)) updateNotificationDto: UpdateNotificationDto,
    @Req() req: Request
  ) {
    const user = req['user']
    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }
    return this.notificationsService.update(id, updateNotificationDto, user.id);
  }

  /**
   * Delete a notification
   * @param id
   * @param req
   * @returns
   */
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req['user']
    if (!user ||!user.id) {
      throw new BadRequestException('User not found')
    }
    return this.notificationsService.remove(id, user.id);
  }
}
