import { Injectable, Inject, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
import { UsersService } from "../users/users.service";
import { UserAccountService } from 'src/user-account/user-account.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import 'dotenv/config'
import { RegisterDto } from "./dto/register.dto";
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as schema from '../db/schema';
import { DrizzleAsyncProvider } from 'src/db/drizzle/drizzle.provider';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import ms from 'ms';
import { jwtConstants } from "./constants";
import { and, eq, or, lt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailService } from 'src/mail/mail.service';
import { oauth2_v2 } from 'googleapis';

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(UserAccountService) private readonly userAccountService: UserAccountService,
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(MailService) private readonly mailService: MailService
  ) { }

  private readonly logger = new Logger(AuthService.name);

  /**
   * Registers a new user and creates an associated user account.
   * @param registerDto - Registration data transfer object.
   * @returns An object containing access and refresh tokens along with user information.
   * @throws {UnauthorizedException} If user creation fails.
   */
  async signUp(registerDto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const user = await this.usersService.create({
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      email: registerDto.email,
      password: registerDto.password,
      accountType: 'in-app',
      locale: registerDto.locale || 'fr-FR',
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
      currency: userAccount.currency || 'EUR', // Default currency
    }

    return this.createToken(data, ipAddress, userAgent);
  }

  /**
   * Authenticates a user using email and password.
   * @param email - User's email.
   * @param password - User's plain text password.
   * @returns An object containing access and refresh tokens along with user information.
   * @throws {UnauthorizedException} If credentials are invalid.
   */
  async login(email: string, password: string, ipAddress?: string, userAgent?: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // compare password
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createToken(user, ipAddress, userAgent);
  }

  /**
   * Verify and login/register a user using Google OAuth.
   * @param googleUser - The user data returned from Google OAuth.
   * @returns An object containing access and refresh tokens along with user information.
   * @throws {UnauthorizedException} If user creation fails.
   */
  async googleAuth(googleUser: oauth2_v2.Schema$Userinfo, ipAddress?: string, userAgent?: string) {
    if (!googleUser.email) {
      throw new UnauthorizedException('Google user email is required');
    }

    const user = await this.usersService.findByEmail(googleUser.email);

    if (!user) {
      // If user does not exist, create a new user
      const newUser = await this.usersService.create({
        firstName: googleUser.given_name || '',
        lastName: googleUser.family_name || '',
        email: googleUser.email,
        password: uuidv4(), // Generate a random password
        accountType: 'google',
        locale: 'fr-FR', // Default locale, can be changed later
        avatar: googleUser.picture || undefined,
      });

      if (!newUser) {
        throw new UnauthorizedException('Failed to create user');
      }

      // Create a default user account for the new user
      const userAccount = await this.userAccountService.create({
        accountName: 'Default Account',
        amount: 0,
      }, newUser.id);

      return this.createToken({
        ...newUser,
        accountName: userAccount.accountName,
        amount: userAccount.amount,
        currency: userAccount.currency || 'EUR', // Default currency
      }, ipAddress, userAgent);
    }

    return this.createToken(user, ipAddress, userAgent);
  }

  /**
   * Generates and returns access and refresh tokens for a user.
   * @param user - The user entity with account information.
   * @returns An object containing JWT tokens and user session data.
   */
  private async createToken(user: schema.User & { accountName: string, amount: number, currency: string }, ipAddress?: string, userAgent?: string) {
    const payload = { email: user.email, sub: user.id, type: 'access' };

    const refresh_token = await this.createRefreshToken(user, ipAddress, userAgent);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        accountName: user.accountName,
        amount: user.amount,
        firstLogin: user.firstLogin,
        avatar: user.avatar,
        locale: user.locale,
        verifiedEmail: user.verifiedEmail,
        currency: user.currency || 'EUR', // Default currency
      },
      sessionId: refresh_token.sessionId,
      accessToken: await this.jwtService.signAsync(payload, { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' }),
      accessTokenExpiresAt: new Date(Date.now() + ms(process.env.JWT_EXPIRES_IN ?? '15m')),
      refreshToken: refresh_token.refreshToken,
      refreshTokenExpiresAt: refresh_token.expiresAt,
    };
  }

  /**
   * Creates a new refresh token and stores its hashed version in the database.
   * @param user - The user entity.
   * @returns The plain refresh token, its expiration date, and session ID.
   */
  private async createRefreshToken(user: schema.User, ipAddress?: string, userAgent?: string) {
    const sessionId = uuidv4();

    const payload = { sub: user.id, type: 'refresh', sid: sessionId };

    const refreshToken = await this.jwtService.signAsync(
      payload,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d' }
    );
    const expiresAt = new Date(Date.now() + ms(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'));

    // TODO : get IP address and User Agent in the request

    await this.db.insert(schema.sessions).values({
      id: sessionId,
      userId: user.id,
      tokenHash: await bcrypt.hash(refreshToken, 10),
      ipAddress: ipAddress ?? 'unknown',
      userAgent: userAgent ?? 'unknown',
      expiresAt
    })

    return {
      refreshToken,
      expiresAt,
      sessionId: sessionId
    };
  }

  /**
   * Refreshes the access token using a valid refresh token.
   * @param refreshToken - The JWT refresh token.
   * @returns A new access token and its expiration date.
   * @throws {UnauthorizedException} If token is invalid or session is not found.
   */
  async refreshAccessToken(refreshToken: string, ipAddress?: string, userAgent?: string) {
    // TODO : check if the ip address and user agent match the session (security measure if the refresh or access token is stolen)
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

      const expiresAt = new Date(Date.now() + ms(process.env.JWT_EXPIRES_IN ?? '15m'));

      return {
        accessToken: newAccessToken,
        accessTokenExpiresAt: expiresAt,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Logs out a user by revoking a specific session.
   * @param sessionId - The ID of the session to revoke.
   * @returns A success message.
   * @throws {UnauthorizedException} If the session is invalid or already revoked.
   */
  async logout(sessionId: string) {
    const result = await this.db
      .update(schema.sessions)
      .set({ isRevoked: true })
      .where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.isRevoked, false)));

    if (result.rowCount === 0) {
      throw new UnauthorizedException('Invalid session');
    }

    return {
      message: 'Logged out'
    };
  }

  /**
   * Deletes all revoked or expired sessions from the database.
   * @returns A success message.
   */
  async removeRevokedSessions() {
    await this.db
      .delete(schema.sessions)
      .where(or(eq(schema.sessions.isRevoked, true), lt(schema.sessions.expiresAt, new Date())));

    return {
      message: 'Revoked sessions removed'
    };
  }

  /**
   * Scheduled task (runs daily at midnight) to clean up revoked or expired sessions.
   * Logs a debug message after execution.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    await this.removeRevokedSessions();

    // TODO : send a message to admin after good cron jobs excution

    this.logger.debug('Cron job executed');
  }

  /**
   * Handles forgot password requests by generating a reset link and sending it via email.
   * @param forgotPasswordDto - Contains the user's email.
   * @returns A generic success message regardless of email existence.
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);

    if (!user) {
      return {
        message: 'If the email exists, a password reset link has been sent.',
      }; // Do not reveal if the email exists or not for security reasons
    }

    const payload = { sub: user.id, type: 'forgot-password' }
    const token = await this.jwtService.signAsync(payload, { expiresIn: process.env.JWT_FORGOT_PASSWORD_EXPIRES_IN ?? '15m' })

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await this.mailService.sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      template: 'reset-password',
      context: {
        firstName: user.firstName,
        lastName: user.lastName,
        resetLink,
      },
    });

    return {
      message: 'If the email exists, a password reset link has been sent.',
    };
  }

  /**
   * Resets the user's password using a valid reset token.
   * @param resetPasswordDto - Contains the new password and reset token.
   * @returns A success message.
   * @throws {BadRequestException} If token is invalid or expired.
   * @throws {UnauthorizedException} If the update fails.
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    try {
      const payload = await this.jwtService.verifyAsync(resetPasswordDto.token, {
        secret: jwtConstants.secret,
      });

      if (payload.type !== 'forgot-password' || !payload.sub) {
        throw new UnauthorizedException('Invalid token');
      }

      const user = await this.usersService.findOne(payload.sub);

      const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

      try {
        await this.db.update(schema.users)
          .set({ password: hashedPassword })
          .where(eq(schema.users.id, user.id));

        // TODO : Revoke all sessions for the user after password reset
        // TODO : Revoke the forgot password token

      } catch (error) {
        throw new UnauthorizedException('Failed to reset password');
      }

      return {
        message: 'Password has been reset successfully',
      };
    }
    catch (error) {
      throw new BadRequestException('Invalid or expired token !');
    }
  }
}