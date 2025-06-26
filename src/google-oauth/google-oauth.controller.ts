import { Controller, Get, Query, Redirect } from "@nestjs/common";
import { GoogleService } from "./google-oauth.service";
import { AuthService } from "src/auth/auth.service";

@Controller('google-oauth')
export class GoogleController {
  constructor(
    private readonly googleService: GoogleService, 
    private readonly authService: AuthService
  ) { }

  @Get('google-auth')
  @Redirect()
  async googleAuth(): Promise<{ url: string }> {
    return this.googleService.getOAuth2ClientUrl();
  }

  @Get('google-callback')
  @Redirect()
  async googleAuthCallback(@Query('code') code: string): Promise<{ url: string }> {
    const { userData, refreshToken, accessToken } = await this.googleService.getAuthClientData(code);

    if (!userData || !userData.email) {
      throw new Error('Failed to retrieve user data from Google');
    }
    
    // Login/Register the user in your application
    const user = await this.authService.googleAuth(userData);

    return { url: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/dashboard' };
  }
}