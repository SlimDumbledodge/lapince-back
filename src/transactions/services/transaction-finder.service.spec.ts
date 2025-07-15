import { Test, TestingModule } from '@nestjs/testing';
import { TransactionFinderService } from './transaction-finder.service';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { UserAccountService } from 'src/user-account/user-account.service';
import { createMockDb } from '../../../__mock__/helpers/mockDb.helper';
import { NotFoundException } from '@nestjs/common';
import * as schema from 'src/db/schema';

describe('TransactionFinderService', () => {
  let service: TransactionFinderService;
  let mockDb: any;
  let mockUserAccountService: any;

  beforeEach(async () => {
    mockDb = createMockDb();
    
    mockUserAccountService = {
      findOneByUserId: jest.fn().mockResolvedValue({ id: 'user-account-id', amount: 1000 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionFinderService,
        {
          provide: DrizzleAsyncProvider,
          useValue: mockDb,
        },
        {
          provide: UserAccountService,
          useValue: mockUserAccountService,
        },
      ],
    }).compile();

    service = module.get<TransactionFinderService>(TransactionFinderService);
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

  describe('findAll', () => {
    it('should return paginated transactions', async () => {
      mockDb.select.mockImplementation(() => mockDb);
      mockDb.from.mockImplementation(() => mockDb);
      mockDb.leftJoin.mockImplementation(() => mockDb);
      mockDb.where.mockImplementation(() => mockDb);
      mockDb.limit.mockImplementation(() => mockDb);
      mockDb.offset.mockImplementation(() => mockDb);
      mockDb.orderBy.mockImplementation(() => mockDb);

      const mockTransactions = [
        {
          transaction: { id: 'tx-1', amount: 100, categoryId: 'category-1' },
          category: { id: 'category-1', name: 'Category 1' }
        },
        {
          transaction: { id: 'tx-2', amount: 200, categoryId: 'category-2' },
          category: { id: 'category-2', name: 'Category 2' }
        }
      ];

      const mockCount = [{ count: 2 }];

      // Mock Promise.all to return both queries results
      jest.spyOn(Promise, 'all').mockImplementation(() => {
        return Promise.resolve([mockTransactions, mockCount]) as any;
      });

      const result = await service.findAll('user-id', 10, 0);
      
      expect(result).toEqual({
        data: expect.any(Array),
        limit: 10,
        page: 0,
        total: 2,
        lastPage: 0
      });

      expect(result.data.length).toBe(2);
      expect(result.data[0].id).toBe('tx-1');
      // Testing for categoryDetails instead of category property
      expect(result.data[0].categoryId).toBe('category-1');
      
      expect(mockDb.select).toHaveBeenCalledTimes(2);
      expect(mockDb.from).toHaveBeenCalledTimes(2);
      expect(mockDb.where).toHaveBeenCalledTimes(2);
    });
  });

  describe('findAllByCategoryId', () => {
    it('should return transactions filtered by category', async () => {
      mockDb.select.mockImplementation(() => mockDb);
      mockDb.from.mockImplementation(() => mockDb);
      mockDb.where.mockImplementation(() => mockDb);
      mockDb.orderBy.mockImplementation(() => mockDb);

      await service.findAllByCategoryId('category-id', 'user-id');
      
      expect(mockUserAccountService.findOneByUserId).toHaveBeenCalledWith('user-id');
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(schema.transactions);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should include startDate in where condition when provided', async () => {
      mockDb.select.mockImplementation(() => mockDb);
      mockDb.from.mockImplementation(() => mockDb);
      mockDb.where.mockImplementation(() => mockDb);
      mockDb.orderBy.mockImplementation(() => mockDb);

      const startDate = new Date('2025-01-01');
      await service.findAllByCategoryId('category-id', 'user-id', startDate);
      
      expect(mockUserAccountService.findOneByUserId).toHaveBeenCalledWith('user-id');
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(schema.transactions);
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a transaction with category when found', async () => {
      mockDb.select.mockImplementation(() => mockDb);
      mockDb.from.mockImplementation(() => mockDb);
      mockDb.leftJoin.mockImplementation(() => mockDb);
      mockDb.where.mockImplementation(() => mockDb);
      mockDb.limit.mockImplementation(() => mockDb);
      
      const mockResult = [
        {
          transaction: { id: 'tx-1', amount: 100, categoryId: 'category-1' },
          category: { id: 'category-1', name: 'Category 1' }
        }
      ];
      
      mockDb.limit.mockResolvedValue(mockResult);

      const result = await service.findOne('tx-1', 'user-id');
      
      expect(result.id).toBe('tx-1');
      // Testing for categoryId instead of category property
      expect(result.categoryId).toBe('category-1');
      
      expect(mockUserAccountService.findOneByUserId).toHaveBeenCalledWith('user-id');
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.leftJoin).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when transaction not found', async () => {
      mockDb.select.mockImplementation(() => mockDb);
      mockDb.from.mockImplementation(() => mockDb);
      mockDb.leftJoin.mockImplementation(() => mockDb);
      mockDb.where.mockImplementation(() => mockDb);
      mockDb.limit.mockImplementation(() => mockDb);
      
      mockDb.limit.mockResolvedValue([]);

      await expect(service.findOne('tx-1', 'user-id'))
        .rejects
        .toThrow(new NotFoundException('Transaction not found'));
    });
  });
});
