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
    description: 'test-title',
    category: 'Tech',
    tags: ['test'],
    summary: '## 요약',
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
