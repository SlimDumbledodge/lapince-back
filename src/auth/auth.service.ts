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
    const payload = { email: user.email, sub: user.id };

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
      access_token: await this.jwtService.signAsync(payload, {expiresIn: process.env.JWT_EXPIRES_IN ?? '15m'}),
      access_token_expires_at: new Date(Date.now() + ms(process.env.JWT_EXPIRES_IN ?? '15m')),
      refresh_token: refresh_token.refresh_token,
      refresh_token_expires_at: refresh_token.expiresAt,
    };
  }

  private async createRefreshToken(user: schema.User) {
    const payload = { sub: user.id };

    const refresh_token = await this.jwtService.signAsync(payload, {expiresIn: process.env.JWT_REFRESH_EXPIRES_IN?? '7d'});
    const expiresAt = new Date(Date.now() + ms(process.env.JWT_REFRESH_EXPIRES_IN?? '7d'));

    // TODO : get IP address and User Agent in the request

    await this.db.insert(schema.sessions).values({
      userId: user.id,
      tokenHash: await bcrypt.hash(refresh_token, 10),
      expiresAt
    })

    return {
      refresh_token,
      expiresAt
    };
  }
}