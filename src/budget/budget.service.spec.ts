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

  beforeEach(async () => {
    db = createMockDb();
    mockCategoriesService = { findOne: jest.fn()};
    mockBudgetResetService = { scheduleBudgetReset: jest.fn() };
    mockNotificationsService = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: DrizzleAsyncProvider, useValue: db },
        { provide: CategoriesService, useValue: mockCategoriesService },
        { provide: BudgetResetService, useValue: mockBudgetResetService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        BudgetService
      ],
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
      recurringFrequency: 30,
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

      const insertedBudget = {
        id: 'budget-1',
        ...dto,
        userId,
        lastResetDate: expect.any(String),
        createdAt: expect.any(Date),
      };

      db.insert.mockReturnValue(db);
      db.values.mockReturnValue(db);
      db.returning.mockReturnValue(Promise.resolve([insertedBudget]));

      const result = await service.create(dto, userId);

      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalledWith(expect.objectContaining({ userId }));
      expect(db.returning).toHaveBeenCalled();
      expect(result).toEqual(insertedBudget);
      expect(mockBudgetResetService.scheduleBudgetReset).toHaveBeenCalledWith(insertedBudget);
    });

    it('should not schedule a reset if no recurringFrequency', async () => {
      const noRecurringDto = { ...dto, recurringFrequency: undefined };

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
      db.where.mockReturnValue(Promise.resolve(budgets));

      const result = await service.findAllByUserId(userId);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(schema.budgets);
      // expect(db.where).toHaveBeenCalledWith(expect.objectContaining({ userId }));
      expect(result).toEqual(budgets);
    });

    it('should return an empty array if no budgets found', async () => {
      const userId = 'user-1';

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([]));

      const result = await service.findAllByUserId(userId);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalledWith(schema.budgets);
      // expect(db.where).toHaveBeenCalledWith(expect.objectContaining({ userId }));
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
      recurringFrequency: 45,
    };

    it('should throw NotFoundException if budget does not exist', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValue(new NotFoundException('Budget not found'));

      await expect(service.update(budgetId, updateDto, userId)).rejects.toThrow(NotFoundException);
    });

    it('should update and return the budget', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockBudgetsResult);

      db.update.mockReturnValue(db);
      db.set.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.returning.mockReturnValue(Promise.resolve([{
        ...mockBudgetsResult,
        ...updateDto,
        updatedAt: expect.any(Date),
      }]));

      const result = await service.update(budgetId, updateDto, userId);

      expect(db.update).toHaveBeenCalledWith(schema.budgets);
      // expect(db.set).toHaveBeenCalledWith(expect.objectContaining(updateDto));
      // expect(db.where).toHaveBeenCalledWith(expect.objectContaining({ id: budgetId, userId }));
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

  /******************
   *     RESET ACTUAL AMOUNT     *
   *****************/

  /******************
   *     REMOVE     *
   *****************/
});
