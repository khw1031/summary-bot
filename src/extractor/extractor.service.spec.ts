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
        text: () => Promise.resolve(html),
      });

      const result = await service.extract('https://example.com/no-semantic');

      expect(result.content).toContain('Main body content');
      expect(result.content).not.toContain('Navigation Menu');
      expect(result.content).not.toContain('Copyright Footer');
    });

    it('should throw when all extraction methods fail', async () => {
      mockedExtract.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        service.extract('https://example.com/impossible'),
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
  });
});
