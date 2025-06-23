import { Module, DynamicModule } from "@nestjs/common";
import { SlackService } from "./slack.service";
import { SlackController } from "./slack.controller";
import { HttpModule } from "@nestjs/axios";

@Module({})
export class SlackModule {
  static register(enable: boolean = false): DynamicModule {
    const providers = enable ? [SlackService] : [];
    const controllers = enable ? [SlackController] : [];

    return {
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