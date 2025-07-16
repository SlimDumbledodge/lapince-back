import { Test, TestingModule } from '@nestjs/testing';
import { UserAccountService } from './user-account.service';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotFoundException } from '@nestjs/common';
import * as schema from 'src/db/schema';
import { createMockDb } from '../../__mock__/helpers/mockDb.helper';
import { 
  mockUserAccount, 
  mockCreateUserAccountDto, 
  mockUpdateUserAccountDto, 
} from '../../__mock__/user-account';

describe('UserAccountService', () => {
  let service: UserAccountService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockNotificationsService: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    mockDb = createMockDb();

    mockNotificationsService = {
      create: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<NotificationsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAccountService,
        {
          provide: DrizzleAsyncProvider,
          useValue: mockDb,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<UserAccountService>(UserAccountService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user account', async () => {
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.returning.mockResolvedValue([mockUserAccount]);

      const userId = 'user-1';
      const result = await service.create(mockCreateUserAccountDto, userId);

      expect(mockDb.insert).toHaveBeenCalledWith(schema.userAccounts);
      expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        accountName: mockCreateUserAccountDto.accountName,
        amount: mockCreateUserAccountDto.amount,
        currency: mockCreateUserAccountDto.currency,
      }));
      expect(result).toEqual(mockUserAccount);
    });
  });

  describe('findAll', () => {
    it('should return an array of user accounts', async () => {
      const mockAccounts = [mockUserAccount];
      mockDb.select.mockReturnThis();
      mockDb.from.mockResolvedValue(mockAccounts);

      const result = await service.findAll();

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(schema.userAccounts);
      expect(result).toEqual(mockAccounts);
    });
  });

  describe('findOne', () => {
    it('should return a user account by id', async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue([mockUserAccount]);

      const result = await service.findOne(mockUserAccount.id);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(schema.userAccounts);
      expect(result).toEqual(mockUserAccount);
    });
  });

  describe('findOneByUserId', () => {
    it('should return a user account by userId', async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue([mockUserAccount]);

      const result = await service.findOneByUserId(mockUserAccount.userId);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(schema.userAccounts);
      expect(result).toEqual(mockUserAccount);
    });
  });

  describe('update', () => {
    it('should update a user account', async () => {
      const updatedAccount = { ...mockUserAccount, ...mockUpdateUserAccountDto };

      // Mock pour findOneByUserId
      const findSpy = jest.spyOn(service, 'findOneByUserId')
        .mockResolvedValue(mockUserAccount);

      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.returning.mockResolvedValue([updatedAccount]);

      const result = await service.update(mockUserAccount.userId, mockUpdateUserAccountDto);

      expect(findSpy).toHaveBeenCalledWith(mockUserAccount.userId);
      expect(mockDb.update).toHaveBeenCalledWith(schema.userAccounts);
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({
        ...mockUpdateUserAccountDto,
      }));
      expect(result).toEqual(updatedAccount);
    });

    it('should throw NotFoundException if user account not found', async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue([]);

      await expect(service.update('non-existent-id', mockUpdateUserAccountDto))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTotalAmount', () => {
    it('should update the total amount for income (type 1)', async () => {
      const initialAmount = mockUserAccount.amount;
      const transactionAmount = 500;
      const expectedNewAmount = initialAmount + transactionAmount;
      const updatedAccount = { 
        ...mockUserAccount, 
        amount: expectedNewAmount 
      };

      // Mock pour findOneByUserId
      const findSpy = jest.spyOn(service, 'findOneByUserId')
        .mockResolvedValue(mockUserAccount);

      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.returning.mockResolvedValue([updatedAccount]);

      const result = await service.updateTotalAmount(mockUserAccount.userId, 1, transactionAmount);

      expect(findSpy).toHaveBeenCalledWith(mockUserAccount.userId);
      expect(mockDb.update).toHaveBeenCalledWith(schema.userAccounts);
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({
        amount: expectedNewAmount,
      }));
      expect(result).toEqual(updatedAccount);
      expect(mockNotificationsService.create).not.toHaveBeenCalled();
    });

    it('should update the total amount for expense (type 2)', async () => {
      const initialAmount = mockUserAccount.amount;
      const transactionAmount = 200;
      const expectedNewAmount = initialAmount - transactionAmount;
      const updatedAccount = { 
        ...mockUserAccount, 
        amount: expectedNewAmount 
      };

      // Mock pour findOneByUserId
      const findSpy = jest.spyOn(service, 'findOneByUserId')
        .mockResolvedValue(mockUserAccount);

      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.returning.mockResolvedValue([updatedAccount]);

      const result = await service.updateTotalAmount(mockUserAccount.userId, 2, transactionAmount);

      expect(findSpy).toHaveBeenCalledWith(mockUserAccount.userId);
      expect(mockDb.update).toHaveBeenCalledWith(schema.userAccounts);
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({
        amount: expectedNewAmount,
      }));
      expect(result).toEqual(updatedAccount);
      expect(mockNotificationsService.create).not.toHaveBeenCalled();
    });

    it('should send notification if balance becomes negative', async () => {
      const initialAmount = 100;
      const transactionAmount = 200;
      const expectedNewAmount = initialAmount - transactionAmount;
      const updatedAccount = { 
        ...mockUserAccount, 
        amount: expectedNewAmount 
      };

      // Mock pour findOneByUserId
      const mockUserAccountWithAmount = { ...mockUserAccount, amount: initialAmount };
      const findSpy = jest.spyOn(service, 'findOneByUserId')
        .mockResolvedValue(mockUserAccountWithAmount);

      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.returning.mockResolvedValue([updatedAccount]);

      const result = await service.updateTotalAmount(mockUserAccount.userId, 2, transactionAmount);

      expect(findSpy).toHaveBeenCalledWith(mockUserAccount.userId);
      expect(mockDb.update).toHaveBeenCalledWith(schema.userAccounts);
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({
        amount: expectedNewAmount,
      }));
      expect(result).toEqual(updatedAccount);
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warning',
          type: 'reminder',
          message: `Your account balance is negative: ${expectedNewAmount} EUR.`,
        }),
        mockUserAccount.userId
      );
    });

    it('should handle notification service error', async () => {
      const initialAmount = 100;
      const transactionAmount = 200;
      const expectedNewAmount = initialAmount - transactionAmount;
      const updatedAccount = { 
        ...mockUserAccount, 
        amount: expectedNewAmount 
      };

      // Mock pour findOneByUserId
      const mockUserAccountWithAmount = { ...mockUserAccount, amount: initialAmount };
      const findSpy = jest.spyOn(service, 'findOneByUserId')
        .mockResolvedValue(mockUserAccountWithAmount);

      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.returning.mockResolvedValue([updatedAccount]);

      mockNotificationsService.create.mockRejectedValue(new Error('Notification error'));

      // Spy on the logger
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      
      const result = await service.updateTotalAmount(mockUserAccount.userId, 2, transactionAmount);

      expect(findSpy).toHaveBeenCalledWith(mockUserAccount.userId);
      expect(result).toEqual(updatedAccount);
      expect(mockNotificationsService.create).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('Error sending notification:', expect.any(Error));
    });

    it('should throw NotFoundException if user account not found', async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue([]);

      await expect(service.updateTotalAmount('non-existent-id', 1, 100))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a user account', async () => {
      mockDb.delete.mockReturnThis();
      mockDb.where.mockResolvedValue(undefined);

      await service.remove(mockUserAccount.id);

      expect(mockDb.delete).toHaveBeenCalledWith(schema.userAccounts);
      expect(mockDb.where).toHaveBeenCalled();
    });
  });
});
