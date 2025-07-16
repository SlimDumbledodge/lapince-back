import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { createMockDb } from '../../__mock__/helpers/mockDb.helper';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { DeleteCategoryDto } from './dto/delete-category.dto';
import { 
  mockCategoryResult, 
  mockGlobalCategoryResult, 
  mockDefaultCategoryResult, 
  mockDeletedCategoryResult, 
  mockCategoriesResults 
} from '../../__mock__/categories';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let db: any;

  beforeEach(async () => {
    db = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: DrizzleAsyncProvider, useValue: db },
        CategoriesService
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);

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
    const dto: CreateCategoryDto = {
      name: 'Food',
      color: '#FF5733',
      icon: 'ShoppingCart',
    };

    it('should create and return a new category', async () => {
      const category = {
        ...mockCategoryResult,
        ...dto,
        userId,
      };

      db.insert.mockReturnValue(db);
      db.values.mockReturnValue(db);
      db.returning.mockReturnValue(Promise.resolve([category]));

      const result = await service.create(dto, userId);

      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalledWith(expect.objectContaining({
        ...dto,
        userId,
      }));
      expect(result).toEqual(category);
    });
  });

  /******************
   *    FIND ALL    *
   *****************/

  describe('findAll', () => {
    const userId = 'user-1';

    it('should return all categories for a user including global categories', async () => {
      const categories = mockCategoriesResults;

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve(categories));

      const result = await service.findAll(userId);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalled();
      expect(result).toEqual(categories);
    });
  });

  /******************
   *    FIND ONE    *
   *****************/

  describe('findOne', () => {
    const userId = 'user-1';
    const categoryId = 'category-1';

    it('should return the category if it belongs to the user', async () => {
      const category = mockCategoryResult;

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([category]));

      const result = await service.findOne(categoryId, userId);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalled();
      expect(result).toEqual(category);
    });

    it('should return a global category', async () => {
      const category = mockGlobalCategoryResult;

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([category]));

      const result = await service.findOne(categoryId, userId);

      expect(result).toEqual(category);
    });

    it('should throw NotFoundException if category not found', async () => {
      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([]));

      await expect(service.findOne(categoryId, userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if category belongs to another user', async () => {
      const category = {
        ...mockCategoryResult,
        userId: 'another-user',
      };

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([category]));

      await expect(service.findOne(categoryId, userId)).rejects.toThrow(NotFoundException);
    });
  });

  /******************
   *     UPDATE     *
   *****************/

  describe('update', () => {
    const userId = 'user-1';
    const categoryId = 'category-1';
    const dto: UpdateCategoryDto = {
      name: 'Food Updated',
      color: '#00FF00',
    };

    it('should update and return the category', async () => {
      const category = mockCategoryResult;

      const updatedCategory = {
        ...category,
        ...dto,
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(category as any);

      db.update.mockReturnValue(db);
      db.set.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.returning.mockReturnValue(Promise.resolve([updatedCategory]));

      const result = await service.update(categoryId, dto, userId);

      expect(service.findOne).toHaveBeenCalledWith(categoryId, userId);
      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining(dto));
      expect(db.where).toHaveBeenCalled();
      expect(result).toEqual(updatedCategory);
    });

    it('should throw BadRequestException if trying to update a global category', async () => {
      const category = mockGlobalCategoryResult;

      jest.spyOn(service, 'findOne').mockResolvedValue(category as any);

      await expect(service.update(categoryId, dto, userId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if trying to update another user\'s category', async () => {
      const category = {
        ...mockCategoryResult,
        userId: 'another-user',
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(category as any);

      await expect(service.update(categoryId, dto, userId)).rejects.toThrow(BadRequestException);
    });
  });

  /******************
   *     REMOVE     *
   *****************/

  describe('remove', () => {
    const userId = 'user-1';
    const categoryId = 'category-1';
    
    it('should delete a category with no transactions', async () => {
      const category = mockCategoryResult;

      jest.spyOn(service, 'findOne').mockResolvedValue(category as any);

      // Configure full mock chain for count query
      db.select.mockReturnThis();
      db.from.mockReturnThis();
      db.where.mockResolvedValueOnce([{ count: 0 }]);

      // Configure full mock chain for delete operation
      db.delete.mockReturnThis();
      db.where.mockReturnThis(); // Add this for the delete operation

      // Mock transaction to execute the delete branch
      db.transaction.mockImplementation((callback) => callback(db));

      await service.remove(categoryId, userId, { replaceOldTransactionsCategoryId: false });

      expect(service.findOne).toHaveBeenCalledWith(categoryId, userId);
      expect(db.delete).toHaveBeenCalled();
    });

    it('should soft delete a category with transactions', async () => {
      const category = mockCategoryResult;

      jest.spyOn(service, 'findOne').mockResolvedValue(category as any);

      // Mock transaction count to be > 0
      db.select.mockReturnThis();
      db.from.mockReturnThis();
      db.where.mockResolvedValueOnce([{ count: 5 }]);

      // Configure full mock chain for update operation
      db.update.mockReturnThis();
      db.set.mockReturnThis(); // Add this for the update.set() chain
      db.where.mockReturnThis(); // Add this for the update.set().where() chain

      // Mock transaction to execute the soft delete branch
      db.transaction.mockImplementation((callback) => callback(db));

      await service.remove(categoryId, userId, { replaceOldTransactionsCategoryId: false });

      expect(service.findOne).toHaveBeenCalledWith(categoryId, userId);
      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalled();
    });

    it('should replace transactions and delete category when replaceOldTransactionsCategoryId is true', async () => {
      const category = mockCategoryResult;

      const newCategoryId = 'new-category-id';
      const deleteDto: DeleteCategoryDto = {
        replaceOldTransactionsCategoryId: true,
        newCategoryId,
      };

      const findOneMock = jest.spyOn(service, 'findOne')
        .mockImplementation((id, uid) => {
          if (id === categoryId) {
            return Promise.resolve(category as any);
          } else if (id === newCategoryId) {
            return Promise.resolve({
              id: newCategoryId,
              name: 'New Category',
              userId,
            } as any);
          }
          return Promise.resolve(null);
        });

      // Configure full mock chain for update operation
      db.update.mockReturnThis();
      db.set.mockReturnThis();
      db.where.mockReturnThis();

      // Configure full mock chain for delete operation
      db.delete.mockReturnThis();
      db.where.mockReturnThis();

      // Mock transaction to execute the replace transactions branch
      db.transaction.mockImplementation((callback) => callback(db));

      await service.remove(categoryId, userId, deleteDto);

      expect(findOneMock).toHaveBeenCalledWith(categoryId, userId);
      expect(findOneMock).toHaveBeenCalledWith(newCategoryId, userId);
      expect(db.update).toHaveBeenCalled();
    });

    it('should use default category when replaceOldTransactionsCategoryId is true but newCategoryId not provided', async () => {
      const category = mockCategoryResult;

      const defaultCategory = mockDefaultCategoryResult;

      const deleteDto: DeleteCategoryDto = {
        replaceOldTransactionsCategoryId: true,
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(category as any);

      // Mock the query for default category
      db.select.mockReturnThis();
      db.from.mockReturnThis();
      db.where.mockReturnValueOnce(db); // Chain for the isDefault=true query
      db.limit.mockReturnValueOnce(Promise.resolve([defaultCategory])); // Resolve with default category

      // Configure full mock chain for update operation
      db.update.mockReturnThis();
      db.set.mockReturnThis();
      db.where.mockReturnThis();

      // Configure full mock chain for delete operation
      db.delete.mockReturnThis();
      db.where.mockReturnThis();

      // Mock transaction to execute the replace with default category branch
      db.transaction.mockImplementation((callback) => callback(db));

      await service.remove(categoryId, userId, deleteDto);

      expect(service.findOne).toHaveBeenCalledWith(categoryId, userId);
      expect(db.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if trying to delete a default category', async () => {
      const category = {
        ...mockCategoryResult,
        isDefault: true,
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(category as any);

      await expect(
        service.remove(categoryId, userId, { replaceOldTransactionsCategoryId: false })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if trying to delete an already deleted category', async () => {
      const category = mockDeletedCategoryResult;

      jest.spyOn(service, 'findOne').mockResolvedValue(category as any);

      await expect(
        service.remove(categoryId, userId, { replaceOldTransactionsCategoryId: false })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if trying to delete a global category', async () => {
      const category = mockGlobalCategoryResult;

      jest.spyOn(service, 'findOne').mockResolvedValue(category as any);

      await expect(
        service.remove(categoryId, userId, { replaceOldTransactionsCategoryId: false })
      ).rejects.toThrow(BadRequestException);
    });
  });
});
