import { Test, TestingModule } from '@nestjs/testing';
import { TransactionUpdateService } from './transaction-update.service';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { BudgetService } from 'src/budget/budget.service';
import { UserAccountService } from 'src/user-account/user-account.service';
import { createMockDb } from '../../../__mock__/helpers/mockDb.helper';
import { BadRequestException } from '@nestjs/common';
import * as schema from 'src/db/schema';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';

describe('TransactionUpdateService', () => {
  let service: TransactionUpdateService;
  let mockDb: any;
  let mockBudgetService: any;
  let mockUserAccountService: any;

  beforeEach(async () => {
    mockDb = createMockDb();
    
    mockBudgetService = {
      updateActualAmount: jest.fn().mockResolvedValue(null),
    };

    mockUserAccountService = {
      updateTotalAmount: jest.fn().mockResolvedValue({ amount: 1000 }),
      findOneByUserId: jest.fn().mockResolvedValue({ id: 'user-account-id', amount: 1000 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionUpdateService,
        {
          provide: DrizzleAsyncProvider,
          useValue: mockDb,
        },
        {
          provide: BudgetService,
          useValue: mockBudgetService,
        },
        {
          provide: UserAccountService,
          useValue: mockUserAccountService,
        },
      ],
    }).compile();

    service = module.get<TransactionUpdateService>(TransactionUpdateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateChildTransactionUpdate', () => {
    it('should throw when trying to update recurring properties on a child transaction', () => {
      const transaction = {
        id: 'tx-1',
        recurringParentId: 'parent-id',
      } as schema.Transaction;

      const updateDto = {
        isRecurring: true,
      } as UpdateTransactionDto;

      expect(() => service.validateChildTransactionUpdate(transaction, updateDto))
        .toThrow(BadRequestException);
    });

    it('should throw when trying to change category of a child transaction', () => {
      const transaction = {
        id: 'tx-1',
        recurringParentId: 'parent-id',
        categoryId: 'category-1',
      } as schema.Transaction;

      const updateDto = {
        categoryId: 'category-2',
      } as UpdateTransactionDto;

      expect(() => service.validateChildTransactionUpdate(transaction, updateDto))
        .toThrow(BadRequestException);
    });

    it('should throw when trying to change transaction type of a child transaction', () => {
      const transaction = {
        id: 'tx-1',
        recurringParentId: 'parent-id',
        transactionType: 1,
      } as schema.Transaction;

      const updateDto = {
        transactionType: 2,
      } as UpdateTransactionDto;

      expect(() => service.validateChildTransactionUpdate(transaction, updateDto))
        .toThrow(BadRequestException);
    });

    it('should not throw for valid update on a child transaction', () => {
      const transaction = {
        id: 'tx-1',
        recurringParentId: 'parent-id',
        categoryId: 'category-1',
        transactionType: 1,
      } as schema.Transaction;

      const updateDto = {
        amount: 200,
        description: 'Updated description',
      } as UpdateTransactionDto;

      expect(() => service.validateChildTransactionUpdate(transaction, updateDto))
        .not.toThrow();
    });
  });

  describe('handleAmountUpdate', () => {
    it('should return 0 when amount is not changing', async () => {
      const transaction = {
        id: 'tx-1',
        amount: 100,
      } as schema.Transaction;

      const updateDto = {
        description: 'Updated description',
      } as UpdateTransactionDto;

      const result = await service.handleAmountUpdate(
        transaction,
        updateDto,
        'user-id',
        mockDb,
        false
      );

      expect(result).toBe(0);
      expect(mockBudgetService.updateActualAmount).not.toHaveBeenCalled();
    });

    it('should handle simple amount update for a non-recurring transaction', async () => {
      const transaction = {
        id: 'tx-1',
        amount: 100,
        categoryId: 'category-1',
        date: new Date('2025-01-01'),
      } as schema.Transaction;

      const updateDto = {
        amount: 150,
      } as UpdateTransactionDto;

      mockDb.update.mockImplementation(() => mockDb);
      mockDb.set.mockImplementation(() => mockDb);
      mockDb.where.mockImplementation(() => mockDb);
      mockDb.returning.mockResolvedValue([]);

      const result = await service.handleAmountUpdate(
        transaction,
        updateDto,
        'user-id',
        mockDb,
        false
      );

      expect(result).toBe(50); // Difference between new and old amount
      expect(mockBudgetService.updateActualAmount).toHaveBeenCalledWith(
        'category-1',
        'user-id',
        2, // Positive change
        50, // Absolute difference
        expect.any(Date),
        mockDb
      );
    });
  });

  describe('handleCategoryUpdate', () => {
    it('should do nothing when category is not changing', async () => {
      const transaction = {
        id: 'tx-1',
        categoryId: 'category-1',
      } as schema.Transaction;

      const updateDto = {
        description: 'Updated description',
      } as UpdateTransactionDto;

      await service.handleCategoryUpdate(
        transaction,
        updateDto,
        'user-id',
        mockDb
      );

      expect(mockBudgetService.updateActualAmount).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should handle simple category change for a non-recurring transaction', async () => {
      const transaction = {
        id: 'tx-1',
        amount: 100,
        categoryId: 'old-category',
        transactionType: 1,
        date: new Date('2025-01-01'),
      } as schema.Transaction;

      const updateDto = {
        categoryId: 'new-category',
      } as UpdateTransactionDto;

      await service.handleCategoryUpdate(
        transaction,
        updateDto,
        'user-id',
        mockDb
      );

      // Should update old category (negative)
      expect(mockBudgetService.updateActualAmount).toHaveBeenCalledWith(
        'old-category',
        'user-id',
        1,
        -100,
        expect.any(Date),
        mockDb
      );

      // Should update new category (positive)
      expect(mockBudgetService.updateActualAmount).toHaveBeenCalledWith(
        'new-category',
        'user-id',
        1,
        100,
        expect.any(Date),
        mockDb
      );
    });
  });
});
