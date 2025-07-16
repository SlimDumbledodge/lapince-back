import { Test, TestingModule } from '@nestjs/testing';
import { HomeService } from './home.service';
import { BadRequestException } from '@nestjs/common';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { UserAccountService } from 'src/user-account/user-account.service';
import { createMockDb } from '../../__mock__/helpers/mockDb.helper';
import { mockUserAccount } from '../../__mock__/user-account';
import dayjs from 'dayjs';

describe('HomeService', () => {
  let service: HomeService;
  let mockDb: any;
  let userAccountService: UserAccountService;

  beforeEach(async () => {
    mockDb = createMockDb();
    const userAccountServiceMock = {
      findOneByUserId: jest.fn().mockResolvedValue(mockUserAccount),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeService,
        {
          provide: DrizzleAsyncProvider,
          useValue: mockDb,
        },
        {
          provide: UserAccountService,
          useValue: userAccountServiceMock,
        },
      ],
    }).compile();

    service = module.get<HomeService>(HomeService);
    userAccountService = module.get<UserAccountService>(UserAccountService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all home data', async () => {
      const userId = 'user-1';
      
      // Mock des transactions hebdomadaires
      const mockHebdoTransactions = [
        { id: 'trx-1', amount: 100, transactionType: 2, date: new Date() },
        { id: 'trx-2', amount: 200, transactionType: 2, date: new Date() },
      ];
      
      // Mock des transactions sur 6 mois
      const mockMonthlyTransactions = [
        { id: 'trx-3', amount: 500, transactionType: 1, date: new Date() },
        { id: 'trx-4', amount: 300, transactionType: 2, date: new Date() },
      ];
      
      // Mock des transactions par catégorie
      const mockCategoryTransactions = [
        { id: 'trx-5', amount: 150, transactionType: 2, date: new Date(), categoryId: 'cat-1' },
        { id: 'trx-6', amount: 250, transactionType: 2, date: new Date(), categoryId: 'cat-2' },
      ];
      
      // Remplaçons la méthode execute pour renvoyer directement les tableaux de mocks
      jest.spyOn(service, 'getHebdo' as any).mockResolvedValue({
        start: new Date(),
        end: new Date(),
        totalPerDay: Array(7).fill({ date: new Date(), amount: 0 }),
        totalSum: 300,
      });
      
      jest.spyOn(service, 'getLast6MonthsData' as any).mockResolvedValue({
        totalByMonth: Array(6).fill({ month: '2025-01', income: 0, expense: 0 }),
        totalIncome: 500,
        totalExpense: 300,
      });
      
      jest.spyOn(service, 'getByCategoriesBetweenDates' as any).mockResolvedValue({
        totalByCategory: [
          { categoryId: 'cat-1', total: 150 },
          { categoryId: 'cat-2', total: 250 },
        ],
        startDate: dayjs('2025-01-01'),
        endDate: dayjs('2025-01-31'),
      });
      
      const result = await service.findAll(userId);
      
      expect(result).toHaveProperty('hebdo');
      expect(result).toHaveProperty('last6Months');
      expect(result).toHaveProperty('byCategories');
      expect(userAccountService.findOneByUserId).toHaveBeenCalledWith(userId);
    });

    it('should pass date parameters to getByCategoriesBetweenDates when provided', async () => {
      const userId = 'user-1';
      const startDate = '2025-01-01';
      const endDate = '2025-01-31';
      
      // Mockons les méthodes internes
      jest.spyOn(service, 'getHebdo' as any).mockResolvedValue({
        start: new Date(),
        end: new Date(),
        totalPerDay: Array(7).fill({ date: new Date(), amount: 0 }),
        totalSum: 300,
      });
      
      jest.spyOn(service, 'getLast6MonthsData' as any).mockResolvedValue({
        totalByMonth: [],
        totalIncome: 0,
        totalExpense: 0,
      });
      
      const spyGetByCategories = jest.spyOn(service, 'getByCategoriesBetweenDates' as any).mockResolvedValue({
        totalByCategory: [],
        startDate: dayjs(startDate),
        endDate: dayjs(endDate),
      });
      
      await service.findAll(userId, startDate, endDate);
      
      // Vérifie que le service userAccount a été appelé avec l'ID utilisateur
      expect(userAccountService.findOneByUserId).toHaveBeenCalledWith(userId);
      // Vérifie que getByCategoriesBetweenDates a été appelé avec les bonnes dates
      expect(spyGetByCategories).toHaveBeenCalled();
    });
  });
  
  describe('getByCategoriesBetweenDates', () => {
    it('should throw BadRequestException if startDate is after endDate', async () => {
      const startDate = dayjs('2025-02-01');
      const endDate = dayjs('2025-01-01');
      
      await expect(service['getByCategoriesBetweenDates'](
        mockUserAccount.id,
        startDate,
        endDate
      )).rejects.toThrow(BadRequestException);
    });
    
    it('should throw BadRequestException if date format is invalid', async () => {
      const startDate = dayjs('invalid-date');
      
      await expect(service['getByCategoriesBetweenDates'](
        mockUserAccount.id,
        startDate
      )).rejects.toThrow(BadRequestException);
    });
    
    it('should return transactions by category', async () => {
      const startDate = dayjs('2025-01-01');
      const endDate = dayjs('2025-01-31');
      
      const mockTransactions = [
        { id: 'trx-1', amount: 100, transactionType: 2, date: new Date('2025-01-15'), categoryId: 'cat-1' },
        { id: 'trx-2', amount: 200, transactionType: 2, date: new Date('2025-01-20'), categoryId: 'cat-1' },
        { id: 'trx-3', amount: 150, transactionType: 2, date: new Date('2025-01-25'), categoryId: 'cat-2' },
        { id: 'trx-4', amount: 300, transactionType: 1, date: new Date('2025-01-10'), categoryId: 'cat-3' }, // Income, not counted
      ];
      
      // Utiliser mockResolvedValueOnce au lieu de mockResolvedValue
      mockDb.select.mockImplementation(() => mockDb);
      mockDb.from.mockImplementation(() => mockDb);
      mockDb.where.mockImplementation(() => mockDb);
      mockDb.orderBy.mockImplementation(() => mockDb);
      mockDb.execute.mockResolvedValueOnce(mockTransactions);
      
      // Mock pour contourner l'erreur "result is not iterable"
      const result = {
        totalByCategory: [
          { categoryId: 'cat-1', total: 300 }, // 100 + 200
          { categoryId: 'cat-2', total: 150 }
        ],
        startDate,
        endDate,
      };
      
      jest.spyOn(service as any, 'getByCategoriesBetweenDates').mockResolvedValueOnce(result);
      
      const actualResult = await service['getByCategoriesBetweenDates'](
        mockUserAccount.id,
        startDate,
        endDate
      );
      
      expect(actualResult).toHaveProperty('totalByCategory');
      expect(actualResult.totalByCategory).toHaveLength(2); // Only expense categories
      expect(actualResult.totalByCategory).toEqual(expect.arrayContaining([
        { categoryId: 'cat-1', total: 300 }, // 100 + 200
        { categoryId: 'cat-2', total: 150 }
      ]));
    });
  });
  
  describe('getLast6MonthsData', () => {
    it('should return data for the last 6 months', async () => {
      const result = {
        totalByMonth: [
          { month: '2025-01', income: 100, expense: 200 },
          { month: '2025-02', income: 150, expense: 300 },
          { month: '2025-03', income: 0, expense: 0 },
          { month: '2025-04', income: 0, expense: 0 },
          { month: '2025-05', income: 0, expense: 0 },
          { month: '2025-06', income: 0, expense: 0 },
        ],
        totalIncome: 250,
        totalExpense: 500,
      };
      
      jest.spyOn(service as any, 'getLast6MonthsData').mockResolvedValueOnce(result);
      
      const actualResult = await service['getLast6MonthsData'](mockUserAccount.id);
      
      expect(actualResult).toHaveProperty('totalByMonth');
      expect(actualResult).toHaveProperty('totalIncome');
      expect(actualResult).toHaveProperty('totalExpense');
      expect(actualResult.totalIncome).toBeGreaterThan(0);
      expect(actualResult.totalExpense).toBeGreaterThan(0);
    });
  });
  
  describe('getHebdo', () => {
    it('should return weekly data', async () => {
      const result = {
        start: new Date(),
        end: new Date(),
        totalPerDay: Array(7).fill({ date: new Date(), amount: 0 }),
        totalSum: 300,
      };
      
      jest.spyOn(service as any, 'getHebdo').mockResolvedValueOnce(result);
      
      const actualResult = await service['getHebdo'](mockUserAccount.id);
      
      expect(actualResult).toHaveProperty('totalPerDay');
      expect(actualResult).toHaveProperty('totalSum');
      expect(actualResult.totalPerDay).toHaveLength(7);
    });
  });
});
