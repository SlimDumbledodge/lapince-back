import { Controller, Get, Query, Redirect } from "@nestjs/common";
import { GoogleService } from "./google-oauth.service";

@Controller('google-oauth')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) { }

  @Get('google-auth')
  @Redirect()
  async googleAuth(): Promise<{ url: string }> {
    return this.googleService.getOAuth2ClientUrl();
  }

  @Get('google-callback')
  @Redirect()
  async googleAuthCallback(@Query('code') code: string): Promise<{ url: string }> {
    const { email, refreshToken, accessToken } = await this.googleService.getAuthClientData(code);
    // Implement additional sign-in logic here
    return { url: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/dashboard' };
  }
}