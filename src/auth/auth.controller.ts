import { Controller, Post, Body, UsePipes, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, LoginDtoSchema } from './dto/login.dto';
import { RefreshDtoSchema, RefreshDto } from './dto/refresh.dto';
import { LogoutDtoSchema, LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto, forgotPasswordSchema } from '../auth/dto/forgot-password.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RegisterDtoSchema, RegisterDto } from './dto/register.dto';
import { ResetPasswordSchema, ResetPasswordDto } from './dto/reset-password.dto';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user
   * @param registerDto
   */
  @Post('signup')
  @UsePipes(new ZodValidationPipe(RegisterDtoSchema))
  register(
    @Body() registerDto: RegisterDto,
    @Req() request: Request,
  ) {
    return this.authService.signUp(registerDto, request.ip, request.headers['user-agent']);
  }

  /**
   * Login a user
   * @param loginDto
   */
  @Post('signin')
  @UsePipes(new ZodValidationPipe(LoginDtoSchema))
  @HttpCode(HttpStatus.OK)
  login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
  ) {
    return this.authService.login(loginDto.email, loginDto.password, request.ip, request.headers['user-agent']);
  }

  /**
   * Refresh a token
   * @param refreshToken
   */
  @Post('token/refresh')
  @UsePipes(new ZodValidationPipe(RefreshDtoSchema))
  @HttpCode(HttpStatus.OK)
  refreshToken(@Body() body: RefreshDto, @Req() request: Request) {
    return this.authService.refreshAccessToken(body.refreshToken, request.ip, request.headers['user-agent']);
  }


  /**
   * Logout a user
   * @param sessionId
   */
  @Post('logout')
  @UsePipes(new ZodValidationPipe(LogoutDtoSchema))
  @HttpCode(HttpStatus.OK)
  logout(@Body() body: LogoutDto) {
    return this.authService.logout(body.sessionId);
  }

  /**
   * Forgot password
   * This endpoint allows a user to request a password reset.
   * @param forgotPasswordDto 
   * @returns 
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK) // Ensure the response is 200 OK, even if the email does not exist
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  /**
   * Reset password
   * This endpoint allows a user to reset their password using a token.
   * @param resetPasswordDto 
   * @returns 
   */
  @Post('reset-password')
  @UsePipes(new ZodValidationPipe(ResetPasswordSchema))
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}