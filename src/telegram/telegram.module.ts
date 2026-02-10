import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegramUpdate } from './telegram.update';
import { SummaryModule } from '../summary/summary.module';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('telegram.botToken'),
        launchOptions: {
          webhook: {
            domain: configService.get<string>('telegram.webhookDomain'),
            path: '/api/telegram-webhook',
          },
        },
      }),
    }),
    SummaryModule,
  ],
  providers: [TelegramUpdate],
})
export class TelegramModule {}
