import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import {UsersService} from "../users/users.service";
import { UserAccountService } from 'src/user-account/user-account.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import 'dotenv/config'
import {RegisterDto} from "./dto/register.dto";
import * as schema from '../db/schema';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import ms from 'ms';
import {jwtConstants} from "./constants";
import { and, eq } from 'drizzle-orm';
import {v4 as uuidv4} from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(UserAccountService) private readonly userAccountService: UserAccountService,
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async signUp(registerDto: RegisterDto) {
    const user = await this.usersService.create({
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      email: registerDto.email,
      password: registerDto.password
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const userAccount = await this.userAccountService.create({
      accountName: registerDto.accountName,
      amount: registerDto.amount,
    }, user.id)

    const data = {
      ...user,
      userAccountId: userAccount.id,
      accountName: userAccount.accountName,
      amount: userAccount.amount,
    }

    return this.createToken(data);
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // compare password
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createToken(user);
  }

  private async createToken(user: schema.User & {accountName: string, amount: number}) {
    const payload = { email: user.email, sub: user.id, type: 'access' };

    const refresh_token = await this.createRefreshToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        accountName: user.accountName,
        amount: user.amount,
      },
      sessionId: refresh_token.sessionId,
      accessToken: await this.jwtService.signAsync(payload, {expiresIn: process.env.JWT_EXPIRES_IN ?? '15m'}),
      accessTokenExpiresAt: new Date(Date.now() + ms(process.env.JWT_EXPIRES_IN ?? '15m')),
      refreshToken: refresh_token.refreshToken,
      refreshTokenExpiresAt: refresh_token.expiresAt,
    };
  }

  private async createRefreshToken(user: schema.User) {
    const sessionId = uuidv4();

    const payload = { sub: user.id, type: 'refresh', sid: sessionId };

    const refreshToken = await this.jwtService.signAsync(
      payload, 
      {expiresIn: process.env.JWT_REFRESH_EXPIRES_IN?? '7d'}
    );
    const expiresAt = new Date(Date.now() + ms(process.env.JWT_REFRESH_EXPIRES_IN?? '7d'));

    // TODO : get IP address and User Agent in the request

    await this.db.insert(schema.sessions).values({
      id: sessionId,
      userId: user.id,
      tokenHash: await bcrypt.hash(refreshToken, 10),
      expiresAt
    })

    return {
      refreshToken,
      expiresAt,
      sessionId: sessionId
    };
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(
        refreshToken,
        {
          secret: jwtConstants.secret
        }
      );
  
      if (payload.type !== 'refresh' || !payload.sub || !payload.sid) {
        throw new UnauthorizedException('Invalid token type');
      }
  
      // verify the user
      const user = await this.usersService.findOne(payload.sub);
  
      if (!user) {
        throw new UnauthorizedException('Invalid user');
      }
  
      // get all unrevoked sessions for the user
      const tokens = await this.db
        .select()
        .from(schema.sessions)
        .where(and(eq(schema.sessions.userId, payload.sub), eq(schema.sessions.isRevoked, false), eq(schema.sessions.id, payload.sid)));
  
      const valid = await Promise.all(
        tokens.map(async token => ({
          match: await bcrypt.compare(refreshToken, token.tokenHash),
          token,
        }))
      );
  
      const found = valid.find(t => t.match);
  
      if (!found) {
        throw new UnauthorizedException('Invalid refresh token');
      }
  
      const newAccessToken = this.jwtService.sign(
        { sub: payload.sub, type: 'access' },
        { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' }
      );
  
      const expiresAt = new Date(Date.now() + ms(process.env.JWT_EXPIRES_IN?? '15m'));
  
      return {
        accessToken: newAccessToken,
        accessTokenExpiresAt: expiresAt,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  } 

  // TODO : add cron jobs to delete expired sessions
}