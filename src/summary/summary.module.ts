import { Module } from '@nestjs/common';
import { SummaryService } from './summary.service';
import { LlmModule } from '../llm/llm.module';
import { ExtractorModule } from '../extractor/extractor.module';
import { GithubModule } from '../github/github.module';

@Module({
  imports: [LlmModule, ExtractorModule, GithubModule],
  providers: [SummaryService],
  exports: [SummaryService],
})
export class SummaryModule {}
