import { Test, TestingModule } from '@nestjs/testing';
import { BudgetService } from './budget.service';
import { CategoriesService } from 'src/categories/categories.service';
import { BudgetResetService } from 'src/lib/bullmq/budget-reset/budget-reset.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { NotFoundException } from '@nestjs/common';
import { createMockDb } from '../../__mock__/helpers/mockDb.helper';
import { mockBudgetsResult } from '../../__mock__/budget';
import * as schema from 'src/db/schema';

describe('BudgetService', () => {
  let service: BudgetService;
  let db: any;
  let mockCategoriesService: any;
  let mockBudgetResetService: any;
  let mockNotificationsService: any;

  let mockTransactionsService: any;

  beforeEach(async () => {
    db = createMockDb();
    db.orderBy = jest.fn().mockReturnValue(db); // Ajout de orderBy au mock
    
    mockCategoriesService = { findOne: jest.fn()};
    mockBudgetResetService = { 
      scheduleBudgetReset: jest.fn(),
      removeBudgetResetJob: jest.fn()
    };
    mockNotificationsService = { create: jest.fn() };
    mockTransactionsService = { 
      findAllByCategoryId: jest.fn().mockResolvedValue([
        { amount: 100, transactionType: 1 }, // Revenu
        { amount: 200, transactionType: 2 }  // Dépense
      ]) 
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: DrizzleAsyncProvider, useValue: db },
        { provide: CategoriesService, useValue: mockCategoriesService },
        { provide: BudgetResetService, useValue: mockBudgetResetService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: 'TransactionsService', useValue: mockTransactionsService },
        BudgetService
      ],
    }).overrideProvider(BudgetService).useFactory({
      factory: () => {
        return new BudgetService(
          db,
          mockCategoriesService,
          mockBudgetResetService,
          mockNotificationsService,
          mockTransactionsService
        );
      }
    }).compile();

    service = module.get<BudgetService>(BudgetService);

    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /******************
   *     CREATE     *
   *****************/

  describe('create', () => {
    const userId = 'user-1';
    const dto: CreateBudgetDto = {
      categoryId: 'cat-1',
      totalAmount: 500,
      recurringFrequency: 'weekly',
    };

    it('should throw if category is not found', async () => {
      mockCategoriesService.findOne.mockResolvedValue(null);

      await expect(service.create(dto, userId)).rejects.toThrow(NotFoundException);
      expect(mockCategoriesService.findOne).toHaveBeenCalledWith(dto.categoryId, userId);
    });

    it('should throw if budget already exists', async () => {
      mockCategoriesService.findOne.mockResolvedValue({ id: 'cat-1' });
      jest.spyOn(service, 'findOneByCategoryId').mockResolvedValue({ id: 'budget-1' } as any);

      await expect(service.create(dto, userId)).rejects.toThrow(NotFoundException);
    });

    it('should create and return a new budget', async () => {
      mockCategoriesService.findOne.mockResolvedValue({ id: 'cat-1', name: 'Food' });
      jest.spyOn(service, 'findOneByCategoryId').mockResolvedValue(null);

      // Simuler le toDate() sur l'objet dayjs
      mockTransactionsService.findAllByCategoryId.mockImplementation(() => {
        return Promise.resolve([
          { amount: 100, transactionType: 1 }, // Revenu
          { amount: 200, transactionType: 2 }  // Dépense
        ]);
      });

      const insertedBudget = {
        id: 'budget-1',
        ...dto,
        userId,
        actualAmount: 100,  // 200 - 100 = 100
        lastResetDate: expect.any(String),
        createdAt: expect.any(Date),
      };

      db.insert.mockReturnValue(db);
      db.values.mockReturnValue(db);
      db.returning.mockResolvedValue([insertedBudget]);

      const result = await service.create(dto, userId);

      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalled();
      expect(db.returning).toHaveBeenCalled();
      expect(result).toEqual(insertedBudget);
      expect(mockBudgetResetService.scheduleBudgetReset).toHaveBeenCalledWith(insertedBudget);
    });

    it('should not schedule a reset if no recurringFrequency', async () => {
      const noRecurringDto = { ...dto, recurringFrequency: undefined };
      
      // Simuler le toDate() sur l'objet dayjs
      mockTransactionsService.findAllByCategoryId.mockImplementation(() => {
        return Promise.resolve([
          { amount: 100, transactionType: 1 }, // Revenu
          { amount: 200, transactionType: 2 }  // Dépense
        ]);
      });

      mockCategoriesService.findOne.mockResolvedValue({ id: 'cat-1' });
      jest.spyOn(service, 'findOneByCategoryId').mockResolvedValue(null);

      const insertedBudget = {
        id: 'budget-1',
        ...noRecurringDto,
        userId,
        lastResetDate: expect.any(String),
        createdAt: expect.any(Date),
      };

      db.insert.mockReturnValue(db);
      db.values.mockReturnValue(db);
      db.returning.mockReturnValue(Promise.resolve([insertedBudget]));

      const result = await service.create(noRecurringDto, userId);

      expect(mockBudgetResetService.scheduleBudgetReset).not.toHaveBeenCalled();
    });
  });

  /******************
   *     FIND ALL    *
   *****************/

  describe('findAllByUserId', () => {
    it('should return all budgets for a user', async () => {
      const userId = 'user-1';
      const budgets = [
        { id: 'budget-1', userId, categoryId: 'cat-1', totalAmount: 500 },
        { id: 'budget-2', userId, categoryId: 'cat-2', totalAmount: 300 },
      ];

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.orderBy.mockReturnValue(Promise.resolve(budgets));

      const result = await service.findAllByUserId(userId);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(schema.budgets);
      expect(db.where).toHaveBeenCalled();
      expect(db.orderBy).toHaveBeenCalled();
      expect(result).toEqual(budgets);
    });

    it('should return an empty array if no budgets found', async () => {
      const userId = 'user-1';

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.orderBy.mockReturnValue(Promise.resolve([]));

      const result = await service.findAllByUserId(userId);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(schema.budgets);
      expect(db.where).toHaveBeenCalled();
      expect(db.orderBy).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  /******************
   *     FIND ONE    *
   *****************/

  describe('findOne', () => {
    it('should return a budget by ID for a user', async () => {
      const userId = 'user-1';
      const budgetId = 'budget-1';
      const budget = { id: budgetId, userId, categoryId: 'cat-1', totalAmount: 500 };

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([budget]));

      const result = await service.findOne(budgetId, userId);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(schema.budgets);
      // expect(db.where).toHaveBeenCalledWith(expect.objectContaining({ id: budgetId, userId }));
      expect(result).toEqual(budget);
    });

    it('should throw NotFoundException if budget not found', async () => {
      const userId = 'user-1';
      const budgetId = 'budget-1';

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([]));

      await expect(service.findOne(budgetId, userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if budget does not belong to user', async () => {
      const userId = 'user-1';
      const budgetId = 'budget-1';

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([]));

      await expect(service.findOne(budgetId, userId)).rejects.toThrow(NotFoundException);
    });

  });

  /******************
   *     FIND ONE BY CATEGORY ID    *
   *****************/

  describe('findOneByCategoryId', () => {
    it('should return a budget by category ID for a user', async () => {
      const userId = 'user-1';
      const categoryId = 'cat-1';
      const budget = { id: 'budget-1', userId, categoryId, totalAmount: 500 };

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([budget]));

      const result = await service.findOneByCategoryId(categoryId, userId);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(schema.budgets);
      // expect(db.where).toHaveBeenCalledWith(expect.objectContaining({ categoryId, userId }));
      expect(result).toEqual(budget);
    });

    it('should return null if no budget found for category ID', async () => {
      const userId = 'user-1';
      const categoryId = 'cat-1';

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([]));

      const result = await service.findOneByCategoryId(categoryId, userId);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(schema.budgets);
      // expect(db.where).toHaveBeenCalledWith(expect.objectContaining({ categoryId, userId }));
      expect(result).toBeNull();
    });

    it('should return null if budget exists but does not belong to user', async () => {
      const userId = 'user-1';
      const categoryId = 'cat-1';

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([]));

      const result = await service.findOneByCategoryId(categoryId, userId);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(schema.budgets);
      // expect(db.where).toHaveBeenCalledWith(expect.objectContaining({ categoryId, userId }));
      await expect(result).toBeNull();
    });

  });

  /******************
   *     UPDATE      *
   *****************/

  describe('update', () => {
    const userId = 'user-1';
    const budgetId = 'budget-1';
    const updateDto: UpdateBudgetDto = {
      totalAmount: 600,
      recurringFrequency: 'monthly',
    };

    it('should throw NotFoundException if budget does not exist', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValue(new NotFoundException('Budget not found'));

      await expect(service.update(budgetId, updateDto, userId)).rejects.toThrow(NotFoundException);
    });

    it('should update and return the budget', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockBudgetsResult);
      
      // Simuler la transaction
      const txMock = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{
          ...mockBudgetsResult,
          ...updateDto,
          updatedAt: expect.any(Date),
        }])
      };
      
      db.transaction = jest.fn().mockImplementation((callback) => callback(txMock));

      const result = await service.update(budgetId, updateDto, userId);

      expect(txMock.update).toHaveBeenCalledWith(schema.budgets);
      expect(txMock.set).toHaveBeenCalled();
      expect(txMock.where).toHaveBeenCalled();
      expect(txMock.returning).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        ...mockBudgetsResult,
        ...updateDto,
        updatedAt: expect.any(Date),
      }));
    });

  });


  /******************
   *     UPDATE ACTUAL AMOUNT     *
   *****************/
  describe('updateActualAmount', () => {
    const categoryId = 'cat-1';
    const userId = 'user-1';
    const amount = 100;

    beforeEach(() => {
      jest.spyOn(service, 'findOneByCategoryId').mockImplementation(jest.fn());
    });
    
    it('should return null if budget is not found', async () => {
      jest.spyOn(service, 'findOneByCategoryId').mockResolvedValue(null);

      const result = await service.updateActualAmount(categoryId, userId, 1, amount, new Date());

      expect(service.findOneByCategoryId).toHaveBeenCalledWith(categoryId, userId);
      expect(result).toBeNull();
    });

    it('should subtract amount for income transactions (type 1)', async () => {
      const budget = { 
        ...mockBudgetsResult, 
        id: 'budget-1', 
        categoryId, 
        userId,
        actualAmount: 500,
        lastResetDate: new Date().toISOString()
      };

      jest.spyOn(service, 'findOneByCategoryId').mockResolvedValue(budget);
      mockCategoriesService.findOne.mockResolvedValue({ id: categoryId, name: 'Food' });

      const expectedActualAmount = 400; // 500 - 100 = 400

      const updatedBudget = { ...budget, actualAmount: expectedActualAmount };
      db.update.mockReturnValue(db);
      db.set.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.returning.mockResolvedValue([updatedBudget]);

      const result = await service.updateActualAmount(categoryId, userId, 1, amount, new Date());

      expect(service.findOneByCategoryId).toHaveBeenCalledWith(categoryId, userId);
      expect(db.update).toHaveBeenCalledWith(schema.budgets);
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
        actualAmount: expectedActualAmount,
        updatedAt: expect.any(Date)
      }));
      expect(result).toEqual(updatedBudget);
    });

    it('should add amount for expense transactions (type 2)', async () => {
      const budget = { 
        ...mockBudgetsResult, 
        id: 'budget-1', 
        categoryId, 
        userId,
        actualAmount: 500,
        lastResetDate: new Date().toISOString()
      };

      jest.spyOn(service, 'findOneByCategoryId').mockResolvedValue(budget);
      mockCategoriesService.findOne.mockResolvedValue({ id: categoryId, name: 'Food' });

      const expectedActualAmount = 600; // 500 + 100 = 600

      const updatedBudget = { ...budget, actualAmount: expectedActualAmount };
      db.update.mockReturnValue(db);
      db.set.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.returning.mockResolvedValue([updatedBudget]);

      const result = await service.updateActualAmount(categoryId, userId, 2, amount, new Date());

      expect(service.findOneByCategoryId).toHaveBeenCalledWith(categoryId, userId);
      expect(db.update).toHaveBeenCalledWith(schema.budgets);
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
        actualAmount: expectedActualAmount,
        updatedAt: expect.any(Date)
      }));
      expect(result).toEqual(updatedBudget);
    });

    it('should create a warning notification when budget is at 75%', async () => {
      const budget = { 
        ...mockBudgetsResult, 
        id: 'budget-1', 
        categoryId, 
        userId,
        totalAmount: 1000,
        actualAmount: 700,
        lastResetDate: new Date().toISOString()
      };

      jest.spyOn(service, 'findOneByCategoryId').mockResolvedValue(budget);
      mockCategoriesService.findOne.mockResolvedValue({ id: categoryId, name: 'Food' });

      const expectedActualAmount = 800; // 700 + 100 = 800 (80% of 1000)

      const updatedBudget = { ...budget, actualAmount: expectedActualAmount };
      db.update.mockReturnValue(db);
      db.set.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.returning.mockResolvedValue([updatedBudget]);

      await service.updateActualAmount(categoryId, userId, 2, amount, new Date());

      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "budget",
          message: expect.stringContaining("75%"),
          level: "warning",
        }),
        userId
      );
    });

    it('should create an error notification when budget is reached (100%)', async () => {
      const budget = { 
        ...mockBudgetsResult, 
        id: 'budget-1', 
        categoryId, 
        userId,
        totalAmount: 1000,
        actualAmount: 950,
        lastResetDate: new Date().toISOString()
      };

      jest.spyOn(service, 'findOneByCategoryId').mockResolvedValue(budget);
      mockCategoriesService.findOne.mockResolvedValue({ id: categoryId, name: 'Food' });

      const expectedActualAmount = 1050; // 950 + 100 = 1050 (over 100% of 1000)

      const updatedBudget = { ...budget, actualAmount: expectedActualAmount };
      db.update.mockReturnValue(db);
      db.set.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.returning.mockResolvedValue([updatedBudget]);

      await service.updateActualAmount(categoryId, userId, 2, amount, new Date());

      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "budget",
          message: expect.stringContaining("reached"),
          level: "error",
        }),
        userId
      );
    });
    
    it('should return null if transaction date is outside of budget period', async () => {
      const lastResetDate = '2023-01-01';
      const budget = { 
        ...mockBudgetsResult, 
        id: 'budget-1', 
        categoryId, 
        userId,
        actualAmount: 500,
        recurringFrequency: mockBudgetsResult.recurringFrequency,
        lastResetDate
      };

      jest.spyOn(service, 'findOneByCategoryId').mockResolvedValue(budget);

      // Date outside the budget period (more than a month later)
      const transactionDate = '2023-02-02'; 

      const result = await service.updateActualAmount(categoryId, userId, 2, amount, transactionDate);

      expect(service.findOneByCategoryId).toHaveBeenCalledWith(categoryId, userId);
      expect(result).toBeNull();
    });
  });

  /******************
   *     RESET ACTUAL AMOUNT     *
   *****************/
  describe('resetActualAmount', () => {
    it('should reset the actual amount of a budget', async () => {
      const budgetId = 'budget-1';
      const budget = { ...mockBudgetsResult, id: budgetId };

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([budget]));

      const updatedBudget = { ...budget, actualAmount: 0, lastResetDate: expect.any(String) };
      db.update.mockReturnValue(db);
      db.set.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.returning.mockResolvedValue([updatedBudget]);

      const result = await service.resetActualAmount(budgetId);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(schema.budgets);
      expect(db.update).toHaveBeenCalledWith(schema.budgets);
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
        actualAmount: 0,
        lastResetDate: expect.any(String),
        updatedAt: expect.any(Date)
      }));
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "budget",
          message: expect.stringContaining("reset"),
          level: "info",
        }),
        budget.userId
      );
      expect(result).toEqual(updatedBudget);
    });

    it('should return null if budget is not found', async () => {
      const budgetId = 'non-existent';

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([]));

      const result = await service.resetActualAmount(budgetId);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(schema.budgets);
      expect(result).toBeNull();
    });

    it('should return null if the update fails', async () => {
      const budgetId = 'budget-1';
      const budget = { ...mockBudgetsResult, id: budgetId };

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([budget]));

      db.update.mockReturnValue(db);
      db.set.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.returning.mockResolvedValue([]);

      const result = await service.resetActualAmount(budgetId);

      expect(db.select).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  /******************
   *     REMOVE     *
   *****************/
  describe('remove', () => {
    it('should remove a budget', async () => {
      const budgetId = 'budget-1';
      const userId = 'user-1';

      // Simuler la transaction
      const txMock = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(undefined)
      };
      
      db.transaction = jest.fn().mockImplementation((callback) => callback(txMock));
      
      await service.remove(budgetId, userId);

      expect(txMock.delete).toHaveBeenCalledWith(schema.budgets);
      expect(mockBudgetResetService.removeBudgetResetJob).toHaveBeenCalledWith(budgetId);
    });
  });
});
