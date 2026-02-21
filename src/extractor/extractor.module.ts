import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExtractorService } from './extractor.service';

@Module({
  imports: [ConfigModule],
  providers: [ExtractorService],
  exports: [ExtractorService],
})
export class ExtractorModule {}
