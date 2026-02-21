import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExtractorService } from './extractor.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ExtractorService', () => {
  let service: ExtractorService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExtractorService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'extractor.jinaReaderApiKey') return '';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ExtractorService>(ExtractorService);
    configService = module.get<ConfigService>(ConfigService);
    jest.clearAllMocks();
  });

  /** Helper: create a successful Jina Reader API response */
  function jinaResponse(title: string, content: string) {
    return {
      ok: true,
      json: () => Promise.resolve({ data: { title, content } }),
    };
  }

  /** Helper: create a failed HTTP response */
  function failedResponse(status = 500) {
    return { ok: false, status };
  }

  describe('extract', () => {
    it('should return plain text as-is when input is not a URL', async () => {
      const text = 'This is just some plain text content.';
      const result = await service.extract(text);

      expect(result).toEqual({
        title: '',
        content: text,
        url: '',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should extract content from a valid URL via Jina Reader', async () => {
      mockFetch.mockResolvedValueOnce(
        jinaResponse(
          'Test Article',
          'Article body content that is long enough to pass the minimum length validation check for extraction.',
        ),
      );

      const result = await service.extract('https://example.com/article');

      expect(result.title).toBe('Test Article');
      expect(result.url).toBe('https://example.com/article');
      expect(result.content).toContain('Article body content');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://r.jina.ai/https://example.com/article',
        expect.objectContaining({
          headers: expect.objectContaining({ Accept: 'application/json' }),
        }),
      );
    });

    it('should send Authorization header when API key is configured', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'extractor.jinaReaderApiKey') return 'test-api-key';
        return undefined;
      });

      mockFetch.mockResolvedValueOnce(
        jinaResponse(
          'Test',
          'Content that is long enough to pass the minimum length validation check for extraction purposes.',
        ),
      );

      await service.extract('https://example.com/article');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });

    it('should return null from Jina when content is too short', async () => {
      mockFetch.mockResolvedValueOnce(
        jinaResponse('Short', 'Too short'),
      );

      await expect(
        service.extract('https://example.com/short'),
      ).rejects.toThrow('콘텐츠 추출에 실패했습니다');
    });

    it('should truncate content exceeding 15000 characters', async () => {
      const longContent = 'a'.repeat(20_000);
      mockFetch.mockResolvedValueOnce(
        jinaResponse('Long Article', longContent),
      );

      const result = await service.extract('https://example.com/long');

      expect(result.content.length).toBeLessThan(20_000);
      expect(result.content).toContain('[...truncated]');
    });

    it('should extract inner URL from X/Twitter tweet via fxtwitter + Jina', async () => {
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

      // Jina Reader succeeds for the inner URL
      mockFetch.mockResolvedValueOnce(
        jinaResponse(
          'Inner Article',
          'Article content from inner URL that is long enough to pass the minimum length validation check.',
        ),
      );

      const result = await service.extract(
        'https://x.com/user/status/123456',
      );

      expect(result.url).toBe('https://example.com/article');
      expect(result.content).toContain('Article content from inner URL');
      // Second fetch should be Jina call for the inner URL
      expect(mockFetch).toHaveBeenCalledWith(
        'https://r.jina.ai/https://example.com/article',
        expect.any(Object),
      );
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
      // fxtwitter returns empty text but raw_text has content
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

      // Jina Reader succeeds for the inner URL
      mockFetch.mockResolvedValueOnce(
        jinaResponse(
          'Inner Article',
          'Article content from inner URL that is long enough to pass the minimum length validation check.',
        ),
      );

      const result = await service.extract(
        'https://x.com/user/status/123456',
      );

      expect(result.url).toBe('https://example.com/article');
      expect(result.content).toContain('Article content from inner URL');
    });

    it('should fall back to Jina when fxtwitter fails for X/Twitter URL', async () => {
      // fxtwitter API fails
      mockFetch.mockResolvedValueOnce(failedResponse(500));

      // Jina Reader succeeds for the Twitter URL directly
      mockFetch.mockResolvedValueOnce(
        jinaResponse(
          'Tweet Content',
          'Tweet content fetched via Jina Reader that is long enough to pass the minimum length validation.',
        ),
      );

      const result = await service.extract(
        'https://x.com/user/status/999999',
      );

      expect(result.content).toContain('Tweet content fetched via Jina');
      // 2 fetch calls: fxtwitter (failed) + Jina
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw when all extraction methods fail', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        service.extract('https://example.com/impossible'),
      ).rejects.toThrow('콘텐츠 추출에 실패했습니다');
    });

    it('should not treat non-http protocols as URLs', async () => {
      const input = 'ftp://example.com/file';
      const result = await service.extract(input);

      expect(result).toEqual({
        title: '',
        content: input,
        url: '',
      });
      expect(mockFetch).not.toHaveBeenCalled();
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

      // Jina Reader succeeds for the external media URL
      mockFetch.mockResolvedValueOnce(
        jinaResponse(
          'Deep Article',
          'Deep article content from the link card that is long enough to pass the minimum length validation.',
        ),
      );

      const result = await service.extract(
        'https://x.com/user/status/111111',
      );

      expect(result.url).toBe('https://blog.example.com/deep-article');
      expect(result.content).toContain('Deep article content');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://r.jina.ai/https://blog.example.com/deep-article',
        expect.any(Object),
      );
    });

    it('should filter out Twitter-internal URLs from tweet text', async () => {
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
      // Only 1 fetch call: fxtwitter (no Jina calls for internal URLs)
      expect(mockFetch).toHaveBeenCalledTimes(1);
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

      // Jina Reader succeeds for the quoted tweet's external URL
      mockFetch.mockResolvedValueOnce(
        jinaResponse(
          'New Blog Post',
          'Blog post content from quoted tweet that is long enough to pass the minimum length validation check.',
        ),
      );

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

      // Jina Reader succeeds for the cleaned URL
      mockFetch.mockResolvedValueOnce(
        jinaResponse(
          'Article',
          'Article content that is long enough to pass the minimum length validation check for extraction.',
        ),
      );

      const result = await service.extract(
        'https://x.com/user/status/444444',
      );

      expect(result.url).toBe('https://example.com/article');
      // Jina should be called with the clean URL (no trailing period)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://r.jina.ai/https://example.com/article',
        expect.any(Object),
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

      mockFetch.mockResolvedValueOnce(
        jinaResponse(
          'Shared Article',
          'Shared article content from quoted tweet text URL that is long enough to pass validation.',
        ),
      );

      const result = await service.extract(
        'https://x.com/user/status/555555',
      );

      expect(result.url).toBe('https://example.com/shared-article');
      expect(result.content).toContain('Shared article content');
    });

    it('should use empty title when Jina returns no title', async () => {
      mockFetch.mockResolvedValueOnce(
        jinaResponse(
          '',
          'Content without title that is long enough to pass the minimum length validation check for extraction.',
        ),
      );

      const result = await service.extract('https://example.com/no-title');

      expect(result.title).toBe('');
      expect(result.content).toContain('Content without title');
    });
  });
});
