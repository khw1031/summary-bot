import { Test, TestingModule } from '@nestjs/testing';
import { ExtractorService } from './extractor.service';

jest.mock('@extractus/article-extractor', () => ({
  extract: jest.fn(),
}));

import { extract } from '@extractus/article-extractor';
const mockedExtract = extract as jest.MockedFunction<typeof extract>;

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ExtractorService', () => {
  let service: ExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExtractorService],
    }).compile();

    service = module.get<ExtractorService>(ExtractorService);
    jest.clearAllMocks();
  });

  describe('extract', () => {
    it('should return plain text as-is when input is not a URL', async () => {
      const text = 'This is just some plain text content.';
      const result = await service.extract(text);

      expect(result).toEqual({
        title: '',
        content: text,
        url: '',
      });
      expect(mockedExtract).not.toHaveBeenCalled();
    });

    it('should extract article from a valid URL via article-extractor and strip HTML', async () => {
      mockedExtract.mockResolvedValue({
        title: 'Test Article',
        content:
          '<p>Article body content that is long enough to pass the minimum length validation check for extraction.</p>',
        url: 'https://example.com/article',
      });

      const result = await service.extract('https://example.com/article');

      expect(result.title).toBe('Test Article');
      expect(result.url).toBe('https://example.com/article');
      expect(result.content).not.toContain('<p>');
      expect(result.content).toContain('Article body content');
      expect(mockedExtract).toHaveBeenCalledWith(
        'https://example.com/article',
      );
    });

    it('should fall back to raw fetch when article-extractor returns no content', async () => {
      mockedExtract.mockResolvedValue({
        url: 'https://example.com/empty',
        title: '',
        content: '',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: () =>
          Promise.resolve(
            '<html><body><p>Fallback content from raw fetch that is long enough to pass the minimum length check.</p></body></html>',
          ),
      });

      const result = await service.extract('https://example.com/empty');

      expect(result.url).toBe('https://example.com/empty');
      expect(result.content).toContain('Fallback content from raw fetch');
    });

    it('should fall back to raw fetch when article-extractor throws', async () => {
      mockedExtract.mockRejectedValue(new Error('Network error'));

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: () =>
          Promise.resolve(
            '<html><body><p>Content retrieved via raw fetch after extractor failure with enough text.</p></body></html>',
          ),
      });

      const result = await service.extract('https://example.com/error');

      expect(result.url).toBe('https://example.com/error');
      expect(result.content).toContain('Content retrieved via raw fetch');
    });

    it('should extract inner URL from X/Twitter tweet via fxtwitter', async () => {
      // fxtwitter API returns tweet with an inner URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tweet: {
              text: '흥미로운 글 https://example.com/article',
              author: { name: 'TestUser' },
            },
          }),
      });

      // article-extractor succeeds for the inner URL
      mockedExtract.mockResolvedValue({
        title: 'Inner Article',
        content:
          '<p>Article content from inner URL that is long enough to pass the minimum length validation check.</p>',
        url: 'https://example.com/article',
      });

      const result = await service.extract(
        'https://x.com/user/status/123456',
      );

      expect(result.url).toBe('https://example.com/article');
      expect(result.content).toContain('Article content from inner URL');
    });

    it('should use tweet text when inner URL extraction fails', async () => {
      // fxtwitter returns tweet with no URLs
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tweet: {
              text: 'NestJS에 대한 생각을 공유합니다. 모듈 시스템이 정말 좋다.',
              author: { name: 'TestUser' },
            },
          }),
      });

      const result = await service.extract(
        'https://x.com/user/status/123456',
      );

      expect(result.url).toBe('https://x.com/user/status/123456');
      expect(result.content).toContain('NestJS에 대한 생각');
      expect(result.title).toContain('TestUser');
    });

    it('should fall back to raw_text when fxtwitter text field is empty', async () => {
      // fxtwitter returns empty text but raw_text has content (e.g. X Articles)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tweet: {
              text: '',
              raw_text: '흥미로운 글 https://example.com/article',
              author: { name: 'TestUser' },
            },
          }),
      });

      // article-extractor succeeds for the inner URL
      mockedExtract.mockResolvedValue({
        title: 'Inner Article',
        content:
          '<p>Article content from inner URL that is long enough to pass the minimum length validation check.</p>',
        url: 'https://example.com/article',
      });

      const result = await service.extract(
        'https://x.com/user/status/123456',
      );

      expect(result.url).toBe('https://example.com/article');
      expect(result.content).toContain('Article content from inner URL');
    });

    it('should extract content from <article> element in raw fetch fallback', async () => {
      mockedExtract.mockResolvedValue(null);

      const html = `
        <html><body>
          <nav>Home About Contact</nav>
          <header>Site Header Navigation Menu</header>
          <article>
            <p>This is the actual article content that should be extracted by the raw fetch fallback.</p>
          </article>
          <footer>Copyright 2025 Footer Links Privacy Policy</footer>
        </body></html>`;

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(html),
      });

      const result = await service.extract('https://example.com/with-article');

      expect(result.content).toContain('actual article content');
      expect(result.content).not.toContain('Home About Contact');
      expect(result.content).not.toContain('Footer Links');
    });

    it('should remove noise elements when no <article> or <main> exists in raw fetch', async () => {
      mockedExtract.mockResolvedValue(null);

      const html = `
        <html><body>
          <nav>Navigation Menu Items</nav>
          <div class="content">
            <p>Main body content of the page that should survive noise removal and be long enough.</p>
          </div>
          <footer>Copyright Footer Stuff</footer>
        </body></html>`;

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(html),
      });

      const result = await service.extract('https://example.com/no-semantic');

      expect(result.content).toContain('Main body content');
      expect(result.content).not.toContain('Navigation Menu');
      expect(result.content).not.toContain('Copyright Footer');
    });

    it('should skip article/raw fetch and use oembed for X/Twitter URL when fxtwitter fails', async () => {
      // fxtwitter API fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // oembed succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            html: '<blockquote>트윗 본문 내용입니다.</blockquote>',
            author_name: 'TestUser',
          }),
      });

      const result = await service.extract(
        'https://x.com/user/status/999999',
      );

      expect(result.title).toContain('TestUser');
      expect(result.content).toContain('트윗 본문 내용입니다');
      // article-extractor should NOT have been called
      expect(mockedExtract).not.toHaveBeenCalled();
      // Only 2 fetch calls: fxtwitter + oembed (no HEAD pre-check, no raw fetch)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should preserve links in article content as text (url) format', async () => {
      mockedExtract.mockResolvedValue({
        title: 'Article With Links',
        content:
          '<p>Check out <a href="https://example.com/ref">this reference</a> and also <a href="https://example.com/docs">https://example.com/docs</a> for more info that passes the length check.</p>',
        url: 'https://example.com/article',
      });

      const result = await service.extract('https://example.com/article');

      // Link with different text: "text (url)" format
      expect(result.content).toContain('this reference (https://example.com/ref)');
      // Link where text === href: just the URL
      expect(result.content).toContain('https://example.com/docs');
      expect(result.content).not.toContain('<a');
    });

    it('should throw when all extraction methods fail', async () => {
      mockedExtract.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        service.extract('https://example.com/impossible'),
      ).rejects.toThrow('모든 추출 방법이 실패했습니다');
    });

    it('should throw for PDF content type via HEAD pre-check', async () => {
      // HEAD request returns application/pdf
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/pdf']]),
      });

      await expect(
        service.extract('https://example.com/document.pdf'),
      ).rejects.toThrow('지원하지 않는 콘텐츠 유형입니다');
    });

    it('should skip raw fetch for non-HTML content types', async () => {
      // HEAD pre-check fails (network error), so extraction proceeds
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      // article-extractor fails
      mockedExtract.mockResolvedValue(null);

      // raw fetch returns image content type
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'image/png']]),
      });

      // oembed also fails (not a tweet URL)
      await expect(
        service.extract('https://example.com/image.png'),
      ).rejects.toThrow('모든 추출 방법이 실패했습니다');
    });

    it('should use empty string for title when article has no title', async () => {
      mockedExtract.mockResolvedValue({
        content:
          '<p>Content without title that is long enough to pass the minimum length validation check for extraction.</p>',
        url: 'https://example.com/no-title',
      });

      const result = await service.extract('https://example.com/no-title');

      expect(result.title).toBe('');
      expect(result.content).not.toContain('<p>');
      expect(result.content).toContain('Content without title');
    });

    it('should not treat non-http protocols as URLs', async () => {
      const input = 'ftp://example.com/file';
      const result = await service.extract(input);

      expect(result).toEqual({
        title: '',
        content: input,
        url: '',
      });
      expect(mockedExtract).not.toHaveBeenCalled();
    });

    it('should prioritize media.external.url from fxtwitter over tweet text URLs', async () => {
      // fxtwitter returns tweet with external media URL (link card)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tweet: {
              text: '이 글 추천 https://t.co/abc123',
              author: { name: 'TestUser' },
              media: {
                external: {
                  url: 'https://blog.example.com/deep-article',
                },
              },
            },
          }),
      });

      // article-extractor succeeds for the external media URL
      mockedExtract.mockResolvedValue({
        title: 'Deep Article',
        content:
          '<p>Deep article content from the link card that is long enough to pass the minimum length validation.</p>',
        url: 'https://blog.example.com/deep-article',
      });

      const result = await service.extract(
        'https://x.com/user/status/111111',
      );

      expect(result.url).toBe('https://blog.example.com/deep-article');
      expect(result.content).toContain('Deep article content');
      // article-extractor should be called with the external URL first
      expect(mockedExtract).toHaveBeenCalledWith(
        'https://blog.example.com/deep-article',
      );
    });

    it('should filter out Twitter-internal URLs (pic.twitter.com, t.co) from tweet text', async () => {
      // fxtwitter returns tweet with only internal URLs
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tweet: {
              text: '사진 공유합니다 https://pic.twitter.com/abc123 https://t.co/xyz789',
              author: { name: 'TestUser' },
            },
          }),
      });

      const result = await service.extract(
        'https://x.com/user/status/222222',
      );

      // Should fall back to tweet text since all URLs are Twitter-internal
      expect(result.url).toBe('https://x.com/user/status/222222');
      expect(result.content).toContain('사진 공유합니다');
      expect(result.title).toContain('TestUser');
      // article-extractor should NOT have been called (no external URLs to try)
      expect(mockedExtract).not.toHaveBeenCalled();
    });

    it('should extract article from quoted tweet external URL', async () => {
      // fxtwitter returns tweet that quotes another tweet with an external link
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tweet: {
              text: '이거 정말 좋은 글이네요',
              author: { name: 'QuoterUser' },
              quote: {
                text: '새 블로그 포스트를 올렸습니다',
                media: {
                  external: {
                    url: 'https://blog.example.com/new-post',
                  },
                },
              },
            },
          }),
      });

      // article-extractor succeeds for the quoted tweet's external URL
      mockedExtract.mockResolvedValue({
        title: 'New Blog Post',
        content:
          '<p>Blog post content from quoted tweet that is long enough to pass the minimum length validation check.</p>',
        url: 'https://blog.example.com/new-post',
      });

      const result = await service.extract(
        'https://x.com/user/status/333333',
      );

      expect(result.url).toBe('https://blog.example.com/new-post');
      expect(result.content).toContain('Blog post content from quoted tweet');
    });

    it('should strip trailing punctuation from URLs extracted from tweet text', async () => {
      // fxtwitter returns tweet text with URL followed by period
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tweet: {
              text: '이 글을 읽어보세요. https://example.com/article.',
              author: { name: 'TestUser' },
            },
          }),
      });

      // article-extractor succeeds for the cleaned URL
      mockedExtract.mockResolvedValue({
        title: 'Article',
        content:
          '<p>Article content that is long enough to pass the minimum length validation check for extraction.</p>',
        url: 'https://example.com/article',
      });

      const result = await service.extract(
        'https://x.com/user/status/444444',
      );

      expect(result.url).toBe('https://example.com/article');
      // article-extractor should be called with the clean URL (no trailing period)
      expect(mockedExtract).toHaveBeenCalledWith(
        'https://example.com/article',
      );
    });

    it('should extract article from quoted tweet text URL when no external media', async () => {
      // fxtwitter returns tweet quoting another tweet that has a URL in its text
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tweet: {
              text: '흥미로운 내용',
              author: { name: 'QuoterUser' },
              quote: {
                text: '새 아티클 공유 https://example.com/shared-article',
              },
            },
          }),
      });

      mockedExtract.mockResolvedValue({
        title: 'Shared Article',
        content:
          '<p>Shared article content from quoted tweet text URL that is long enough to pass validation.</p>',
        url: 'https://example.com/shared-article',
      });

      const result = await service.extract(
        'https://x.com/user/status/555555',
      );

      expect(result.url).toBe('https://example.com/shared-article');
      expect(result.content).toContain('Shared article content');
    });
  });
});
