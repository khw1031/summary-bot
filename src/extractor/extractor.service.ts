import { Injectable, Logger } from '@nestjs/common';
import { extract } from '@extractus/article-extractor';

export interface ExtractResult {
  title: string;
  content: string;
  url: string;
}

@Injectable()
export class ExtractorService {
  private readonly logger = new Logger(ExtractorService.name);

  async extract(input: string): Promise<ExtractResult> {
    if (!this.isUrl(input)) {
      this.logger.debug('Input is plain text, returning as-is');
      return { title: '', content: input, url: '' };
    }

    this.logger.debug(`Extracting article from URL: ${input}`);

    const article = await extract(input);

    if (!article || !article.content) {
      throw new Error(`Failed to extract content from URL: ${input}`);
    }

    this.logger.debug(`Extracted article: "${article.title}"`);

    return {
      title: article.title || '',
      content: article.content,
      url: input,
    };
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
