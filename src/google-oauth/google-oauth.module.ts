import { Module, DynamicModule } from "@nestjs/common";
import { GoogleService } from "./google-oauth.service";
import { ConfigModule } from "@nestjs/config";
import { GoogleController } from "./google-oauth.controller";
import { AuthModule } from "src/auth/auth.module";

interface IGoogleModuleOptions {
  enabled: boolean;
  credentialsPath?: string;
  scopesAPI?: string;
}

@Module({})
export class GoogleModule {
  static forRoot(options: IGoogleModuleOptions = { enabled: false }): DynamicModule {

    if (!options.enabled) {
      return {
        module: GoogleModule,
        imports: [ConfigModule],
        providers: [],
        controllers: [],
        exports: [],
      };
    }

    return {
      module: GoogleModule,
      imports: [ConfigModule, AuthModule],
      providers: [GoogleService],
      controllers: [GoogleController],
      exports: [GoogleService],
    };
  }
}