import {Inject, Injectable, NestMiddleware, UnauthorizedException} from '@nestjs/common';
import {NextFunction, Request, Response} from 'express';
import {JwtService} from "@nestjs/jwt";
import {jwtConstants} from "./constants";
import {UsersService} from "../users/users.service";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(UsersService)
    private readonly usersService: UsersService
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {

    const [type, token] = req.headers.authorization?.split(" ") ?? [];

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException(
        'Unauthorized access - Invalid token or missing token'
      );
    }

    // We verify the token
    try {
      const payload = await this.jwtService.verifyAsync(
        token,
        {
          secret: jwtConstants.secret
        }
      );

      if (!payload.type || payload.type !== "access") {
        // Go to the catch block
        throw new UnauthorizedException(
          'Unauthorized access - Invalid token or missing token'
        );
      }

      // Fetch the user from the database and attach it to the request object
      req['user'] = await this.usersService.findOne(payload.sub);

      if (!req['user']) {
        // Go to the catch block
        throw new UnauthorizedException(
          'Unauthorized access - Invalid token or missing token'
        );
      }
    } catch {
      throw new UnauthorizedException(
        'Unauthorized access - Invalid token or missing token'
      );
    }

    next();
  }
}