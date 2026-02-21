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

    // Twitter: extract inner URL → fetch via Jina
    const innerResult = await this.tryResolveInnerUrl(input);
    if (innerResult) return innerResult;

    // All URLs → Jina Reader API
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

  private async tryResolveInnerUrl(
    url: string,
  ): Promise<ExtractResult | null> {
    const tweetId = this.extractTweetId(url);
    if (!tweetId) return null;

    try {
      const apiUrl = `https://api.fxtwitter.com/status/${tweetId}`;
      this.logger.debug(`Fetching tweet via fxtwitter: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this.logger.warn(`fxtwitter failed: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();
      const tweetText: string =
        data.tweet?.text || data.tweet?.raw_text || '';

      if (!tweetText) {
        this.logger.warn('fxtwitter returned empty tweet text');
        return null;
      }

      // Collect candidate URLs in priority order
      const candidateUrls: string[] = [];

      // 1. External media URL from link card (highest priority)
      const externalUrl = data.tweet?.media?.external?.url;
      if (externalUrl && !this.isTwitterInternalUrl(externalUrl)) {
        this.logger.debug(`Found external media URL: ${externalUrl}`);
        candidateUrls.push(externalUrl);
      }

      // 2. Quoted tweet's external URL
      const quoteExternalUrl = data.tweet?.quote?.media?.external?.url;
      if (quoteExternalUrl && !this.isTwitterInternalUrl(quoteExternalUrl)) {
        this.logger.debug(
          `Found quoted tweet external URL: ${quoteExternalUrl}`,
        );
        candidateUrls.push(quoteExternalUrl);
      }

      // 3. URLs extracted from tweet text (filtered)
      const textUrls = this.extractUrls(tweetText).filter(
        (u) => !this.isTwitterInternalUrl(u),
      );
      candidateUrls.push(...textUrls);

      // 4. URLs from quoted tweet text
      const quoteText: string = data.tweet?.quote?.text || '';
      if (quoteText) {
        const quoteTextUrls = this.extractUrls(quoteText).filter(
          (u) => !this.isTwitterInternalUrl(u),
        );
        candidateUrls.push(...quoteTextUrls);
      }

      // Deduplicate while preserving order
      const uniqueUrls = [...new Set(candidateUrls)];
      this.logger.debug(
        `Found ${uniqueUrls.length} candidate URL(s): ${uniqueUrls.join(', ')}`,
      );

      // Try to extract content from each candidate URL via Jina
      for (const innerUrl of uniqueUrls) {
        const jinaResult = await this.tryJinaReader(innerUrl);
        if (jinaResult) {
          this.logger.log(
            `Extracted content from inner URL via Jina: ${innerUrl}`,
          );
          return jinaResult;
        }
      }

      // No inner URLs worked; return tweet text itself
      this.logger.debug('No inner URLs resolved; using tweet text');
      return {
        title: data.tweet?.author?.name
          ? `${data.tweet.author.name}의 트윗`
          : '',
        content: tweetText,
        url,
      };
    } catch (error) {
      this.logger.warn(
        `fxtwitter extraction failed for ${url}: ${error.message}`,
      );
    }
    return null;
  }

  private extractTweetId(url: string): string | null {
    try {
      const { hostname, pathname } = new URL(url);
      if (hostname !== 'x.com' && hostname !== 'twitter.com') return null;

      const match = pathname.match(/\/status\/(\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  private extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s)]+/g;
    const raw = text.match(urlRegex) || [];

    return raw
      .map((u) => u.replace(/[.,;:!?'"]+$/, '')) // strip trailing punctuation
      .filter((u, i, arr) => arr.indexOf(u) === i); // deduplicate
  }

  private isTwitterInternalUrl(url: string): boolean {
    try {
      const { hostname } = new URL(url);
      const internalHosts = [
        'x.com',
        'twitter.com',
        'pic.twitter.com',
        'pbs.twimg.com',
        'video.twimg.com',
        'abs.twimg.com',
        't.co',
      ];
      return internalHosts.some(
        (h) => hostname === h || hostname.endsWith(`.${h}`),
      );
    } catch {
      return false;
    }
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
