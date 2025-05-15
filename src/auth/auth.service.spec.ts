import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import {JwtService} from "@nestjs/jwt";
import {UsersService} from "../users/users.service";
import {LoginDto} from "./dto/login.dto";
import {RegisterDto} from "./dto/register.dto";
import 'dotenv/config'
import {UnauthorizedException} from "@nestjs/common";
import * as schema from '../db/schema';

const mockUsersResult: schema.User = {
  id: 'uuid_string',
  firstName: 'John',
  lastName: 'DOE',
  email: 'admin@admin.com',
  password: '$2b$10$gA1jhE5r1FZmj1F5hTRnp.P2Kk3FNadEZemVMdeeIvAeuwTCr5w.C', // admin
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockAccessToken : string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

const expectedUser = {
  user: {
    id: 'uuid_string',
      fullName: null,
      email: 'admin@admin.com',
  },
  access_token: mockAccessToken
}


describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  };
  const mockJwtService = {
    signAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
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

  describe('login', () => {
    it('should login with good credentials', async () => {
      const user: LoginDto = {
        email: 'admin@admin.com',
        password: 'admin',
      }

      mockUsersService.findByEmail.mockResolvedValueOnce(mockUsersResult);

      mockJwtService.signAsync.mockResolvedValueOnce(mockAccessToken);

      const result = await service.login(user.email, user.password);

      expect(result).toEqual(expectedUser)
      expect(mockUsersService.findByEmail).toBeCalledWith(user.email);
      expect(mockJwtService.signAsync).toBeCalledWith({ email: user.email, sub: 'uuid_string' }, { expiresIn: process.env.JWT_EXPIRES_IN ?? '6h' });
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

  describe('register', () => {
    it('should register a user', async () => {
      const user: RegisterDto = {
        firstName: 'John',
        lastName: 'DOE',
        email: 'admin@admin.com',
        password: 'admin',
      }

      mockUsersService.findByEmail.mockResolvedValueOnce(null)

      mockUsersService.create.mockResolvedValueOnce([mockUsersResult])

      mockJwtService.signAsync.mockResolvedValueOnce(mockAccessToken);

      const result = await service.signUp(user);

      expect(result).toEqual(expectedUser)
      expect(mockUsersService.findByEmail).toBeCalledWith(user.email);
      expect(mockJwtService.signAsync).toBeCalledWith({ email: user.email, sub: 'uuid_string' }, { expiresIn: process.env.JWT_EXPIRES_IN ?? '6h' });
    })

    it('should not register a user with an existing email', async () => {
      const user: RegisterDto = {
        firstName: 'John',
        lastName: 'DOE',
        email: 'admin@admin.com',
        password: 'admin',
      }

      mockUsersService.findByEmail.mockResolvedValueOnce(mockUsersResult)

      const result = service.signUp(user);

      const expected = new UnauthorizedException({ message: 'Email already exists' });

      await expect(result).rejects.toThrow(expected);
    })
  })
});