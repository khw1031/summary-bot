import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LlmService } from '../llm/llm.service';
import { ExtractorService } from '../extractor/extractor.service';
import { GithubService } from '../github/github.service';
import { SummaryResult } from '../llm/llm.interface';

interface CacheEntry {
  result: SummaryResult;
  sourceUrl: string;
  githubUrl: string;
  expiresAt: number;
}

const CACHE_TTL = 600_000; // 10 minutes

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly llmService: LlmService,
    private readonly extractorService: ExtractorService,
    private readonly githubService: GithubService,
  ) {}

  async processMessage(
    text: string,
  ): Promise<{ cacheKey: string; result: SummaryResult; githubUrl: string }> {
    const extracted = await this.extractorService.extract(text);
    const sourceUrl = extracted.url;

    this.logger.log(
      sourceUrl
        ? `Processing URL: ${sourceUrl}`
        : 'Processing plain text input',
    );

    const result = await this.llmService.summarize(extracted.content);
    const githubUrl = await this.githubService.saveMarkdown(result, sourceUrl);
    const cacheKey = randomUUID();

    this.cache.set(cacheKey, {
      result,
      sourceUrl,
      githubUrl,
      expiresAt: Date.now() + CACHE_TTL,
    });

    this.logger.log(`Summary saved to GitHub and cached with key: ${cacheKey}`);

    return { cacheKey, result, githubUrl };
  }

  async saveToGithub(cacheKey: string, sourceUrl: string): Promise<string> {
    const entry = this.getFromCache(cacheKey);
    if (!entry) {
      throw new Error(`Cache entry not found or expired: ${cacheKey}`);
    }

    const url = await this.githubService.saveMarkdown(
      entry.result,
      sourceUrl || entry.sourceUrl,
    );

    this.cache.delete(cacheKey);
    this.logger.log(`Saved to GitHub and removed cache: ${cacheKey}`);

    return url;
  }

  async regenerate(
    text: string,
  ): Promise<{ cacheKey: string; result: SummaryResult; githubUrl: string }> {
    this.logger.log('Regenerating summary (ignoring cache)');
    return this.processMessage(text);
  }

  discard(cacheKey: string): void {
    this.cache.delete(cacheKey);
    this.logger.log(`Discarded cache entry: ${cacheKey}`);
  }

  private getFromCache(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }
}
