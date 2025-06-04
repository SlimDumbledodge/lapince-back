import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';

@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: () => {
        const transportOptions: any = {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587", 10),
          secure: process.env.SMTP_SECURE === 'true',
          tls: {
            rejectUnauthorized: false,
          },
        };

        if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
          transportOptions.auth = {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          };
        }

        return {
          transport: transportOptions,
          defaults: {
            from: process.env.SMTP_FROM,
          },
          template: {
            dir: __dirname + '../../../templates',
            adapter: new PugAdapter(),
            options: { strict: true },
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule { }
