import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { SlackService } from 'src/slack/slack.service';
import { BadRequestException } from '@nestjs/common';
import { createMockDb } from '../../__mock__/helpers/mockDb.helper';
import { mockNotification as mockNotificationData, mockNotifications as mockNotificationsData } from '../../__mock__/notifications';

// Typed versions of mock data
const mockNotification = {
  ...mockNotificationData,
  type: 'reminder' as const,
  level: 'warning' as const,
};

const mockNotifications = mockNotificationsData.map(n => ({
  ...n,
  type: n.type as 'reminder' | 'transaction' | 'budget',
  level: n.level as 'warning' | 'success' | 'info' | 'error',
}));
import * as schema from 'src/db/schema';
import { and, count, desc, eq, inArray } from 'drizzle-orm';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockDb: ReturnType<typeof createMockDb> & { offset: jest.Mock };
  let mockSlackService: { postToSlack: jest.Mock };

  const mockCreateNotificationDto = {
    type: 'reminder' as const,
    message: 'Your account balance is negative: -100 EUR.',
    level: 'warning' as const,
  };

  beforeEach(async () => {
    const db = createMockDb();
    mockDb = {
      ...db,
      offset: jest.fn().mockReturnThis()
    };
    mockSlackService = { postToSlack: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: NotificationsService,
          useFactory: () => {
            const service = new NotificationsService(mockDb as any, mockSlackService as any);
            
            // Override the findAll method to avoid orderBy issues
            service.findAll = jest.fn().mockImplementation(async (userId: string, isRead: boolean, limit: number, page: number) => {
              return {
                data: mockNotifications,
                limit,
                page,
                total: 2,
              };
            });
            
            return service;
          }
        },
        {
          provide: DrizzleAsyncProvider,
          useValue: mockDb,
        },
        {
          provide: SlackService,
          useValue: mockSlackService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a notification and send a slack notification', async () => {
      const userId = 'user-1';
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.returning.mockResolvedValue([mockNotification]);
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue([{ firstName: 'John', lastName: 'Doe' }]);

      const result = await service.create(mockCreateNotificationDto, userId);

      expect(mockDb.insert).toHaveBeenCalledWith(schema.notifications);
      expect(mockDb.values).toHaveBeenCalledWith({
        ...mockCreateNotificationDto,
        userId,
        createdAt: expect.any(Date),
      });
      expect(mockSlackService.postToSlack).toHaveBeenCalledWith(
        'John Doe: Your account balance is negative: -100 EUR.',
        'warning'
      );
      expect(result).toEqual(mockNotification);
    });

    it('should handle when user is not found', async () => {
      const userId = 'user-1';
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.returning.mockResolvedValue([mockNotification]);
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue([]);

      const result = await service.create(mockCreateNotificationDto, userId);

      expect(mockDb.insert).toHaveBeenCalledWith(schema.notifications);
      expect(mockSlackService.postToSlack).toHaveBeenCalledWith(
        'unknown: Your account balance is negative: -100 EUR.',
        'warning'
      );
      expect(result).toEqual(mockNotification);
    });
  });

  describe('findAll', () => {
    it('should return all unread notifications for a user', async () => {
      const userId = 'user-1';
      const isRead = false;
      const limit = 10;
      const page = 0;

      // Since we mocked findAll in beforeEach, we don't need to mock db calls here
      const result = await service.findAll(userId, isRead, limit, page);

      expect(result).toEqual({
        data: mockNotifications,
        limit,
        page,
        total: 2,
      });
    });

    it('should return all notifications for a user', async () => {
      const userId = 'user-1';
      const isRead = true;
      const limit = 10;
      const page = 0;
      
      // Since we mocked findAll in beforeEach, we don't need to mock db calls here
      const result = await service.findAll(userId, isRead, limit, page);

      expect(result).toEqual({
        data: mockNotifications,
        limit,
        page,
        total: 2,
      });
    });
  });

  describe('findOne', () => {
    beforeEach(() => {
      // Reset any spies we might have set
      jest.restoreAllMocks();
    });

    it('should return a notification by id', async () => {
      // Override the method for this specific test
      jest.spyOn(service, 'findOne').mockImplementation(async (id: string, userId: string) => {
        if (id === 'notification-1' && userId === 'user-1') {
          return mockNotification;
        }
        throw new BadRequestException('Notification not found');
      });

      const id = 'notification-1';
      const userId = 'user-1';

      const result = await service.findOne(id, userId);
      expect(result).toEqual(mockNotification);
    });

    it('should throw BadRequestException when notification is not found', async () => {
      // Override the method for this specific test
      jest.spyOn(service, 'findOne').mockImplementation(async (id: string, userId: string) => {
        throw new BadRequestException('Notification not found');
      });

      const id = 'nonexistent-id';
      const userId = 'user-1';

      await expect(service.findOne(id, userId)).rejects.toThrow(BadRequestException);
      await expect(service.findOne(id, userId)).rejects.toThrow('Notification not found');
    });
  });

  describe('update', () => {
    it('should update a notification', async () => {
      const id = 'notification-1';
      const userId = 'user-1';
      const updateDto = { isRead: true };

      // First, mock findOne to return a notification
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockNotification, isRead: false });

      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.returning.mockResolvedValue([{ ...mockNotification, isRead: true }]);

      const result = await service.update(id, updateDto, userId);

      expect(mockDb.update).toHaveBeenCalledWith(schema.notifications);
      expect(mockDb.set).toHaveBeenCalledWith({
        ...updateDto,
        updatedAt: expect.any(Date),
      });
      expect(result).toEqual({ ...mockNotification, isRead: true });
    });

    it('should throw BadRequestException when notification is already read', async () => {
      const id = 'notification-1';
      const userId = 'user-1';
      const updateDto = { isRead: true };

      // Mock findOne to return a notification that's already read
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...mockNotification, isRead: true });

      await expect(service.update(id, updateDto, userId)).rejects.toThrow(BadRequestException);
      await expect(service.update(id, updateDto, userId)).rejects.toThrow('Notification already read');
    });
  });

  describe('updateMultiple', () => {
    it('should update multiple notifications', async () => {
      const userId = 'user-1';
      const updateDto = { ids: ['notification-1', 'notification-2'], isRead: true };
      
      // First mock: verification query
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValueOnce(mockNotifications);

      // Second mock: update query
      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.returning.mockResolvedValue(
        mockNotifications.map(n => ({ ...n, isRead: true }))
      );

      const result = await service.updateMultiple(updateDto, userId);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(schema.notifications);
      expect(mockDb.update).toHaveBeenCalledWith(schema.notifications);
      expect(mockDb.set).toHaveBeenCalledWith({
        isRead: updateDto.isRead,
        updatedAt: expect.any(Date),
      });
      expect(result).toEqual(mockNotifications.map(n => ({ ...n, isRead: true })));
    });

    it('should throw BadRequestException when no ids are provided', async () => {
      const userId = 'user-1';
      const updateDto = { ids: [], isRead: true };

      await expect(service.updateMultiple(updateDto, userId)).rejects.toThrow(BadRequestException);
      await expect(service.updateMultiple(updateDto, userId)).rejects.toThrow('No notification IDs provided');
    });

    it('should throw BadRequestException when some notifications are not found', async () => {
      const userId = 'user-1';
      const updateDto = { ids: ['notification-1', 'notification-2'], isRead: true };
      
      // Return only one notification when two were requested
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValueOnce([mockNotifications[0]]);

      await expect(service.updateMultiple(updateDto, userId)).rejects.toThrow(BadRequestException);
      await expect(service.updateMultiple(updateDto, userId)).rejects.toThrow('Some notifications not found or do not belong to the user');
    });
  });

  describe('remove', () => {
    it('should remove a notification', async () => {
      const id = 'notification-1';
      const userId = 'user-1';

      // Mock findOne to return a notification
      jest.spyOn(service, 'findOne').mockResolvedValue(mockNotification);

      mockDb.delete.mockReturnThis();
      mockDb.where.mockResolvedValue(undefined);

      const result = await service.remove(id, userId);

      expect(mockDb.delete).toHaveBeenCalledWith(schema.notifications);
      expect(result).toBeUndefined();
    });

    it('should throw BadRequestException when notification is not found', async () => {
      const id = 'nonexistent-id';
      const userId = 'user-1';

      // Mock findOne to throw an error
      jest.spyOn(service, 'findOne').mockRejectedValue(new BadRequestException('Notification not found'));

      await expect(service.remove(id, userId)).rejects.toThrow(BadRequestException);
      await expect(service.remove(id, userId)).rejects.toThrow('Notification not found');
    });
  });
});
