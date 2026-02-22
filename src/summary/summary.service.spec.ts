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
  oneline: 'NestJS의 모듈 시스템은 의존성 주입을 통해 테스트 격리를 용이하게 만든다.',
  description: 'test-summary-title',
  category: 'Tech',
  tags: ['testing', 'nestjs', 'typescript'],
  keywords: ['테스트', 'NestJS', '타입스크립트'],
  concepts: {
    upper: ['백엔드 개발'],
    lower: ['단위 테스트', '의존성 주입'],
    related: ['Jest', 'Express'],
    prerequisite: ['Node.js 기초'],
    followup: ['E2E 테스트'],
  },
  quotes: [
    { text: 'NestJS modules provide natural test boundaries.', context: 'NestJS 모듈 시스템이 테스트에 유리한 이유를 설명한다.' },
  ],
  insights: ['**테스트 격리의 용이성**: NestJS의 모듈 시스템은 테스트 격리를 용이하게 한다.'],
  decoded: 'NestJS는 기능별로 코드를 나눠 관리하는 구조를 갖고 있다. 덕분에 각 기능을 따로 떼어 테스트하기 쉽고, 테스트용 가짜 부품으로 교체하는 것도 간단하다.',
  summary: '# 요약\n\nNestJS는 모듈 기반 아키텍처를 채택하여 각 기능을 독립적으로 테스트할 수 있게 설계되었다. 의존성 주입 덕분에 테스트 더블을 손쉽게 교체할 수 있어 단위 테스트 작성이 편리하다.',
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
          useValue: { saveMarkdown: jest.fn(), deleteMarkdown: jest.fn() },
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
      githubService.saveMarkdown.mockResolvedValue({
        htmlUrl: 'https://github.com/user/repo/blob/main/file.md',
        filePath: '98-summaries/2026-02-10-test-slug.md',
      });

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
      githubService.saveMarkdown.mockResolvedValue({
        htmlUrl: 'https://github.com/user/repo/blob/main/file.md',
        filePath: '98-summaries/2026-02-10-test-slug.md',
      });

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
      githubService.saveMarkdown.mockResolvedValue({
        htmlUrl: 'https://github.com/user/repo/blob/main/file.md',
        filePath: '98-summaries/2026-02-10-test-slug.md',
      });

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
      githubService.saveMarkdown.mockResolvedValue({
        htmlUrl: 'https://github.com/...',
        filePath: '98-summaries/2026-02-10-test-slug.md',
      });

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
      githubService.saveMarkdown.mockResolvedValue({
        htmlUrl: 'https://github.com/...',
        filePath: '98-summaries/2026-02-10-test-slug.md',
      });

      const first = await service.processMessage('text');
      const second = await service.regenerate('text');

      expect(llmService.summarize).toHaveBeenCalledTimes(2);
      expect(first.cacheKey).not.toBe(second.cacheKey);
    });
  });

  describe('discard', () => {
    it('should delete GitHub file and remove entry from cache', async () => {
      extractorService.extract.mockResolvedValue({
        title: '',
        content: 'text',
        url: '',
      });
      llmService.summarize.mockResolvedValue(mockSummaryResult);
      githubService.saveMarkdown.mockResolvedValue({
        htmlUrl: 'https://github.com/...',
        filePath: '98-summaries/2026-02-10-test-slug.md',
      });
      githubService.deleteMarkdown.mockResolvedValue(undefined);

      const { cacheKey } = await service.processMessage('text');
      await service.discard(cacheKey);

      expect(githubService.deleteMarkdown).toHaveBeenCalledWith(
        '98-summaries/2026-02-10-test-slug.md',
      );

      await expect(
        service.saveToGithub(cacheKey, ''),
      ).rejects.toThrow('Cache entry not found or expired');
    });

    it('should still remove cache entry when GitHub delete fails', async () => {
      extractorService.extract.mockResolvedValue({
        title: '',
        content: 'text',
        url: '',
      });
      llmService.summarize.mockResolvedValue(mockSummaryResult);
      githubService.saveMarkdown.mockResolvedValue({
        htmlUrl: 'https://github.com/...',
        filePath: '98-summaries/2026-02-10-test-slug.md',
      });
      githubService.deleteMarkdown.mockRejectedValue(new Error('Not Found'));

      const { cacheKey } = await service.processMessage('text');
      await service.discard(cacheKey);

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
      githubService.saveMarkdown.mockResolvedValue({
        htmlUrl: 'https://github.com/...',
        filePath: '98-summaries/2026-02-10-test-slug.md',
      });

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
