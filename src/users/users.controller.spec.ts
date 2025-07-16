import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { 
  mockUserResult, 
  mockUpdatedUserResult, 
  mockFirstLoginResult 
} from '../../__mock__/users';
import { UpdateUserDto } from './dto/update-user.dto';
import { FirstLoginDto } from './dto/first-login.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUser = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    password: '$2b$10$1234567890123456789012',
    accountType: 'in-app' as 'in-app', // Type assertion to match enum type
    locale: 'fr-FR' as 'fr-FR', // Type assertion to match enum type
    avatar: 'https://example.com/avatar.jpg',
    firstLogin: true,
    verifiedEmail: true,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    accountId: 'account-1',
    accountName: 'My Account',
    amount: 1000
  } as const;

  beforeEach(async () => {
    const mockUsersService = {
      findOne: jest.fn(),
      update: jest.fn(),
      firstLogin: jest.fn(),
      updatePassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService }
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findOne', () => {
    it('should return the current user', async () => {
      const user = {
        ...mockUserResult,
        verifiedEmail: true,
        accountType: 'in-app' as 'in-app',
        locale: 'fr-FR' as 'fr-FR',
        avatar: 'https://example.com/avatar.jpg',
        accountId: 'account-1',
        accountName: 'My Account',
        amount: 1000
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(user as any);

      const result = await controller.findOne(mockUser);

      expect(service.findOne).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(user);
    });
  });

  describe('update', () => {
    it('should update and return the user', async () => {
      const updateDto: UpdateUserDto = {
        firstName: 'John Updated',
        lastName: 'Doe Updated',
        email: 'john.updated@example.com',
      };

      const updatedUser = {
        ...mockUpdatedUserResult,
        verifiedEmail: true,
        accountType: 'in-app' as 'in-app',
        locale: 'en-US' as 'en-US'
      };
      jest.spyOn(service, 'update').mockResolvedValue(updatedUser);

      const result = await controller.update(updateDto, mockUser);

      expect(service.update).toHaveBeenCalledWith(mockUser.id, updateDto);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('firstLogin', () => {
    it('should process first login and return updated user', async () => {
      const firstLoginDto: FirstLoginDto = {
        totalAmount: 1000,
        accountName: 'My Account',
        currency: 'EUR',
        locale: 'en-US',
      };

      const updatedUser = {
        ...mockFirstLoginResult,
        verifiedEmail: true,
        accountType: 'in-app' as 'in-app',
        locale: 'en-US' as 'en-US',
        avatar: 'https://example.com/avatar.jpg'
      };
      jest.spyOn(service, 'firstLogin').mockResolvedValue(updatedUser);

      const result = await controller.firstLogin(firstLoginDto, mockUser);

      expect(service.firstLogin).toHaveBeenCalledWith(firstLoginDto, mockUser.id);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('updatePassword', () => {
    it('should update the password', async () => {
      const updatePasswordDto: UpdatePasswordDto = {
        currentPassword: 'CurrentPassword123!',
        newPassword: 'NewPassword456!',
        confirmNewPassword: 'NewPassword456!',
      };

      const successResponse = { message: 'Password updated successfully' };
      jest.spyOn(service, 'updatePassword').mockResolvedValue(successResponse);

      const result = await controller.updatePassword(updatePasswordDto, mockUser);

      expect(service.updatePassword).toHaveBeenCalledWith(mockUser.id, updatePasswordDto);
      expect(result).toEqual(successResponse);
    });
  });
});
