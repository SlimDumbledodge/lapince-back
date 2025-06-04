import { Injectable, Logger } from '@nestjs/common';
import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendEmail(params: {
    to: string | string[];
    subject: string;
    template: string;
    context: ISendMailOptions['context'];
  }): Promise<void> {
    try {

      const sendMailParams = {
        to: params.to,
        from: process.env.SMTP_FROM,
        subject: params.subject,
        template: params.template,
        context: params.context,
      };

      const result = await this.mailerService.sendMail(sendMailParams);

      this.logger.log(
        `Email sent successfully to ${Array.isArray(params.to) ? params.to.join(', ') : params.to}`,
      );

    } catch (error) {
      this.logger.error(
        `Error while sending mail with the following parameters : ${JSON.stringify(
          params,
        )}`,
        error,
      );
    }
  }

}
