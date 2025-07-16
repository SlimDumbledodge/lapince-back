import { Test, TestingModule } from '@nestjs/testing';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { mockBudgetsResult } from '../../__mock__/budget';
import { mockUserResult } from '../../__mock__/users';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { UserEntity } from 'src/decorator/user.decorator';

describe('BudgetController', () => {
  let controller: BudgetController;
  let service: BudgetService;

  // Mock complet du user selon UserEntity
  const mockUser = {
    ...mockUserResult,
    accountId: 'account-1',
    accountName: 'My Account',
    amount: 1000
  } as UserEntity;

  beforeEach(async () => {
    const mockBudgetService = {
      create: jest.fn(),
      findAllByUserId: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BudgetController],
      providers: [
        {
          provide: BudgetService,
          useValue: mockBudgetService
        }
      ],
    }).compile();

    controller = module.get<BudgetController>(BudgetController);
    service = module.get<BudgetService>(BudgetService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a budget', async () => {
      const dto: CreateBudgetDto = {
        categoryId: 'category-1',
        totalAmount: 1000,
        recurringFrequency: 'monthly'
      };

      jest.spyOn(service, 'create').mockResolvedValue(mockBudgetsResult);

      const result = await controller.create(dto, mockUser);
      
      expect(service.create).toHaveBeenCalledWith(dto, mockUser.id);
      expect(result).toEqual(mockBudgetsResult);
    });
  });

  describe('findAll', () => {
    it('should return all budgets for a user', async () => {
      jest.spyOn(service, 'findAllByUserId').mockResolvedValue([mockBudgetsResult]);

      const result = await controller.findAll(mockUser);
      
      expect(service.findAllByUserId).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual([mockBudgetsResult]);
    });
  });

  describe('findOne', () => {
    it('should return a budget by id', async () => {
      const budgetId = 'budget-1';
      
      jest.spyOn(service, 'findOne').mockResolvedValue(mockBudgetsResult);

      const result = await controller.findOne(budgetId, mockUser);
      
      expect(service.findOne).toHaveBeenCalledWith(budgetId, mockUser.id);
      expect(result).toEqual(mockBudgetsResult);
    });
  });

  describe('update', () => {
    it('should update a budget', async () => {
      const budgetId = 'budget-1';
      const updateDto: UpdateBudgetDto = {
        totalAmount: 1200,
        recurringFrequency: 'weekly'
      };
      
      const updatedBudget = {
        ...mockBudgetsResult,
        totalAmount: updateDto.totalAmount || mockBudgetsResult.totalAmount,
        recurringFrequency: updateDto.recurringFrequency || mockBudgetsResult.recurringFrequency
      };
      
      jest.spyOn(service, 'update').mockResolvedValue(updatedBudget);

      const result = await controller.update(budgetId, updateDto, mockUser);
      
      expect(service.update).toHaveBeenCalledWith(budgetId, updateDto, mockUser.id);
      expect(result).toEqual(updatedBudget);
    });
  });

  describe('remove', () => {
    it('should remove a budget', async () => {
      const budgetId = 'budget-1';
      
      jest.spyOn(service, 'remove').mockResolvedValue(undefined);

      await controller.remove(budgetId, mockUser);
      
      expect(service.remove).toHaveBeenCalledWith(budgetId, mockUser.id);
    });
  });
});
