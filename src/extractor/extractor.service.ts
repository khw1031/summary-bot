import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ExtractResult {
  title: string;
  content: string;
  url: string;
}

@Injectable()
export class ExtractorService {
  private readonly logger = new Logger(ExtractorService.name);

  constructor(
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async extract(input: string): Promise<ExtractResult> {
    if (!this.isUrl(input)) {
      this.logger.debug('Input is plain text, returning as-is');
      return { title: '', content: input, url: '' };
    }

    this.logger.debug(`Extracting content from URL: ${input}`);

    const jinaResult = await this.tryJinaReader(input);
    if (jinaResult) return jinaResult;

    throw new Error(`콘텐츠 추출에 실패했습니다: ${input}`);
  }

  private async tryJinaReader(url: string): Promise<ExtractResult | null> {
    try {
      const jinaUrl = `https://r.jina.ai/${url}`;
      const headers: Record<string, string> = { Accept: 'application/json' };
      const apiKey = this.configService?.get<string>(
        'extractor.jinaReaderApiKey',
      );
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      this.logger.debug(`Fetching via Jina Reader: ${jinaUrl}`);

      const response = await fetch(jinaUrl, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        this.logger.warn(`Jina Reader failed for ${url}: HTTP ${response.status}`);
        return null;
      }

      const json = await response.json();
      const content: string = json.data?.content || '';
      const title: string = json.data?.title || '';

      if (content.length < 50) {
        this.logger.warn(
          `Jina Reader returned too little content for ${url} (${content.length} chars)`,
        );
        return null;
      }

      const truncated =
        content.length > 15_000
          ? content.slice(0, 15_000) + '\n\n[...truncated]'
          : content;

      this.logger.debug(
        `Jina Reader succeeded for ${url}: "${title}" (${truncated.length} chars)`,
      );
      return { title, content: truncated, url };
    } catch (error) {
      this.logger.warn(`Jina Reader failed for ${url}: ${error.message}`);
    }
    return null;
  }

  private isUrl(input: string): boolean {
    try {
      const url = new URL(input);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
