import { Test, TestingModule } from '@nestjs/testing';
import { UserAccountController } from './user-account.controller';
import { UserAccountService } from './user-account.service';
import { mockCreateUserAccountDto, mockUpdateUserAccountDto, mockUserAccount } from '../../__mock__/user-account';
import { mockUserResult } from '../../__mock__/users';

describe('UserAccountController', () => {
  let controller: UserAccountController;
  let service: jest.Mocked<UserAccountService>;

  beforeEach(async () => {
    // Create mock service
    const mockUserAccountService = {
      create: jest.fn(),
      findOne: jest.fn(),
      findOneByUserId: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserAccountController],
      providers: [
        {
          provide: UserAccountService,
          useValue: mockUserAccountService,
        },
      ],
    }).compile();

    controller = module.get<UserAccountController>(UserAccountController);
    service = module.get<UserAccountService>(UserAccountService) as jest.Mocked<UserAccountService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a user account', async () => {
      service.create.mockResolvedValue(mockUserAccount);
      const user = { id: mockUserResult.id } as any;

      const result = await controller.create(mockCreateUserAccountDto, user);

      expect(service.create).toHaveBeenCalledWith(mockCreateUserAccountDto, user.id);
      expect(result).toEqual(mockUserAccount);
    });
  });

  describe('findOne', () => {
    it('should return a user account by id', async () => {
      service.findOne.mockResolvedValue(mockUserAccount);
      const id = mockUserAccount.id;

      const result = await controller.findOne(id);

      expect(service.findOne).toHaveBeenCalledWith(id);
      expect(result).toEqual(mockUserAccount);
    });
  });

  describe('findOneByUserId', () => {
    it('should return a user account by user id', async () => {
      service.findOneByUserId.mockResolvedValue(mockUserAccount);
      const userId = mockUserAccount.userId;

      const result = await controller.findOneByUserId(userId);

      expect(service.findOneByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUserAccount);
    });
  });

  describe('update', () => {
    it('should update a user account', async () => {
      const updatedAccount = { ...mockUserAccount, ...mockUpdateUserAccountDto };
      service.update.mockResolvedValue(updatedAccount);
      const userId = mockUserAccount.userId;

      const result = await controller.update(userId, mockUpdateUserAccountDto);

      expect(service.update).toHaveBeenCalledWith(userId, mockUpdateUserAccountDto);
      expect(result).toEqual(updatedAccount);
    });
  });

  describe('remove', () => {
    it('should remove a user account', async () => {
      service.remove.mockResolvedValue(undefined);
      const id = mockUserAccount.id;

      const result = await controller.remove(id);

      expect(service.remove).toHaveBeenCalledWith(id);
      expect(result).toBeUndefined();
    });
  });
});
