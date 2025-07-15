import { Test, TestingModule } from '@nestjs/testing';
import { RecurringTransactionHelper } from './recurring-transaction.helper';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { RecurringTransactionService } from 'src/lib/bullmq/recurring-transaction/recurring-transaction.service';
import { BudgetService } from 'src/budget/budget.service';
import { UserAccountService } from 'src/user-account/user-account.service';
import { createMockDb } from '../../../__mock__/helpers/mockDb.helper';
import dayjs from 'dayjs';
import * as schema from 'src/db/schema';

describe('RecurringTransactionHelper', () => {
  let helper: RecurringTransactionHelper;
  let mockDb: any;
  let mockRecurringTransactionService: any;
  let mockBudgetService: any;
  let mockUserAccountService: any;

  beforeEach(async () => {
    mockDb = createMockDb();

    mockRecurringTransactionService = {
      scheduleRecurringTransaction: jest.fn().mockResolvedValue(null),
      cancelRecurringTransaction: jest.fn().mockResolvedValue(null),
    };

    mockBudgetService = {
      updateActualAmount: jest.fn().mockResolvedValue(null),
    };

    mockUserAccountService = {
      updateTotalAmount: jest.fn().mockResolvedValue({ amount: 1000 }),
      findOneByUserId: jest.fn().mockResolvedValue({ id: 'user-account-id', amount: 1000 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringTransactionHelper,
        {
          provide: DrizzleAsyncProvider,
          useValue: mockDb,
        },
        {
          provide: RecurringTransactionService,
          useValue: mockRecurringTransactionService,
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

    helper = module.get<RecurringTransactionHelper>(RecurringTransactionHelper);
    
    // Mock dayjs to always return a fixed date
    // Mock dayjs instance method instead of module function
    const mockDayjsInstance = dayjs();
    jest.spyOn(mockDayjsInstance, 'add').mockReturnValue(dayjs('2025-01-01'));
    jest.spyOn(dayjs.prototype, 'add').mockReturnValue(dayjs('2025-01-01'));
    jest.spyOn(dayjs.prototype, 'add').mockImplementation(() => dayjs('2025-02-01'));
    jest.spyOn(dayjs.prototype, 'isBefore').mockReturnValueOnce(true).mockReturnValueOnce(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getChildTransactionDescription', () => {
    it('should return "Recurring Transaction" when parentDescription is null', () => {
      const result = helper.getChildTransactionDescription(null);
      expect(result).toBe('Recurring Transaction');
    });

    it('should append " (Child)" to description when not already there', () => {
      const result = helper.getChildTransactionDescription('Test Transaction');
      expect(result).toBe('Test Transaction (Child)');
    });

    it('should not modify description when already contains (Child)', () => {
      const result = helper.getChildTransactionDescription('Test Transaction (Child)');
      expect(result).toBe('Test Transaction (Child)');
    });
  });

  describe('processRecurringTransactions', () => {
    it('should create child transactions for missed occurrences', async () => {
      const parentTransaction = {
        id: 'transaction-id',
        date: new Date('2025-01-01'),
        description: 'Test Transaction',
        amount: 100,
        categoryId: 'category-id',
        transactionType: 1,
        recurringFrequency: 'monthly',
        recurringStartDate: new Date('2025-01-01'),
        recurringEndDate: null,
      } as schema.Transaction;

      mockDb.insert.mockImplementation(() => mockDb);
      mockDb.values.mockImplementation(() => mockDb);
      mockDb.returning.mockResolvedValue([
        {
          ...parentTransaction,
          id: 'child-transaction-id',
          date: new Date('2025-02-01'),
          description: 'Test Transaction (Child)',
          recurringParentId: 'transaction-id',
        },
      ]);

      const result = await helper.processRecurringTransactions(parentTransaction, 'user-id');

      expect(mockDb.insert).toHaveBeenCalledWith(schema.transactions);
      expect(mockBudgetService.updateActualAmount).toHaveBeenCalled();
      expect(mockUserAccountService.updateTotalAmount).toHaveBeenCalled();
      
      expect(result).toEqual({
        lastTransactionDate: expect.any(Date),
        lastTransactionId: 'child-transaction-id',
        transaction: expect.objectContaining({
          id: 'child-transaction-id',
          description: 'Test Transaction (Child)',
        }),
      });
    });
  });

  describe('storeAndScheduleRecurringTransaction', () => {
    it('should store recurring transaction info and schedule it', async () => {
      const recurringResult = {
        transaction: {
          id: 'transaction-id',
          recurringParentId: null,
        } as schema.Transaction,
        lastTransactionDate: new Date('2025-02-01'),
        lastTransactionId: 'transaction-id',
      };

      mockDb.insert.mockImplementation(() => mockDb);
      mockDb.values.mockImplementation(() => mockDb);

      await helper.storeAndScheduleRecurringTransaction(
        recurringResult,
        'user-id',
        true
      );

      expect(mockRecurringTransactionService.scheduleRecurringTransaction).toHaveBeenCalledWith(
        recurringResult.transaction,
        'user-id',
        true
      );
      
      expect(mockDb.insert).toHaveBeenCalledWith(schema.transactionRecurringInfo);
      expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
        transactionParentId: 'transaction-id',
        lastTransactionDate: expect.any(Date),
        lastTransactionId: 'transaction-id',
      }));
    });
  });

  describe('stopRecurringTransactionLogic', () => {
    it('should stop a recurring transaction', async () => {
      const tx = createMockDb();

      tx.select.mockImplementation(() => tx);
      tx.from.mockImplementation(() => tx);
      tx.where.mockImplementation(() => tx);
      tx.orderBy.mockImplementation(() => tx);
      tx.limit.mockImplementation(() => tx);
      // Mock the promise resolution directly
      const mockPromise = Promise.resolve([{ 
        id: 'recurring-info-id',
        lastTransactionId: 'last-transaction-id' 
      }]);
      tx.limit.mockReturnValue(mockPromise);

      await helper.stopRecurringTransactionLogic('parent-id', tx);

      expect(mockRecurringTransactionService.cancelRecurringTransaction).toHaveBeenCalledWith('last-transaction-id');
      expect(tx.delete).toHaveBeenCalled();
      expect(tx.update).toHaveBeenCalledTimes(2); // Parent and children updates
    });

    it('should throw error if no child transactions found', async () => {
      const tx = createMockDb();

      tx.select.mockImplementation(() => tx);
      tx.from.mockImplementation(() => tx);
      tx.where.mockImplementation(() => tx);
      tx.orderBy.mockImplementation(() => tx);
      tx.limit.mockImplementation(() => tx);
      // Mock empty array return
      const mockEmptyPromise = Promise.resolve([]);
      tx.limit.mockReturnValue(mockEmptyPromise);

      await expect(helper.stopRecurringTransactionLogic('parent-id', tx))
        .rejects
        .toThrow('No child transactions found for this parent transaction');
    });
  });
});
