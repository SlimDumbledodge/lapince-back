import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import {UsersModule} from "../users/users.module";
import {JwtModule} from "@nestjs/jwt";
import {jwtConstants} from "./constants";
import { UserAccountModule } from 'src/user-account/user-account.module';
import { DrizzleModule } from 'src/db/drizzle/drizzle.module';

@Module({
  imports: [
    UsersModule,
    UserAccountModule,
    DrizzleModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '15m' }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}