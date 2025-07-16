import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import {JwtService} from "@nestjs/jwt";
import {UsersService} from "../users/users.service";
import { UserAccountService } from 'src/user-account/user-account.service';
import { MailService } from 'src/mail/mail.service';
import {LoginDto} from "./dto/login.dto";
import {RegisterDto} from "./dto/register.dto";
import 'dotenv/config'
import {UnauthorizedException} from "@nestjs/common";
import { mockUsersResult, expectedUser, mockAccessToken } from '../../__mock__/auth';


describe('AuthService', () => {
  let service: AuthService;
  let db: any;
  let mockUsersService: any;
  let mockJwtService: any;
  let mockUserAccountService: any;
  let mockMailService: any;
  let mockAuthService: any;

  beforeEach(async () => {

    db = {
      transaction: jest.fn(),
      select: jest.fn(),
      insert: jest.fn(() => ({
          values: jest.fn(),
        })),
      update: jest.fn(),
      delete: jest.fn(),
    };    
    mockUsersService = {findByEmail: jest.fn(), create: jest.fn()};
    mockJwtService = {signAsync: jest.fn()};
    mockUserAccountService = {create: jest.fn()};
    mockMailService = {sendPasswordResetEmail: jest.fn()};
    mockAuthService = {createToken: jest.fn()};

    const module: TestingModule = await Test.createTestingModule({  
      providers: [
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: UserAccountService, useValue: mockUserAccountService },
        { provide: MailService, useValue: {} },
        { provide: 'DrizzleAsyncProvider', useValue: db },
        AuthService
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks()
    jest.resetAllMocks()
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /******************
   *     SIGNUP     *
   *****************/

  describe('signup', () => {
    it('should register a user', async () => {
      const user: RegisterDto = {
        firstName: 'John',
        lastName: 'DOE',
        email: 'admin@admin.com',
        password: 'admin',
        accountName: 'My Account',
        amount: 1000,
        locale: 'fr-FR',
      }

      mockUsersService.findByEmail.mockResolvedValueOnce(null)

      mockUsersService.create.mockResolvedValueOnce([mockUsersResult])

      mockJwtService.signAsync.mockResolvedValueOnce(mockAccessToken);

      mockUserAccountService.create.mockResolvedValueOnce({
        id: 'uuid_string',
        accountName: user.accountName,
        amount: user.amount,
      });

      jest.spyOn(service as any, 'createToken').mockImplementation(async () => (expectedUser));

      const result = await service.signUp(user);

      expect(result).toEqual(expectedUser)
    })

    it('should not register a user with an existing email', async () => {
      const user: RegisterDto = {
        firstName: 'John',
        lastName: 'DOE',
        email: 'admin@admin.com',
        password: 'admin',
        accountName: 'My Account',
        amount: 1000,
        locale: 'fr-FR',
      }

      mockUsersService.findByEmail.mockResolvedValueOnce(mockUsersResult)

      const result = service.signUp(user);

      const expected = new UnauthorizedException({ message: 'Invalid credentials' });

      await expect(result).rejects.toThrow(expected);
    })
  })

  /*****************
   *     LOGIN     *
   *****************/

  describe('login', () => {
    it('should login with good credentials', async () => {
      const user: LoginDto = {
        email: 'admin@admin.com',
        password: 'admin',
      }

      mockUsersService.findByEmail.mockResolvedValueOnce(mockUsersResult);

      mockJwtService.signAsync.mockResolvedValueOnce(mockAccessToken);

      jest.spyOn(service as any, 'createToken').mockImplementation(async () => (expectedUser));

      const result = await service.login(user.email, user.password);

      expect(result).toEqual(expectedUser)
    })

    it('should not login with bad email credentials', async () => {
      const user: LoginDto = {
        email: 'test@test.fr',
        password: 'admin',
      }

      mockUsersService.findByEmail.mockResolvedValueOnce(null)

      mockJwtService.signAsync.mockResolvedValueOnce('token');

      const result = service.login(user.email, user.password);

      const expected = new UnauthorizedException({ message: 'Invalid credentials' });

      await expect(result).rejects.toThrow(expected);
    })

    it('should not login with bad password credentials', async () => {
      const user: LoginDto = {
        email: 'admin@test.fr',
        password: 'password',
      }

      mockUsersService.findByEmail.mockResolvedValueOnce(mockUsersResult)

      const result = service.login(user.email, user.password);

      const expected = new UnauthorizedException({ message: 'Invalid credentials' });

      await expect(result).rejects.toThrow(expected);
    })
  })

  /********************************
   *     REFRESH ACCESS TOKEN     *
   ********************************/
  describe('refreshAccessToken', () => {
    it('token is not a reshresh token', async () => {
      mockJwtService.signAsync.mockResolvedValueOnce({
        accessToken: mockAccessToken,
        type: 'access',
        sub: 'uuid_string',
        sid: 'uuid_string',
      });

      const result = service.refreshAccessToken(mockAccessToken);
      const expected = new UnauthorizedException({ message: 'Invalid refresh token' });

      await expect(result).rejects.toThrow(expected);
    })
  })
});