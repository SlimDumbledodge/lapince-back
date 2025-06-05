import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { NotFoundException } from '@nestjs/common';
import { UserAccountService } from '../user-account/user-account.service';
import { CategoriesService } from '../categories/categories.service';
import { BudgetService } from '../budget/budget.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecurringTransactionService } from '../lib/bullmq/reccuring-transaction/reccuring-transaction.service';
import * as schema from '../db/schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';

const transactionReturnTest : schema.NewTransaction = {
  userAccountId: 'test-user-account-id',
  amount: 100,
  transactionType: 2,
  date: new Date(),
  description: 'Test transaction',
  categoryId: 'test-category-id',
  reccuringParentId: null,
  isRecurring: false,
  reccuringFrequency: null,
  reccuringStartDate: null,
  reccuringEndDate: null,
  metadata: {},
};

const storeTransactionTest: CreateTransactionDto = {
  transactionType: 2,
  amount: 5,
  date: "2025-06-05",
  description: "Transaction test récurrente",
  categoryId: "3e81c274-a0f3-469b-933e-543abd9d2df4",
}

describe('TransactionsService', () => {
  let service: TransactionsService;
  let db: any;
  let userAccountService: any;
  let categoriesService: any;
  let budgetService: any;
  let notificationsService: any;
  let recurringTransactionService: any;

  beforeEach(async () => {
    db = { transaction: jest.fn(), select: jest.fn(), insert: jest.fn(), update: jest.fn(), delete: jest.fn() };
    userAccountService = { findOneByUserId: jest.fn(), updateTotalAmount: jest.fn(), findOne: jest.fn() };
    categoriesService = { findOne: jest.fn() };
    budgetService = { updateActualAmount: jest.fn() };
    notificationsService = { create: jest.fn() };
    recurringTransactionService = { scheduleRecurringTransaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: 'DrizzleAsyncProvider', useValue: db },
        { provide: UserAccountService, useValue: userAccountService },
        { provide: CategoriesService, useValue: categoriesService },
        { provide: BudgetService, useValue: budgetService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: RecurringTransactionService, useValue: recurringTransactionService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * CREATE
   */
  describe('create', () => {
    it('should return NotFoundException if userAccount is not found', async () => {
      const userId = 'test-user-id';

      userAccountService.findOneByUserId.mockResolvedValue(null);

      await expect(service.findAll(userId)).rejects.toThrow(NotFoundException);
    });

    it('should return NotFoundException if category is not found', async () => {
      const userId = 'test-user-id';

      userAccountService.findOneByUserId.mockResolvedValue({ id: 'test-user-account-id' });
      categoriesService.findOne.mockResolvedValue(null);

      await expect(service.create(storeTransactionTest, userId)).rejects.toThrow(NotFoundException);
    });
  })

  /**
   * FIND ALL
   */
  describe('findAll', () => {
    it('should return NotFoundException if userAccount is not found', async () => {
      const userId = 'test-user-id';

      userAccountService.findOneByUserId.mockResolvedValue(null);

      await expect(service.findAll(userId)).rejects.toThrow(NotFoundException);
    });
  });
});
