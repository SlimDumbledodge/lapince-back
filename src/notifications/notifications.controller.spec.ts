import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { mockNotification, mockNotifications } from '../../__mock__/notifications';
import { UserEntity } from '../decorator/user.decorator';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  const mockUser: UserEntity = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    accountType: 'in-app',
    avatar: 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
    locale: 'fr-FR',
    firstLogin: true,
    verifiedEmail: false,
    password: 'hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date(),
    accountId: 'account-1',
    accountName: 'My Account',
    amount: 1000
  };

  const mockNotificationService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateMultiple: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all notifications for a user', async () => {
      const result = {
        data: mockNotifications,
        limit: 10,
        page: 0,
        total: 2,
      };
      mockNotificationService.findAll.mockResolvedValue(result);

      expect(await controller.findAll(mockUser, false, 0, 10)).toBe(result);
      expect(mockNotificationService.findAll).toHaveBeenCalledWith(mockUser.id, false, 10, 0);
    });

    it('should use default values', async () => {
      const result = {
        data: mockNotifications,
        limit: 10,
        page: 0,
        total: 2,
      };
      mockNotificationService.findAll.mockResolvedValue(result);

      expect(await controller.findAll(mockUser)).toBe(result);
      expect(mockNotificationService.findAll).toHaveBeenCalledWith(mockUser.id, false, 10, 0);
    });
  });

  describe('findOne', () => {
    it('should return a notification by id', async () => {
      mockNotificationService.findOne.mockResolvedValue(mockNotification);

      expect(await controller.findOne('notification-1', mockUser)).toBe(mockNotification);
      expect(mockNotificationService.findOne).toHaveBeenCalledWith('notification-1', mockUser.id);
    });
  });

  describe('update', () => {
    it('should update a notification', async () => {
      const updateDto = { isRead: true };
      mockNotificationService.update.mockResolvedValue({ ...mockNotification, isRead: true });

      expect(await controller.update('notification-1', updateDto, mockUser)).toEqual({ 
        ...mockNotification, 
        isRead: true 
      });
      expect(mockNotificationService.update).toHaveBeenCalledWith('notification-1', updateDto, mockUser.id);
    });
  });

  describe('updateMultiple', () => {
    it('should update multiple notifications', async () => {
      const updateDto = { ids: ['notification-1', 'notification-2'], isRead: true };
      const updatedNotifications = mockNotifications.map(n => ({ ...n, isRead: true }));
      mockNotificationService.updateMultiple.mockResolvedValue(updatedNotifications);

      expect(await controller.updateMultiple(updateDto, mockUser)).toEqual(updatedNotifications);
      expect(mockNotificationService.updateMultiple).toHaveBeenCalledWith(updateDto, mockUser.id);
    });
  });

  describe('remove', () => {
    it('should remove a notification', async () => {
      mockNotificationService.remove.mockResolvedValue(undefined);

      expect(await controller.remove('notification-1', mockUser)).toBeUndefined();
      expect(mockNotificationService.remove).toHaveBeenCalledWith('notification-1', mockUser.id);
    });
  });
});
