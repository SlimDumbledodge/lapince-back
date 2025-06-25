import { Controller, Get } from "@nestjs/common";
import { SlackService } from "./slack.service";

@Controller('slack')
export class SlackController {
  constructor(private readonly slackService: SlackService) {}

  @Get()
  async postToSlack(): Promise<void> {
    const message = "Hello from NestJS!";
    return this.slackService.postToSlack(message);
  }
}