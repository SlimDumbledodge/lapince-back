import { Module, DynamicModule, Global } from "@nestjs/common";
import { SlackService } from "./slack.service";
import { SlackController } from "./slack.controller";
import { HttpModule } from "@nestjs/axios";

interface SlackModuleOptions {
  enable?: boolean;
  isGlobal?: boolean;
}

@Global()
@Module({})
export class SlackModule {
  static register(options: SlackModuleOptions = {}): DynamicModule {
    const providers = options.enable ? [SlackService] : [];
    const controllers = options.enable ? [SlackController] : [];

    return {
      global: options.isGlobal,
      module: SlackModule,
      imports: [
        HttpModule.register({
          timeout: 5000,
          maxRedirects: 5,
        }),
      ],
      providers,
      controllers,
      exports: providers,
    };
  }
}