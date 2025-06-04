import { Controller, Post, Body, UsePipes, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, LoginDtoSchema } from './dto/login.dto';
import { RefreshDtoSchema, RefreshDto } from './dto/refresh.dto';
import { LogoutDtoSchema, LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto, forgotPasswordSchema } from '../auth/dto/forgot-password.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RegisterDtoSchema, RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user
   * @param registerDto
   */
  @Post('signup')
  @UsePipes(new ZodValidationPipe(RegisterDtoSchema))
  register(@Body() registerDto: RegisterDto) {
    return this.authService.signUp(registerDto);
  }

  /**
   * Login a user
   * @param loginDto
   */
  @Post('signin')
  @UsePipes(new ZodValidationPipe(LoginDtoSchema))
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  /**
   * Refresh a token
   * @param refreshToken
   */
  @Post('token/refresh')
  @UsePipes(new ZodValidationPipe(RefreshDtoSchema))
  @HttpCode(HttpStatus.OK)
  refreshToken(@Body() body: RefreshDto) {
    return this.authService.refreshAccessToken(body.refreshToken);
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
}