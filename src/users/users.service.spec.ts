import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createMockDb } from '../../__mock__/helpers/mockDb.helper';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { 
  mockUserResult, 
  mockUpdatedUserResult, 
  mockUserWithAccountResult, 
  mockFirstLoginResult 
} from '../../__mock__/users';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { FirstLoginDto } from './dto/first-login.dto';
import * as bcrypt from 'bcrypt';
import { UserAccountService } from 'src/user-account/user-account.service';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let db: any;
  let userAccountService: UserAccountService;

  beforeEach(async () => {
    db = createMockDb();
    
    const userAccountServiceMock = {
      findOneByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: DrizzleAsyncProvider, useValue: db },
        { provide: UserAccountService, useValue: userAccountServiceMock },
        UsersService
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userAccountService = module.get<UserAccountService>(UserAccountService);

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
    const dto: CreateUserDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'Password123!',
      accountType: 'in-app',
      locale: 'fr-FR',
    };

    it('should create and return a new user', async () => {
      const user = {
        ...mockUserResult,
        ...dto,
      };

      // Mock findByEmail to return null (no existing user)
      jest.spyOn(service, 'findByEmail').mockResolvedValue(null);
      
      // Mock bcrypt hash
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      db.insert.mockReturnValue(db);
      db.values.mockReturnValue(db);
      db.returning.mockReturnValue(Promise.resolve([user]));

      const result = await service.create(dto);

      expect(service.findByEmail).toHaveBeenCalledWith(dto.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalledWith(expect.objectContaining({
        ...dto,
        password: 'hashed-password',
      }));
      expect(result).toEqual(user);
    });

    it('should throw BadRequestException if email already exists', async () => {
      // Mock findByEmail to return an existing user
      jest.spyOn(service, 'findByEmail').mockResolvedValue({
        ...mockUserWithAccountResult,
        verifiedEmail: true
      } as any);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(service.findByEmail).toHaveBeenCalledWith(dto.email);
    });
  });

  /******************
   *    FIND ALL    *
   *****************/

  describe('findAll', () => {
    it('should return all users', async () => {
      const users = [mockUserResult, {...mockUserResult, id: 'user-2'}];

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.orderBy.mockReturnValue(Promise.resolve(users));

      const result = await service.findAll();

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalled();
      expect(result).toEqual(users);
    });
  });

  /******************
   *    FIND ONE    *
   *****************/

  describe('findOne', () => {
    const userId = 'user-1';

    it('should return the user with account details', async () => {
      const userWithAccount = [
        {
          users: mockUserResult,
          user_accounts: {
            id: 'account-1',
            accountName: 'My Account',
            amount: 1000,
          }
        }
      ];

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.innerJoin.mockReturnValue(Promise.resolve(userWithAccount));

      const result = await service.findOne(userId);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
      expect(db.innerJoin).toHaveBeenCalled();
      expect(result).toEqual({
        ...userWithAccount[0].users,
        accountId: userWithAccount[0].user_accounts.id,
        accountName: userWithAccount[0].user_accounts.accountName,
        amount: userWithAccount[0].user_accounts.amount,
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.innerJoin.mockReturnValue(Promise.resolve([]));

      await expect(service.findOne(userId)).rejects.toThrow(NotFoundException);
    });
  });

  /******************
   *  FIND BY EMAIL *
   *****************/

  describe('findByEmail', () => {
    const email = 'john.doe@example.com';

    it('should return the user with account details when found', async () => {
      const user = mockUserResult;
      const userAccount = {
        id: 'account-1',
        accountName: 'My Account',
        amount: 1000,
        currency: 'EUR',
      };

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([user]));

      (userAccountService.findOneByUserId as jest.Mock).mockResolvedValue(userAccount);

      const result = await service.findByEmail(email);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
      expect(userAccountService.findOneByUserId).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({
        ...user,
        accountId: userAccount.id,
        accountName: userAccount.accountName,
        amount: userAccount.amount,
        currency: userAccount.currency,
      });
    });

    it('should return null if user not found', async () => {
      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([]));

      const result = await service.findByEmail(email);

      expect(result).toBeNull();
    });

    it('should handle null account details', async () => {
      const user = mockUserResult;

      db.select.mockReturnValue(db);
      db.from.mockReturnValue(db);
      db.where.mockReturnValue(Promise.resolve([user]));

      (userAccountService.findOneByUserId as jest.Mock).mockResolvedValue(null);

      const result = await service.findByEmail(email);

      expect(result).toEqual({
        ...user,
        accountId: null,
        accountName: null,
        amount: null,
        currency: null,
      });
    });
  });
  
  /******************
   *     UPDATE     *
   *****************/

  describe('update', () => {
    const userId = 'user-1';
    const dto: UpdateUserDto = {
      firstName: 'John Updated',
      lastName: 'Doe Updated',
      email: 'john.updated@example.com',
      locale: 'en-US',
      avatar: 'new-avatar.jpg',
    };

    it('should update and return the user', async () => {
      const updatedUser = mockUpdatedUserResult;

      // Mock findByEmail to return null (no existing user with this email)
      jest.spyOn(service, 'findByEmail').mockResolvedValue(null);

      db.update.mockReturnValue(db);
      db.set.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.returning.mockReturnValue(Promise.resolve([updatedUser]));

      const result = await service.update(userId, dto);

      expect(service.findByEmail).toHaveBeenCalledWith(dto.email);
      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
        ...dto,
        updatedAt: expect.any(Date),
      }));
      expect(db.where).toHaveBeenCalled();
      expect(result).toEqual(updatedUser);
    });

    it('should throw BadRequestException if email already used by another user', async () => {
      // Mock findByEmail to return a different user with this email
      jest.spyOn(service, 'findByEmail').mockResolvedValue({
        ...mockUserWithAccountResult,
        id: 'different-user-id',
        verifiedEmail: true
      } as any);

      await expect(service.update(userId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should allow updating if email belongs to same user', async () => {
      const updatedUser = mockUpdatedUserResult;

      // Mock findByEmail to return the same user
      jest.spyOn(service, 'findByEmail').mockResolvedValue({
        ...mockUserWithAccountResult,
        id: userId,
        verifiedEmail: true
      } as any);

      db.update.mockReturnValue(db);
      db.set.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.returning.mockReturnValue(Promise.resolve([updatedUser]));

      const result = await service.update(userId, dto);

      expect(result).toEqual(updatedUser);
    });

    it('should throw BadRequestException if user not found during update', async () => {
      // Mock findByEmail to return null
      jest.spyOn(service, 'findByEmail').mockResolvedValue(null);

      db.update.mockReturnValue(db);
      db.set.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.returning.mockReturnValue(Promise.resolve([]));

      await expect(service.update(userId, dto)).rejects.toThrow(BadRequestException);
    });
  });
  
  /******************
   *  FIRST LOGIN   *
   *****************/

  describe('firstLogin', () => {
    const userId = 'user-1';
    const dto: FirstLoginDto = {
      totalAmount: 1000,
      accountName: 'My Account',
      currency: 'EUR',
      locale: 'en-US',
    };

    it('should update account and user details on first login', async () => {
      const updatedUser = mockFirstLoginResult;

      // Mock transaction implementation
      db.transaction.mockImplementation((callback) => callback(db));

      db.update.mockReturnValue(db);
      db.set.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.returning.mockReturnValue(Promise.resolve([updatedUser]));

      const result = await service.firstLogin(dto, userId);

      // First update for user account
      expect(db.update).toHaveBeenCalledWith(expect.anything());
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
        accountName: dto.accountName,
        amount: dto.totalAmount,
        currency: dto.currency,
      }));

      // Second update for user
      expect(db.update).toHaveBeenCalledWith(expect.anything());
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
        locale: dto.locale,
        firstLogin: false,
      }));

      expect(result).toEqual(updatedUser);
    });

    it('should throw BadRequestException if user not found', async () => {
      // Mock transaction implementation
      db.transaction.mockImplementation((callback) => callback(db));

      // First update succeeds
      db.update.mockReturnValueOnce(db);
      db.set.mockReturnValueOnce(db);
      db.where.mockReturnValueOnce(db);

      // Second update returns empty array
      db.update.mockReturnValueOnce(db);
      db.set.mockReturnValueOnce(db);
      db.where.mockReturnValueOnce(db);
      db.returning.mockReturnValue(Promise.resolve([]));

      await expect(service.firstLogin(dto, userId)).rejects.toThrow(BadRequestException);
    });
  });
  
  /******************
   * UPDATE PASSWORD *
   *****************/

  describe('updatePassword', () => {
    const userId = 'user-1';
    const dto: UpdatePasswordDto = {
      currentPassword: 'CurrentPassword123!',
      newPassword: 'NewPassword456!',
      confirmNewPassword: 'NewPassword456!',
    };

    it('should update the password successfully', async () => {
      const user = {
        ...mockUserResult,
        password: 'hashed-current-password',
        verifiedEmail: true,
      };

      // Mock findOne to return the user
      jest.spyOn(service, 'findOne').mockResolvedValue(user as any);
      
      // Mock bcrypt compare to return true (password valid)
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      
      // Mock bcrypt hash for new password
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new-password');

      db.update.mockReturnValue(db);
      db.set.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.returning.mockReturnValue(Promise.resolve([user]));

      const result = await service.updatePassword(userId, dto);

      expect(service.findOne).toHaveBeenCalledWith(userId);
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.currentPassword, user.password);
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.newPassword, 10);
      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
        password: 'hashed-new-password',
      }));
      expect(result).toEqual({ message: 'Password updated successfully' });
    });

    it('should throw BadRequestException if current password is incorrect', async () => {
      const user = {
        ...mockUserResult,
        password: 'hashed-current-password',
        verifiedEmail: true,
      };

      // Mock findOne to return the user
      jest.spyOn(service, 'findOne').mockResolvedValue(user as any);
      
      // Mock bcrypt compare to return false (password invalid)
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.updatePassword(userId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user not found during update', async () => {
      const user = {
        ...mockUserResult,
        password: 'hashed-current-password',
        verifiedEmail: true,
      };

      // Mock findOne to return the user
      jest.spyOn(service, 'findOne').mockResolvedValue(user as any);
      
      // Mock bcrypt compare to return true (password valid)
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      
      // Mock bcrypt hash for new password
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new-password');

      db.update.mockReturnValue(db);
      db.set.mockReturnValue(db);
      db.where.mockReturnValue(db);
      db.returning.mockReturnValue(Promise.resolve([]));

      await expect(service.updatePassword(userId, dto)).rejects.toThrow(BadRequestException);
    });
  });
});
