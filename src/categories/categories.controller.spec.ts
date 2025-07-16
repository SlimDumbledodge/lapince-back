import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { DeleteCategoryDto } from './dto/delete-category.dto';
import { UserEntity } from '../decorator/user.decorator';
import { ParseUUIDPipe } from '@nestjs/common';
import { mockCategoryResult, mockCategoriesResults } from '../../__mock__/categories';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: CategoriesService;

  const mockUser: UserEntity = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    accountId: 'account-1',
    accountName: 'My Account',
    amount: 1000,
    password: 'password',
    accountType: 'in-app',
    avatar: 'avatar-url',
    locale: 'fr-FR',
    firstLogin: false,
    verifiedEmail: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCategoryService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: mockCategoryService,
        },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = module.get<CategoriesService>(CategoriesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a category', async () => {
      const createCategoryDto: CreateCategoryDto = {
        name: 'Food',
        color: '#FF5733',
        icon: 'ShoppingCart',
      };

      const expectedResult = {
        ...mockCategoryResult,
        ...createCategoryDto,
        userId: mockUser.id,
      };

      mockCategoryService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createCategoryDto, mockUser);

      expect(service.create).toHaveBeenCalledWith(createCategoryDto, mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findAll', () => {
    it('should return an array of categories', async () => {
      const expectedResult = mockCategoriesResults;

      mockCategoryService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(mockUser);

      expect(service.findAll).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should return a category by id', async () => {
      const categoryId = 'category-1';
      const expectedResult = mockCategoryResult;

      mockCategoryService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(categoryId, mockUser);

      expect(service.findOne).toHaveBeenCalledWith(categoryId, mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const categoryId = 'category-1';
      const updateCategoryDto: UpdateCategoryDto = {
        name: 'Food Updated',
        color: '#00FF00',
      };

      const expectedResult = {
        ...mockCategoryResult,
        name: 'Food Updated',
        color: '#00FF00',
      };

      mockCategoryService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(categoryId, updateCategoryDto, mockUser);

      expect(service.update).toHaveBeenCalledWith(categoryId, updateCategoryDto, mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('remove', () => {
    it('should remove a category', async () => {
      const categoryId = 'category-1';
      
      mockCategoryService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(
        categoryId,
        mockUser,
        false,
        undefined
      );

      expect(service.remove).toHaveBeenCalledWith(categoryId, mockUser.id, {
        replaceOldTransactionsCategoryId: false,
        newCategoryId: undefined,
      });
      expect(result).toBeUndefined();
    });

    it('should remove a category and replace transactions with new category', async () => {
      const categoryId = 'category-1';
      const newCategoryId = 'new-category-id';

      mockCategoryService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(
        categoryId,
        mockUser,
        true,
        newCategoryId
      );

      expect(service.remove).toHaveBeenCalledWith(categoryId, mockUser.id, {
        replaceOldTransactionsCategoryId: true,
        newCategoryId,
      });
      expect(result).toBeUndefined();
    });
  });
});
