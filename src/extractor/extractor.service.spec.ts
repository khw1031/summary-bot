import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExtractorService } from './extractor.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const LONG_CONTENT =
  'This is a sufficiently long article body content that exceeds the minimum length threshold of 200 characters. It contains enough text to pass the validation check in the extractor service, simulating a real article extraction result from Jina Reader API.';

const SHORT_CONTENT = 'Post\n----\nConversation\n----';

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
    mockFetch.mockReset();
    jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);
  });

  /** Helper: create a successful Jina Reader API response */
  function jinaResponse(
    title: string,
    content: string,
    description = '',
  ) {
    return {
      ok: true,
      json: () =>
        Promise.resolve({ data: { title, content, description } }),
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
        jinaResponse('Test Article', LONG_CONTENT),
      );

      const result = await service.extract('https://example.com/article');

      expect(result.title).toBe('Test Article');
      expect(result.url).toBe('https://example.com/article');
      expect(result.content).toContain('sufficiently long article');
      expect(mockFetch).toHaveBeenCalledTimes(1);
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
        jinaResponse('Test', LONG_CONTENT),
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

    it('should retry and succeed on second attempt', async () => {
      mockFetch
        .mockResolvedValueOnce(jinaResponse('X', SHORT_CONTENT))
        .mockResolvedValueOnce(
          jinaResponse('Full Article', LONG_CONTENT),
        );

      const result = await service.extract('https://x.com/user/status/123');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.title).toBe('Full Article');
      expect(result.content).toContain('sufficiently long article');
    });

    it('should supplement content with title/description when content is short', async () => {
      const longTitle =
        'User on X: "This is a very long tweet about building AI applications with modern frameworks and best practices for prompt engineering and model fine-tuning that exceeds the minimum content length threshold"';
      mockFetch.mockResolvedValueOnce(
        jinaResponse(longTitle, SHORT_CONTENT, 'A tweet about AI'),
      );

      const result = await service.extract('https://x.com/user/status/456');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.content).toContain('building AI applications');
      expect(result.content).toContain('A tweet about AI');
    });

    it('should throw when both attempts return too little content', async () => {
      mockFetch
        .mockResolvedValueOnce(jinaResponse('X', SHORT_CONTENT))
        .mockResolvedValueOnce(jinaResponse('X', SHORT_CONTENT));

      await expect(
        service.extract('https://example.com/short'),
      ).rejects.toThrow('콘텐츠 추출에 실패했습니다');

      expect(mockFetch).toHaveBeenCalledTimes(2);
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
          LONG_CONTENT,
        ),
      );

      const result = await service.extract(
        'https://x.com/user/status/123456',
      );

      expect(result.content).toContain('sufficiently long article');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://r.jina.ai/https://x.com/user/status/123456',
        expect.any(Object),
      );
    });

    it('should throw when Jina Reader fails on both attempts', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        service.extract('https://example.com/impossible'),
      ).rejects.toThrow('콘텐츠 추출에 실패했습니다');
    });

    it('should throw when Jina Reader returns non-ok response on both attempts', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(
        service.extract('https://example.com/error'),
      ).rejects.toThrow('콘텐츠 추출에 실패했습니다');
    });

    it('should convert GitHub blob URL to raw URL before fetching', async () => {
      mockFetch.mockResolvedValueOnce(
        jinaResponse('Agent Plugins', LONG_CONTENT),
      );

      const result = await service.extract(
        'https://github.com/kyopark2014/agent-plugins/blob/main/README.md',
      );

      expect(result.title).toBe('Agent Plugins');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://r.jina.ai/https://raw.githubusercontent.com/kyopark2014/agent-plugins/main/README.md',
        expect.any(Object),
      );
    });

    it('should not convert non-blob GitHub URLs', async () => {
      mockFetch.mockResolvedValueOnce(
        jinaResponse('Repo Home', LONG_CONTENT),
      );

      await service.extract('https://github.com/kyopark2014/agent-plugins');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://r.jina.ai/https://github.com/kyopark2014/agent-plugins',
        expect.any(Object),
      );
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
        jinaResponse('', LONG_CONTENT),
      );

      const result = await service.extract('https://example.com/no-title');

      expect(result.title).toBe('');
      expect(result.content).toContain('sufficiently long article');
    });
  });
});
