import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import {UsersModule} from "../users/users.module";
import {JwtModule} from "@nestjs/jwt";
import {jwtConstants} from "./constants";
import { UserAccountModule } from 'src/user-account/user-account.module';
import { DrizzleModule } from 'src/db/drizzle/drizzle.module';
import { MailModule } from 'src/mail/mail.module';
import { GoogleModule } from 'src/google-oauth/google-oauth.module';

@Module({
  imports: [
    UsersModule,
    UserAccountModule,
    DrizzleModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '15m' }
    }),
    MailModule,
    GoogleModule.forRoot({
      enabled: process.env.ENABLED_GOOGLE_AUTH === 'true',
      credentialsPath: process.env.GOOGLE_CREDENTIALS_PATH || 'google-credentials.json',
      scopesAPI: process.env.GOOGLE_SCOPES_API || 'email,profile'
    })
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}