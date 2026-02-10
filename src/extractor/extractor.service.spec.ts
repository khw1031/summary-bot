import { Test, TestingModule } from '@nestjs/testing';
import { ExtractorService } from './extractor.service';

jest.mock('@extractus/article-extractor', () => ({
  extract: jest.fn(),
}));

import { extract } from '@extractus/article-extractor';
const mockedExtract = extract as jest.MockedFunction<typeof extract>;

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

    it('should extract article from a valid URL', async () => {
      mockedExtract.mockResolvedValue({
        title: 'Test Article',
        content: '<p>Article body content</p>',
        url: 'https://example.com/article',
      });

      const result = await service.extract('https://example.com/article');

      expect(result).toEqual({
        title: 'Test Article',
        content: '<p>Article body content</p>',
        url: 'https://example.com/article',
      });
      expect(mockedExtract).toHaveBeenCalledWith(
        'https://example.com/article',
      );
    });

    it('should throw error when extraction returns no content', async () => {
      mockedExtract.mockResolvedValue({
        url: 'https://example.com/empty',
        title: '',
        content: '',
      });

      await expect(
        service.extract('https://example.com/empty'),
      ).rejects.toThrow('Failed to extract content from URL');
    });

    it('should throw error when extraction returns null', async () => {
      mockedExtract.mockResolvedValue(null);

      await expect(
        service.extract('https://example.com/null'),
      ).rejects.toThrow('Failed to extract content from URL');
    });

    it('should use empty string for title when article has no title', async () => {
      mockedExtract.mockResolvedValue({
        content: '<p>Content without title</p>',
        url: 'https://example.com/no-title',
      });

      const result = await service.extract('https://example.com/no-title');

      expect(result.title).toBe('');
      expect(result.content).toBe('<p>Content without title</p>');
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
