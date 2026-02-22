import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { SummaryResult } from './llm.interface';

describe('LlmService', () => {
  let service: LlmService;
  let claudeProvider: { summarize: jest.Mock };
  let geminiProvider: { summarize: jest.Mock };
  let configService: { get: jest.Mock };

  const mockResult: SummaryResult = {
    title: '테스트 제목',
    oneline: '테스트는 소프트웨어 품질을 보증하는 핵심 활동이다.',
    description: 'test-title',
    category: 'Tech',
    tags: ['test'],
    keywords: ['테스트', '기술'],
    concepts: {
      upper: ['소프트웨어 개발'],
      lower: ['단위 테스트', '통합 테스트'],
      related: ['TDD', 'CI/CD'],
      prerequisite: ['프로그래밍 기초'],
      followup: ['테스트 자동화'],
    },
    quotes: [
      { text: 'Testing is the backbone of quality assurance.', context: '테스트의 근본적 역할을 강조하는 문장이다.' },
    ],
    insights: ['**품질 보증의 핵심**: 테스트는 소프트웨어 품질 보증의 핵심이다.'],
    decoded: '소프트웨어 테스트란 프로그램이 제대로 동작하는지 미리 확인하는 작업이다. 마치 자동차 출고 전 검수처럼, 문제를 사전에 발견해 품질을 보장한다.',
    summary: '## 요약\n\n소프트웨어 테스트는 품질을 보증하는 핵심 활동이다. 단위 테스트와 통합 테스트를 체계적으로 구성하면 버그를 사전에 차단할 수 있다.',
  };

  beforeEach(async () => {
    claudeProvider = { summarize: jest.fn() };
    geminiProvider = { summarize: jest.fn() };
    configService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        { provide: ClaudeProvider, useValue: claudeProvider },
        { provide: GeminiProvider, useValue: geminiProvider },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('when primary is Claude (default)', () => {
    beforeEach(() => {
      configService.get.mockReturnValue('claude');
    });

    it('should return result from Claude on success', async () => {
      claudeProvider.summarize.mockResolvedValue(mockResult);

      const result = await service.summarize('content');

      expect(result).toEqual(mockResult);
      expect(claudeProvider.summarize).toHaveBeenCalledWith('content');
      expect(geminiProvider.summarize).not.toHaveBeenCalled();
    });

    it('should fallback to Gemini when Claude fails', async () => {
      claudeProvider.summarize.mockRejectedValue(new Error('Claude error'));
      geminiProvider.summarize.mockResolvedValue(mockResult);

      const result = await service.summarize('content');

      expect(result).toEqual(mockResult);
      expect(claudeProvider.summarize).toHaveBeenCalled();
      expect(geminiProvider.summarize).toHaveBeenCalledWith('content');
    });

    it('should throw when both providers fail', async () => {
      claudeProvider.summarize.mockRejectedValue(new Error('Claude error'));
      geminiProvider.summarize.mockRejectedValue(new Error('Gemini error'));

      await expect(service.summarize('content')).rejects.toThrow(
        'All LLM providers failed',
      );
    });
  });

  describe('when primary is Gemini', () => {
    beforeEach(() => {
      configService.get.mockReturnValue('gemini');
    });

    it('should return result from Gemini on success', async () => {
      geminiProvider.summarize.mockResolvedValue(mockResult);

      const result = await service.summarize('content');

      expect(result).toEqual(mockResult);
      expect(geminiProvider.summarize).toHaveBeenCalledWith('content');
      expect(claudeProvider.summarize).not.toHaveBeenCalled();
    });

    it('should fallback to Claude when Gemini fails', async () => {
      geminiProvider.summarize.mockRejectedValue(new Error('Gemini error'));
      claudeProvider.summarize.mockResolvedValue(mockResult);

      const result = await service.summarize('content');

      expect(result).toEqual(mockResult);
      expect(geminiProvider.summarize).toHaveBeenCalled();
      expect(claudeProvider.summarize).toHaveBeenCalledWith('content');
    });
  });
});
