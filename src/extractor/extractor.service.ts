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

    // 0. Social media link → extract inner URL first
    const innerResult = await this.tryResolveInnerUrl(input);
    if (innerResult) return innerResult;

    // 1. article-extractor (fetch + smart parsing)
    const articleResult = await this.tryArticleExtractor(input);
    if (articleResult) return articleResult;

    // 2. Raw fetch + HTML tag stripping
    const fetchResult = await this.tryRawFetch(input);
    if (fetchResult) return fetchResult;

    // 3. oembed API (X/Twitter, etc.)
    const oembedResult = await this.tryOembed(input);
    if (oembedResult) return oembedResult;

    // 4. All failed
    throw new Error(
      `모든 추출 방법이 실패했습니다: ${input}`,
    );
  }

  private async tryArticleExtractor(
    url: string,
  ): Promise<ExtractResult | null> {
    try {
      const article = await extract(url);
      if (article?.content) {
        const text = this.stripHtml(article.content);
        if (text.length < 50) {
          this.logger.warn(
            `article-extractor returned too little text for ${url}`,
          );
          return null;
        }
        this.logger.debug(
          `article-extractor succeeded: "${article.title}"`,
        );
        return {
          title: article.title || '',
          content: text,
          url,
        };
      }
    } catch (error) {
      this.logger.warn(
        `article-extractor failed for ${url}: ${error.message}`,
      );
    }
    return null;
  }

  private async tryRawFetch(url: string): Promise<ExtractResult | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; SummaryBot/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this.logger.warn(`Raw fetch failed for ${url}: HTTP ${response.status}`);
        return null;
      }

      const html = await response.text();
      const text = this.extractMainContent(html);

      if (text.length < 50) {
        this.logger.warn(`Raw fetch returned too little content for ${url}`);
        return null;
      }

      // Truncate to avoid sending huge content to LLM
      const truncated =
        text.length > 15_000 ? text.slice(0, 15_000) + '\n\n[...truncated]' : text;

      this.logger.debug(
        `Raw fetch succeeded for ${url} (${truncated.length} chars)`,
      );
      return { title: '', content: truncated, url };
    } catch (error) {
      this.logger.warn(`Raw fetch failed for ${url}: ${error.message}`);
    }
    return null;
  }

  private async tryOembed(url: string): Promise<ExtractResult | null> {
    const oembedUrl = this.getOembedUrl(url);
    if (!oembedUrl) return null;

    try {
      const response = await fetch(oembedUrl, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this.logger.warn(`oembed failed for ${url}: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();
      const content = data.html || data.title || '';
      const text = this.stripHtml(content);

      if (!text) {
        this.logger.warn(`oembed returned empty content for ${url}`);
        return null;
      }

      this.logger.debug(`oembed succeeded for ${url}`);
      return {
        title: data.author_name ? `${data.author_name}의 게시물` : '',
        content: text,
        url,
      };
    } catch (error) {
      this.logger.warn(`oembed failed for ${url}: ${error.message}`);
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
      const tweetText: string = data.tweet?.text || '';

      if (!tweetText) {
        this.logger.warn('fxtwitter returned empty tweet text');
        return null;
      }

      // Extract URLs from tweet text
      const urls = this.extractUrls(tweetText);
      this.logger.debug(
        `Found ${urls.length} URL(s) in tweet: ${urls.join(', ')}`,
      );

      // Try to extract article from each inner URL
      for (const innerUrl of urls) {
        const articleResult = await this.tryArticleExtractor(innerUrl);
        if (articleResult) {
          this.logger.log(
            `Extracted article from inner URL: ${innerUrl}`,
          );
          return articleResult;
        }

        const fetchResult = await this.tryRawFetch(innerUrl);
        if (fetchResult) {
          this.logger.log(
            `Extracted content from inner URL via raw fetch: ${innerUrl}`,
          );
          return fetchResult;
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
    return text.match(urlRegex) || [];
  }

  private getOembedUrl(url: string): string | null {
    const hostname = new URL(url).hostname;

    // X / Twitter
    if (hostname === 'x.com' || hostname === 'twitter.com') {
      return `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`;
    }

    return null;
  }

  private extractMainContent(html: string): string {
    // Prefer semantic HTML elements: <main>, <article>
    for (const tag of ['main', 'article']) {
      const match = html.match(
        new RegExp(`<${tag}[\\s>][\\s\\S]*<\\/${tag}>`, 'i'),
      );
      if (match) {
        const text = this.stripHtml(match[0]);
        if (text.length >= 50) {
          this.logger.debug(`Extracted content from <${tag}> element`);
          return text;
        }
      }
    }

    // Fallback: remove noise elements, then strip
    return this.stripHtml(this.removeNoiseElements(html));
  }

  private removeNoiseElements(html: string): string {
    let cleaned = html;
    for (const tag of ['nav', 'header', 'footer', 'aside', 'noscript']) {
      cleaned = cleaned.replace(
        new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, 'gi'),
        '',
      );
    }
    return cleaned;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
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
