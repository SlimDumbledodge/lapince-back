import { HttpService } from "@nestjs/axios";
import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { SlackConfig } from "./slack.config";

@Injectable()
export class SlackService {
  constructor(
    private readonly httpService: HttpService,
  ) {}

  async postToSlack(message: string): Promise<void> {
    if (!SlackConfig.token || !SlackConfig.url || !SlackConfig.channel) {
      throw new HttpException(
        "Slack configuration is missing",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    let response = await firstValueFrom(
      this.httpService.post(
        SlackConfig.url,
        {
          text: message,
          username: SlackConfig.botName,
          channel: SlackConfig.channel,
          icon_emoji: SlackConfig.icon,
        },
        {
          headers: {
            Authorization: `Bearer ${SlackConfig.token}`,
          },
        },
      )
    );
       
    if (!response.data.ok) {
      console.error("Slack API error:", response, response.data);
      throw new HttpException(
        `Failed to post message to Slack: ${response.data.error}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return response.data.message;
  }
}