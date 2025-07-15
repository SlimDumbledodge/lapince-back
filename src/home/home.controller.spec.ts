import { Test, TestingModule } from '@nestjs/testing';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { mockUserWithAccountResult } from '../../__mock__/users';
import { UserEntity } from '../decorator/user.decorator';

describe('HomeController', () => {
  let controller: HomeController;
  let homeService: HomeService;

  const mockHomeResponse = {
    hebdo: {
      total: 300,
      perDay: [
        { date: new Date(), amount: 100 },
        { date: new Date(), amount: 200 },
      ],
    },
    last6Months: {
      totalIncome: 500,
      totalExpense: 300,
      byMonth: [
        { month: '2025-01', income: 200, expense: 100 },
        { month: '2025-02', income: 300, expense: 200 },
      ],
    },
    byCategories: {
      totalByCategory: [
        { categoryId: 'cat-1', total: 150 },
        { categoryId: 'cat-2', total: 250 },
      ],
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-31'),
    },
  };

  beforeEach(async () => {
    const homeServiceMock = {
      findAll: jest.fn().mockResolvedValue(mockHomeResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HomeController],
      providers: [
        {
          provide: HomeService,
          useValue: homeServiceMock,
        },
      ],
    }).compile();

    controller = module.get<HomeController>(HomeController);
    homeService = module.get<HomeService>(HomeService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all home data', async () => {
      const mockUser = mockUserWithAccountResult as unknown as UserEntity;
      const startDate = '2025-01-01';
      const endDate = '2025-01-31';

      const result = await controller.findAll(mockUser, startDate, endDate);

      expect(result).toEqual(mockHomeResponse);
      expect(homeService.findAll).toHaveBeenCalledWith(mockUser.id, startDate, endDate);
    });

    it('should call homeService without dates when not provided', async () => {
      const mockUser = mockUserWithAccountResult as unknown as UserEntity;

      // Utiliser null à la place de undefined car le contrôleur accepte null ou string
      const result = await controller.findAll(mockUser, null as unknown as string, null as unknown as string);

      expect(result).toEqual(mockHomeResponse);
      expect(homeService.findAll).toHaveBeenCalledWith(mockUser.id, null, null);
    });
  });
});
