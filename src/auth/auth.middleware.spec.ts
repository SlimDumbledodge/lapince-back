import { AuthMiddleware } from './auth.middleware';
import {JwtService} from "@nestjs/jwt";
import {UsersService} from "../users/users.service";
import {Test, TestingModule} from "@nestjs/testing";
import {UnauthorizedException} from "@nestjs/common";
import {NextFunction, Request, Response} from 'express';

const res = {};

const next: NextFunction = jest.fn();

describe('AuthMiddleware', () => {
  let service: AuthMiddleware;

  const mockUsersService = {
    findById: jest.fn(),
  };
  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        AuthMiddleware,
      ],
    }).compile();

    service = module.get<AuthMiddleware>(AuthMiddleware);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('use', () => {
    it('should throw UnauthorizedException if token is missing', async () => {
      const req = {
        headers: {}
      }

      const result = service.use(req as Request, res as Response, next);

      const expected = new UnauthorizedException({message: 'Unauthorized access - Invalid token or missing token'});

      await expect(result).rejects.toThrowError(expected);
    })

    it('should throw UnauthorizedException if token is not a Bearer', async () => {
      const req = {
        headers: {
          authorization: 'Test token'
        }
      }

      const result = service.use(req as Request, res as Response, next);

      const expected = new UnauthorizedException({message: 'Unauthorized access - Invalid token or missing token'});

      await expect(result).rejects.toThrowError(expected);
    })

    it('should throw UnauthorizedException if token is Invalid', async () => {
      const req = {
        headers: {
          authorization: 'Bearer token'
        }
      }

      mockJwtService.verifyAsync.mockRejectedValueOnce(new Error('Invalid token'));

      const result = service.use(req as Request, res as Response, next);

      const expected = new UnauthorizedException({message: 'Unauthorized access - Invalid token or missing token'});

      await expect(result).rejects.toThrowError(expected);
    })

    it('should throw UnauthorizedException if user is not found', async () => {
      const req = {
        headers: {
          authorization: 'Bearer token'
        }
      }

      mockJwtService.verifyAsync.mockResolvedValueOnce({sub: 'uuid_string'});

      mockUsersService.findById.mockResolvedValueOnce(null);

      const result = service.use(req as Request, res as Response, next);

      const expected = new UnauthorizedException({message: 'Unauthorized access - Invalid token or missing token'});

      await expect(result).rejects.toThrowError(expected);
    })
  })
});