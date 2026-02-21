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

    it('should throw when Jina returns too little content', async () => {
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

    it('should extract content from Twitter URL via Jina Reader', async () => {
      mockFetch.mockResolvedValueOnce(
        jinaResponse(
          'User on X: "Some tweet content"',
          'Tweet content fetched via Jina Reader that is long enough to pass the minimum length validation.',
        ),
      );

      const result = await service.extract(
        'https://x.com/user/status/123456',
      );

      expect(result.content).toContain('Tweet content fetched via Jina');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://r.jina.ai/https://x.com/user/status/123456',
        expect.any(Object),
      );
    });

    it('should throw when Jina Reader fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        service.extract('https://example.com/impossible'),
      ).rejects.toThrow('콘텐츠 추출에 실패했습니다');
    });

    it('should throw when Jina Reader returns non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(
        service.extract('https://example.com/error'),
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
