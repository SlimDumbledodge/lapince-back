import { HttpService } from "@nestjs/axios";
import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { SlackConfig } from "./slack.config";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class SlackService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) { }

  async postToSlack(message: string, level: "error" | "success" | "info" | "warning" = "info"): Promise<void> {

    function getSlackColor(level: string): string {
      switch (level) {
        case 'success':
          return '#2eb886';
        case 'warning':
          return '#ffcc00';
        case 'error':
          return '#e01e5a';
        default:
          return '#439FE0';
      }
    }

    function getTitle(level: string): string {
      switch (level) {
        case 'success':
          return '✅ Nouvelle notification';
        case 'warning':
          return '⚠️ Nouvelle notification';
        case 'error':
          return '🚨 Nouvelle notification';
        default:
          return 'ℹ️ Nouvelle notification';
      }
    }

    if (!SlackConfig.token || !SlackConfig.url || !SlackConfig.channel) {
      throw new HttpException(
        "Slack configuration is missing",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const payload = {
      channel: SlackConfig.channel,
      username: SlackConfig.botName,
      icon_emoji: SlackConfig.icon,
      text: message,
      attachments: [
        {
          color: getSlackColor(level),
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: getTitle(level),
                emoji: true
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${message}*`
              }
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Voir plus 🔍"
                  },
                  url: this.configService.get<string>("FRONTEND_URL") || "http://localhost:3000",
                  style: "primary"
                }
              ]
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Posté par <@${SlackConfig.botName}> - ${new Date().toLocaleString()}`
                }
              ]
            }
          ]
        }
      ],
    };

    const response = await firstValueFrom(
      this.httpService.post(
        SlackConfig.url,
        payload,
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

    return;
  }
}