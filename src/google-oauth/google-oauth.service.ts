import { Injectable, OnModuleInit, Logger, BadRequestException } from '@nestjs/common';
import { google, oauth2_v2 } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { auth, OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GoogleService implements OnModuleInit {
  private readonly logger = new Logger(GoogleService.name);

  private readonly scopesAPI: string[];
  private readonly credentialsPath: string;

  constructor(private configService: ConfigService) {
    this.credentialsPath = path.join(
      process.cwd(),
      this.configService.get('GOOGLE_CREDENTIALS_PATH') || 'google-credentials.json',
    );
    this.scopesAPI = this.configService.get('GOOGLE_SCOPES_API').split(',');
  }

  onModuleInit() {
    if (!fs.existsSync(this.credentialsPath)) {
      this.logger.error(
        `Google credentials file not found at path: ${this.credentialsPath}`,
      );
      throw new Error(
        `Google credentials file not found at path: ${this.credentialsPath}`,
      );
    }
  }


  readCredentials(filePath: string): IGoogleAuthCredentials {
    const credentialsPath = path.join(filePath);
    const content: string = fs.readFileSync(credentialsPath, 'utf-8');
    return JSON.parse(content);
  }

  async getOAuth2ClientUrl(): Promise<{ url: string }> {
    const authClient = this.getAuthClient();
    return this.getAuthUrl(authClient);
  }

  getAuthClient(): OAuth2Client {
    const keys: IGoogleAuthCredentials = this.readCredentials(
      this.credentialsPath,
    );
    const authClient = new OAuth2Client(
      keys.web.client_id,
      keys.web.client_secret,
      keys.web.redirect_uris[0],
    );
    return authClient;
  }

  getAuthUrl(authClient: OAuth2Client): { url: string } {
    // Generate the url that will be used for the consent dialog.
    const authorizeUrl = authClient.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopesAPI,
      prompt: 'consent',
      include_granted_scopes: true,
    });
    return { url: authorizeUrl };
  }

  async getAuthClientData(
    code: string,
  ): Promise<{ userData: oauth2_v2.Schema$Userinfo; refreshToken: string; accessToken: string }> {
    try {
      const authClient = this.getAuthClient();
      const tokenData = await authClient.getToken(code);
      const tokens = tokenData.tokens;
      const refreshToken = tokens?.refresh_token || '';
      const accessToken = tokens?.access_token || '';

      authClient.setCredentials(tokens);

      const googleAuth = google.oauth2({
        version: 'v2',
        auth: authClient,
      } as any);

      const googleUserInfo = await googleAuth.userinfo.get();
 
      const userData = googleUserInfo.data;
      return { userData, refreshToken, accessToken };
    } catch (error) {
      this.logger.error('Error getting auth client data', error);
      throw new BadRequestException('Failed to get auth client data');
    }
  }
}

export interface IGoogleAuthCredentials {
  web: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    javascript_origins: string[];
  };
}

export interface IGoogleAuthUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}