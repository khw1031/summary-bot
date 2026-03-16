import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ExtractResult {
  title: string;
  content: string;
  url: string;
}

const MIN_CONTENT_LENGTH = 200;
const MAX_CONTENT_LENGTH = 15_000;
const RETRY_DELAY_MS = 2_000;

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

    const url = this.toRawGitHubUrl(input);
    this.logger.debug(`Extracting content from URL: ${url}`);

    const jinaResult = await this.tryJinaReader(url);
    if (jinaResult) return jinaResult;

    throw new Error(`콘텐츠 추출에 실패했습니다: ${input}`);
  }

  private async tryJinaReader(url: string): Promise<ExtractResult | null> {
    const result = await this.fetchJinaReader(url);
    if (result) return result;

    this.logger.log(
      `Jina Reader returned insufficient content, retrying in ${RETRY_DELAY_MS}ms...`,
    );
    await this.delay(RETRY_DELAY_MS);

    return this.fetchJinaReader(url);
  }

  private async fetchJinaReader(url: string): Promise<ExtractResult | null> {
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
        this.logger.warn(
          `Jina Reader failed for ${url}: HTTP ${response.status}`,
        );
        return null;
      }

      const json = await response.json();
      const rawContent: string = json.data?.content || '';
      const title: string = json.data?.title || '';
      const description: string = json.data?.description || '';

      const content = this.buildContent(rawContent, title, description);

      if (content.length < MIN_CONTENT_LENGTH) {
        this.logger.warn(
          `Jina Reader returned insufficient content for ${url} (${content.length} chars)`,
        );
        return null;
      }

      const truncated =
        content.length > MAX_CONTENT_LENGTH
          ? content.slice(0, MAX_CONTENT_LENGTH) + '\n\n[...truncated]'
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

  private buildContent(
    content: string,
    title: string,
    description: string,
  ): string {
    if (content.length >= MIN_CONTENT_LENGTH) {
      return content;
    }

    this.logger.debug(
      `Content too short (${content.length} chars), supplementing with title/description`,
    );

    const parts = [title, description, content].filter(
      (part) => part.length > 0,
    );
    return parts.join('\n\n');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Convert GitHub blob/tree URLs to raw.githubusercontent.com URLs
   * so Jina Reader can fetch the raw markdown content directly.
   */
  private toRawGitHubUrl(url: string): string {
    const match = url.match(
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/,
    );
    if (match) {
      const [, owner, repo, path] = match;
      return `https://raw.githubusercontent.com/${owner}/${repo}/${path}`;
    }
    return url;
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
