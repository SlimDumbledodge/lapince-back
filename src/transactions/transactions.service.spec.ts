import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { UserAccountService } from 'src/user-account/user-account.service';
import { CategoriesService } from 'src/categories/categories.service';
import { BudgetService } from 'src/budget/budget.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { RecurringTransactionHelper } from './services/recurring-transaction.helper';
import { TransactionFinderService } from './services/transaction-finder.service';
import { TransactionUpdateService } from './services/transaction-update.service';
import { createMockDb } from './../../__mock__/helpers/mockDb.helper';
import { NotFoundException } from '@nestjs/common';
import * as schema from 'src/db/schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let mockDb: any;
  let mockUserAccountService: any;
  let mockCategoriesService: any;
  let mockBudgetService: any;
  let mockNotificationsService: any;
  let mockRecurringTransactionHelper: any;
  let mockTransactionFinderService: any;
  let mockTransactionUpdateService: any;

  beforeEach(async () => {
    mockDb = createMockDb();
    
    mockUserAccountService = {
      findOneByUserId: jest.fn().mockResolvedValue({ id: 'user-account-id', amount: 1000 }),
      updateTotalAmount: jest.fn().mockResolvedValue({ amount: 1100 }),
    };

    mockCategoriesService = {
      findOne: jest.fn().mockResolvedValue({ id: 'category-id', name: 'Category 1' }),
    };

    mockBudgetService = {
      updateActualAmount: jest.fn().mockResolvedValue(null),
    };

    mockNotificationsService = {
      create: jest.fn().mockResolvedValue(null),
    };

    mockRecurringTransactionHelper = {
      processRecurringTransactions: jest.fn().mockResolvedValue({
        lastTransactionDate: new Date('2025-02-01'),
        lastTransactionId: 'child-tx-id',
        transaction: { id: 'child-tx-id', amount: 100 },
      }),
      storeAndScheduleRecurringTransaction: jest.fn().mockResolvedValue(null),
      getChildTransactionDescription: jest.fn().mockReturnValue('Child Transaction'),
      convertToRecurring: jest.fn().mockResolvedValue({ id: 'user-account-id', amount: 1100 }),
      handleRecurringChildRemoval: jest.fn().mockResolvedValue(null),
      stopRecurringTransactionLogic: jest.fn().mockResolvedValue(null),
    };

    mockTransactionFinderService = {
      findAll: jest.fn().mockResolvedValue({
        data: [{ id: 'tx-1', amount: 100 }],
        total: 1,
        limit: 10,
        page: 0,
        lastPage: 0,
      }),
      findAllByCategoryId: jest.fn().mockResolvedValue([
        { id: 'tx-1', amount: 100, categoryId: 'category-id' },
      ]),
      findOne: jest.fn().mockResolvedValue({
        id: 'tx-1',
        amount: 100,
        categoryId: 'category-id',
        transactionType: 1,
        date: new Date('2025-01-01'),
        description: 'Test Transaction',
        isRecurring: false,
      }),
    };

    mockTransactionUpdateService = {
      validateChildTransactionUpdate: jest.fn(),
      handleAmountUpdate: jest.fn().mockResolvedValue(50),
      handleCategoryUpdate: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: DrizzleAsyncProvider,
          useValue: mockDb,
        },
        {
          provide: UserAccountService,
          useValue: mockUserAccountService,
        },
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
        {
          provide: BudgetService,
          useValue: mockBudgetService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: RecurringTransactionHelper,
          useValue: mockRecurringTransactionHelper,
        },
        {
          provide: TransactionFinderService,
          useValue: mockTransactionFinderService,
        },
        {
          provide: TransactionUpdateService,
          useValue: mockTransactionUpdateService,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserAccount', () => {
    it('should return user account when it exists', async () => {
      const result = await (service as any).getUserAccount('user-id');
      expect(result).toEqual({ id: 'user-account-id', amount: 1000 });
      expect(mockUserAccountService.findOneByUserId).toHaveBeenCalledWith('user-id');
    });

    it('should throw NotFoundException when user account not found', async () => {
      mockUserAccountService.findOneByUserId.mockResolvedValueOnce(null);
      
      await expect((service as any).getUserAccount('user-id'))
        .rejects
        .toThrow(new NotFoundException('User account not found'));
    });
  });

  describe('create', () => {
    it('should create a new transaction', async () => {
      const createDto: CreateTransactionDto = {
        amount: 100,
        transactionType: 1,
        categoryId: 'category-id',
        description: 'Test Transaction',
        date: '2025-01-01',
        isRecurring: false,
      };

      mockDb.transaction.mockImplementation((callback) => callback(mockDb));
      mockDb.insert.mockImplementation(() => mockDb);
      mockDb.values.mockImplementation(() => mockDb);
      mockDb.returning.mockResolvedValue([{
        id: 'tx-1',
        ...createDto,
        date: new Date('2025-01-01'),
        userAccountId: 'user-account-id',
        createdAt: new Date(),
      }]);

      const result = await service.create(createDto, 'user-id');
      
      expect(result).toEqual({
        transaction: expect.objectContaining({
          id: 'tx-1',
          amount: 100,
        }),
        totalUserAccountAmount: 1100,
      });

      expect(mockUserAccountService.findOneByUserId).toHaveBeenCalledWith('user-id');
      expect(mockCategoriesService.findOne).toHaveBeenCalledWith('category-id', 'user-id');
      expect(mockDb.insert).toHaveBeenCalledWith(schema.transactions);
      expect(mockBudgetService.updateActualAmount).toHaveBeenCalled();
      expect(mockUserAccountService.updateTotalAmount).toHaveBeenCalledWith('user-id', 1, 100);
    });

    it('should handle recurring transactions', async () => {
      const createDto: CreateTransactionDto = {
        amount: 100,
        transactionType: 1,
        categoryId: 'category-id',
        description: 'Recurring Transaction',
        date: '2025-01-01',
        isRecurring: true,
        recurringFrequency: 'monthly',
      };

      mockDb.transaction.mockImplementation((callback) => callback(mockDb));
      mockDb.insert.mockImplementation(() => mockDb);
      mockDb.values.mockImplementation(() => mockDb);
      mockDb.returning.mockResolvedValue([{
        id: 'tx-1',
        ...createDto,
        date: new Date('2025-01-01'),
        userAccountId: 'user-account-id',
        createdAt: new Date(),
      }]);

      await service.create(createDto, 'user-id');
      
      expect(mockRecurringTransactionHelper.processRecurringTransactions).toHaveBeenCalled();
      expect(mockRecurringTransactionHelper.storeAndScheduleRecurringTransaction).toHaveBeenCalled();
    });
  });

  describe('createChildTransactions', () => {
    it('should create a child transaction from a parent transaction', async () => {
      const parentTransaction = {
        id: 'parent-id',
        amount: 100,
        categoryId: 'category-id',
        transactionType: 1,
        description: 'Parent Transaction',
        date: new Date('2025-01-01'),
        isRecurring: true,
      };

      mockTransactionFinderService.findOne.mockResolvedValueOnce(parentTransaction);
      
      mockDb.transaction.mockImplementation((callback) => callback(mockDb));
      mockDb.insert.mockImplementation(() => mockDb);
      mockDb.values.mockImplementation(() => mockDb);
      mockDb.returning.mockResolvedValue([{
        ...parentTransaction,
        id: 'child-id',
        description: 'Child Transaction',
        recurringParentId: 'parent-id',
        date: new Date(),
        createdAt: new Date(),
      }]);

      mockDb.update.mockImplementation(() => mockDb);
      mockDb.set.mockImplementation(() => mockDb);
      mockDb.where.mockImplementation(() => mockDb);

      const result = await service.createChildTransactions('parent-id', 'user-id');
      
      expect(result.id).toBe('child-id');
      expect(result.recurringParentId).toBe('parent-id');
      
      expect(mockTransactionFinderService.findOne).toHaveBeenCalledWith('parent-id', 'user-id');
      expect(mockCategoriesService.findOne).toHaveBeenCalledWith('category-id', 'user-id');
      expect(mockDb.insert).toHaveBeenCalledWith(schema.transactions);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockBudgetService.updateActualAmount).toHaveBeenCalled();
      expect(mockUserAccountService.updateTotalAmount).toHaveBeenCalled();
      expect(mockNotificationsService.create).toHaveBeenCalled();
    });
  });

  describe('findAll, findAllByCategoryId, findOne', () => {
    it('should call transactionFinderService.findAll', async () => {
      await service.findAll('user-id', 10, 0);
      expect(mockTransactionFinderService.findAll).toHaveBeenCalledWith('user-id', 10, 0);
    });

    it('should call transactionFinderService.findAllByCategoryId', async () => {
      await service.findAllByCategoryId('category-id', 'user-id', new Date('2025-01-01'));
      expect(mockTransactionFinderService.findAllByCategoryId).toHaveBeenCalledWith('category-id', 'user-id', new Date('2025-01-01'));
    });

    it('should call transactionFinderService.findOne', async () => {
      await service.findOne('tx-1', 'user-id');
      expect(mockTransactionFinderService.findOne).toHaveBeenCalledWith('tx-1', 'user-id');
    });
  });

  describe('update', () => {
    it('should update a transaction', async () => {
      const updateDto: UpdateTransactionDto = {
        amount: 150,
        description: 'Updated Transaction',
      };

      mockDb.transaction.mockImplementation((callback) => callback(mockDb));
      mockDb.update.mockImplementation(() => mockDb);
      mockDb.set.mockImplementation(() => mockDb);
      mockDb.where.mockImplementation(() => mockDb);
      mockDb.returning.mockResolvedValue([{
        id: 'tx-1',
        amount: 150,
        description: 'Updated Transaction',
        categoryId: 'category-id',
        transactionType: 1,
        date: new Date('2025-01-01'),
        isRecurring: false,
      }]);

      const result = await service.update('tx-1', updateDto, 'user-id');
      
      expect(result.amount).toBe(150);
      expect(result.description).toBe('Updated Transaction');
      
      expect(mockTransactionFinderService.findOne).toHaveBeenCalledWith('tx-1', 'user-id');
      expect(mockTransactionUpdateService.validateChildTransactionUpdate).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockTransactionUpdateService.handleAmountUpdate).toHaveBeenCalled();
      expect(mockUserAccountService.updateTotalAmount).toHaveBeenCalled();
    });

    it('should handle transition to recurring transaction', async () => {
      const updateDto: UpdateTransactionDto = {
        isRecurring: true,
        recurringFrequency: 'monthly',
      };

      const nonRecurringTransaction = {
        id: 'tx-1',
        amount: 100,
        categoryId: 'category-id',
        transactionType: 1,
        isRecurring: false,
      };

      mockTransactionFinderService.findOne.mockResolvedValueOnce(nonRecurringTransaction);
      
      mockDb.transaction.mockImplementation((callback) => callback(mockDb));
      mockDb.update.mockImplementation(() => mockDb);
      mockDb.set.mockImplementation(() => mockDb);
      mockDb.where.mockImplementation(() => mockDb);
      mockDb.returning.mockResolvedValue([{
        ...nonRecurringTransaction,
        isRecurring: true,
        recurringFrequency: 'monthly',
      }]);

      await service.update('tx-1', updateDto, 'user-id');
      
      expect(mockRecurringTransactionHelper.convertToRecurring).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a transaction', async () => {
      const transaction = {
        id: 'tx-1',
        amount: 100,
        categoryId: 'category-id',
        transactionType: 1,
        isRecurring: false,
        date: new Date('2025-01-01'),
      };

      mockTransactionFinderService.findOne.mockResolvedValueOnce(transaction);
      
      mockDb.transaction.mockImplementation((callback) => callback(mockDb));
      mockDb.delete.mockImplementation(() => mockDb);
      mockDb.where.mockImplementation(() => mockDb);
      
      const result = await service.remove('tx-1', 'user-id', false);
      
      expect(result.message).toBe('Transaction removed successfully');
      
      expect(mockDb.delete).toHaveBeenCalledWith(schema.transactions);
      expect(mockBudgetService.updateActualAmount).toHaveBeenCalled();
      expect(mockUserAccountService.updateTotalAmount).toHaveBeenCalledWith('user-id', 1, 100);
    });

    it('should handle orphaning child transactions', async () => {
      const transaction = {
        id: 'parent-id',
        isRecurring: false,
      };

      mockTransactionFinderService.findOne.mockResolvedValueOnce(transaction);
      
      mockDb.transaction.mockImplementation((callback) => callback(mockDb));
      mockDb.delete.mockImplementation(() => mockDb);
      mockDb.update.mockImplementation(() => mockDb);
      mockDb.set.mockImplementation(() => mockDb);
      mockDb.where.mockImplementation(() => mockDb);
      
      await service.remove('parent-id', 'user-id', false);
      
      // Should mark child transactions as orphaned
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ isOrphaned: true }));
    });
  });

  describe('stopRecurringTransaction', () => {
    it('should stop a recurring transaction', async () => {
      const transaction = {
        id: 'tx-1',
        isRecurring: true,
        recurringParentId: null,
      };

      mockTransactionFinderService.findOne.mockResolvedValueOnce(transaction);
      
      mockDb.transaction.mockImplementation((callback) => callback(mockDb));
      
      const result = await service.stopRecurringTransaction('tx-1', 'user-id');
      
      expect(result.message).toBe('Recurring transaction stopped successfully');
      
      expect(mockRecurringTransactionHelper.stopRecurringTransactionLogic).toHaveBeenCalledWith('tx-1', mockDb);
    });

    it('should handle stopping child recurring transaction', async () => {
      const childTransaction = {
        id: 'child-id',
        isRecurring: true,
        recurringParentId: 'parent-id',
      };

      const parentTransaction = {
        id: 'parent-id',
        isRecurring: true,
        recurringParentId: null,
      };

      mockTransactionFinderService.findOne
        .mockResolvedValueOnce(childTransaction)
        .mockResolvedValueOnce(parentTransaction);
      
      mockDb.transaction.mockImplementation((callback) => callback(mockDb));
      
      await service.stopRecurringTransaction('child-id', 'user-id');
      
      expect(mockRecurringTransactionHelper.stopRecurringTransactionLogic).toHaveBeenCalledWith('parent-id', mockDb);
    });

    it('should throw when transaction is not recurring', async () => {
      const transaction = {
        id: 'tx-1',
        isRecurring: false,
      };

      mockTransactionFinderService.findOne.mockResolvedValueOnce(transaction);
      
      await expect(service.stopRecurringTransaction('tx-1', 'user-id'))
        .rejects
        .toThrow(new NotFoundException('Transaction is not a recurring transaction'));
    });
  });
});
