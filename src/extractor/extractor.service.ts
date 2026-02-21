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

    // 0.1. Social media URL (e.g. x.com) → skip article/raw fetch, go straight to oembed
    if (this.isSocialMediaUrl(input)) {
      this.logger.debug(
        `Social media URL detected, skipping article/raw fetch: ${input}`,
      );
      const oembedResult = await this.tryOembed(input);
      if (oembedResult) return oembedResult;

      throw new Error(
        `모든 추출 방법이 실패했습니다: ${input}`,
      );
    }

    // 0.5. Content-Type pre-check (reject non-web content like PDF, images)
    await this.validateContentType(input);

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

      const contentType = response.headers.get('content-type') || '';
      if (contentType && !this.isExtractableContentType(contentType)) {
        this.logger.warn(
          `Unsupported content type for ${url}: ${contentType}`,
        );
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
        this.logger.debug(`Found quoted tweet external URL: ${quoteExternalUrl}`);
        candidateUrls.push(quoteExternalUrl);
      }

      // 3. URLs extracted from tweet text (filtered)
      const textUrls = this.extractUrls(tweetText)
        .filter((u) => !this.isTwitterInternalUrl(u));
      candidateUrls.push(...textUrls);

      // 4. URLs from quoted tweet text
      const quoteText: string = data.tweet?.quote?.text || '';
      if (quoteText) {
        const quoteTextUrls = this.extractUrls(quoteText)
          .filter((u) => !this.isTwitterInternalUrl(u));
        candidateUrls.push(...quoteTextUrls);
      }

      // Deduplicate while preserving order
      const uniqueUrls = [...new Set(candidateUrls)];
      this.logger.debug(
        `Found ${uniqueUrls.length} candidate URL(s): ${uniqueUrls.join(', ')}`,
      );

      // Try to extract article from each candidate URL
      for (const innerUrl of uniqueUrls) {
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
      // Preserve <a> tag URLs: convert to "text (url)" format
      .replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_, href, text) => {
          const cleanText = text.replace(/<[^>]+>/g, '').trim();
          if (!cleanText || cleanText === href) return ` ${href} `;
          return ` ${cleanText} (${href}) `;
        },
      )
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

  private isSocialMediaUrl(url: string): boolean {
    try {
      const { hostname } = new URL(url);
      return hostname === 'x.com' || hostname === 'twitter.com';
    } catch {
      return false;
    }
  }

  private async validateContentType(url: string): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SummaryBot/1.0)',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(5_000),
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType && !this.isExtractableContentType(contentType)) {
        throw new Error(
          `지원하지 않는 콘텐츠 유형입니다 (${contentType.split(';')[0].trim()}): ${url}`,
        );
      }
    } catch (error) {
      if (error.message.startsWith('지원하지 않는')) throw error;
      this.logger.debug(
        `Content-Type pre-check failed for ${url}, proceeding with extraction`,
      );
    }
  }

  private isExtractableContentType(contentType: string): boolean {
    const type = contentType.toLowerCase().split(';')[0].trim();
    return type.startsWith('text/') || type === 'application/xhtml+xml';
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
