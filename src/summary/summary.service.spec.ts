jest.mock('@extractus/article-extractor', () => ({ extract: jest.fn() }));
jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));
jest.mock('@anthropic-ai/sdk', () => jest.fn());
jest.mock('@google/generative-ai', () => ({ GoogleGenerativeAI: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { SummaryService } from './summary.service';
import { LlmService } from '../llm/llm.service';
import { ExtractorService } from '../extractor/extractor.service';
import { GithubService } from '../github/github.service';
import { SummaryResult } from '../llm/llm.interface';

const mockSummaryResult: SummaryResult = {
  title: '테스트 요약 제목',
  description: 'test-summary-title',
  category: 'Tech',
  tags: ['testing', 'nestjs', 'typescript'],
  keywords: ['테스트', 'NestJS', '타입스크립트'],
  concepts: {
    upper: ['백엔드 개발'],
    lower: ['단위 테스트', '의존성 주입'],
    related: ['Jest', 'Express'],
  },
  insights: ['NestJS의 모듈 시스템은 테스트 격리를 용이하게 한다.'],
  summary: '# 요약\n\n이것은 테스트 요약입니다.',
};

describe('SummaryService', () => {
  let service: SummaryService;
  let llmService: jest.Mocked<LlmService>;
  let extractorService: jest.Mocked<ExtractorService>;
  let githubService: jest.Mocked<GithubService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummaryService,
        {
          provide: LlmService,
          useValue: { summarize: jest.fn() },
        },
        {
          provide: ExtractorService,
          useValue: { extract: jest.fn() },
        },
        {
          provide: GithubService,
          useValue: { saveMarkdown: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SummaryService>(SummaryService);
    llmService = module.get(LlmService);
    extractorService = module.get(ExtractorService);
    githubService = module.get(GithubService);
  });

  describe('processMessage', () => {
    it('should extract, summarize, and auto-save URL input', async () => {
      extractorService.extract.mockResolvedValue({
        title: 'Article Title',
        content: '<p>Article body</p>',
        url: 'https://example.com/article',
      });
      llmService.summarize.mockResolvedValue(mockSummaryResult);
      githubService.saveMarkdown.mockResolvedValue(
        'https://github.com/user/repo/blob/main/file.md',
      );

      const { cacheKey, result, githubUrl } = await service.processMessage(
        'https://example.com/article',
      );

      expect(extractorService.extract).toHaveBeenCalledWith(
        'https://example.com/article',
      );
      expect(llmService.summarize).toHaveBeenCalledWith(
        '<p>Article body</p>',
      );
      expect(githubService.saveMarkdown).toHaveBeenCalledWith(
        mockSummaryResult,
        'https://example.com/article',
      );
      expect(result).toEqual(mockSummaryResult);
      expect(githubUrl).toBe('https://github.com/user/repo/blob/main/file.md');
      expect(cacheKey).toBeDefined();
    });

    it('should summarize and auto-save plain text input', async () => {
      extractorService.extract.mockResolvedValue({
        title: '',
        content: 'Some plain text to summarize',
        url: '',
      });
      llmService.summarize.mockResolvedValue(mockSummaryResult);
      githubService.saveMarkdown.mockResolvedValue(
        'https://github.com/user/repo/blob/main/file.md',
      );

      const { cacheKey, result, githubUrl } = await service.processMessage(
        'Some plain text to summarize',
      );

      expect(extractorService.extract).toHaveBeenCalledWith(
        'Some plain text to summarize',
      );
      expect(llmService.summarize).toHaveBeenCalledWith(
        'Some plain text to summarize',
      );
      expect(result).toEqual(mockSummaryResult);
      expect(githubUrl).toBeDefined();
      expect(cacheKey).toBeDefined();
    });
  });

  describe('saveToGithub', () => {
    it('should save cached result to GitHub and clear cache', async () => {
      extractorService.extract.mockResolvedValue({
        title: '',
        content: 'text',
        url: 'https://example.com',
      });
      llmService.summarize.mockResolvedValue(mockSummaryResult);
      githubService.saveMarkdown.mockResolvedValue(
        'https://github.com/user/repo/blob/main/file.md',
      );

      const { cacheKey } = await service.processMessage(
        'https://example.com',
      );
      const url = await service.saveToGithub(cacheKey, 'https://example.com');

      expect(githubService.saveMarkdown).toHaveBeenCalledWith(
        mockSummaryResult,
        'https://example.com',
      );
      expect(url).toBe('https://github.com/user/repo/blob/main/file.md');

      // Cache should be cleared after save
      await expect(
        service.saveToGithub(cacheKey, 'https://example.com'),
      ).rejects.toThrow('Cache entry not found or expired');
    });

    it('should throw error for non-existent cache key', async () => {
      await expect(
        service.saveToGithub('non-existent-key', 'https://example.com'),
      ).rejects.toThrow('Cache entry not found or expired');
    });

    it('should use entry sourceUrl when sourceUrl param is empty', async () => {
      extractorService.extract.mockResolvedValue({
        title: '',
        content: 'text',
        url: 'https://original.com',
      });
      llmService.summarize.mockResolvedValue(mockSummaryResult);
      githubService.saveMarkdown.mockResolvedValue('https://github.com/...');

      const { cacheKey } = await service.processMessage(
        'https://original.com',
      );
      await service.saveToGithub(cacheKey, '');

      expect(githubService.saveMarkdown).toHaveBeenCalledWith(
        mockSummaryResult,
        'https://original.com',
      );
    });
  });

  describe('regenerate', () => {
    it('should create a new summary regardless of cache', async () => {
      extractorService.extract.mockResolvedValue({
        title: '',
        content: 'text',
        url: '',
      });
      llmService.summarize.mockResolvedValue(mockSummaryResult);
      githubService.saveMarkdown.mockResolvedValue('https://github.com/...');

      const first = await service.processMessage('text');
      const second = await service.regenerate('text');

      expect(llmService.summarize).toHaveBeenCalledTimes(2);
      expect(first.cacheKey).not.toBe(second.cacheKey);
    });
  });

  describe('discard', () => {
    it('should remove entry from cache', async () => {
      extractorService.extract.mockResolvedValue({
        title: '',
        content: 'text',
        url: '',
      });
      llmService.summarize.mockResolvedValue(mockSummaryResult);
      githubService.saveMarkdown.mockResolvedValue('https://github.com/...');

      const { cacheKey } = await service.processMessage('text');
      service.discard(cacheKey);

      await expect(
        service.saveToGithub(cacheKey, ''),
      ).rejects.toThrow('Cache entry not found or expired');
    });
  });

  describe('cache expiry', () => {
    it('should return null for expired cache entries', async () => {
      extractorService.extract.mockResolvedValue({
        title: '',
        content: 'text',
        url: '',
      });
      llmService.summarize.mockResolvedValue(mockSummaryResult);
      githubService.saveMarkdown.mockResolvedValue('https://github.com/...');

      const { cacheKey } = await service.processMessage('text');

      // Fast-forward time past TTL
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 600_001);

      await expect(
        service.saveToGithub(cacheKey, ''),
      ).rejects.toThrow('Cache entry not found or expired');

      jest.restoreAllMocks();
    });
  });
});
