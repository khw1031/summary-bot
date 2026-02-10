import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { TelegramModule } from './telegram/telegram.module';
import { SummaryModule } from './summary/summary.module';
import { LlmModule } from './llm/llm.module';
import { GithubModule } from './github/github.module';
import { ExtractorModule } from './extractor/extractor.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TelegramModule,
    SummaryModule,
    LlmModule,
    GithubModule,
    ExtractorModule,
    HealthModule,
  ],
})
export class AppModule {}
