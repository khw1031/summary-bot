jest.mock('@extractus/article-extractor', () => ({ extract: jest.fn() }));
jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));
jest.mock('@anthropic-ai/sdk', () => jest.fn());
jest.mock('@google/generative-ai', () => ({ GoogleGenerativeAI: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { TelegramUpdate } from './telegram.update';
import { SummaryService } from '../summary/summary.service';
import { SummaryResult } from '../llm/llm.interface';

const mockSummaryResult: SummaryResult = {
  title: '테스트 제목',
  description: 'test-title',
  category: 'Tech',
  tags: ['tag1', 'tag2', 'tag3'],
  summary: '# Summary\n\nThis is a test summary.',
};

describe('TelegramUpdate', () => {
  let update: TelegramUpdate;
  let summaryService: jest.Mocked<SummaryService>;

  const createMockCtx = (overrides: any = {}) => ({
    message: { text: 'https://example.com/article' },
    sendChatAction: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    answerCbQuery: jest.fn().mockResolvedValue(undefined),
    editMessageText: jest.fn().mockResolvedValue(undefined),
    deleteMessage: jest.fn().mockResolvedValue(undefined),
    callbackQuery: { data: '' },
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramUpdate,
        {
          provide: SummaryService,
          useValue: {
            processMessage: jest.fn(),
            saveToGithub: jest.fn(),
            regenerate: jest.fn(),
            discard: jest.fn(),
          },
        },
      ],
    }).compile();

    update = module.get<TelegramUpdate>(TelegramUpdate);
    summaryService = module.get(SummaryService);
  });

  describe('onText', () => {
    it('should process text and reply with preview and buttons', async () => {
      summaryService.processMessage.mockResolvedValue({
        cacheKey: 'test-key',
        result: mockSummaryResult,
      });

      const ctx = createMockCtx();
      await update.onText(ctx as any);

      expect(ctx.sendChatAction).toHaveBeenCalledWith('typing');
      expect(summaryService.processMessage).toHaveBeenCalledWith(
        'https://example.com/article',
      );
      expect(ctx.reply).toHaveBeenCalledTimes(1);

      const replyCall = ctx.reply.mock.calls[0];
      expect(replyCall[0]).toContain('테스트 제목');
      expect(replyCall[0]).toContain('Tech');
      expect(replyCall[1]).toHaveProperty('parse_mode', 'HTML');
      expect(replyCall[1]).toHaveProperty('reply_markup');
    });

    it('should reply with error message on failure', async () => {
      summaryService.processMessage.mockRejectedValue(
        new Error('LLM failed'),
      );

      const ctx = createMockCtx();
      await update.onText(ctx as any);

      expect(ctx.reply).toHaveBeenCalledWith(
        '요약 처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
      );
    });

    it('should return early if no text in message', async () => {
      const ctx = createMockCtx({ message: {} });
      await update.onText(ctx as any);

      expect(summaryService.processMessage).not.toHaveBeenCalled();
    });
  });

  describe('onSave', () => {
    it('should save to GitHub and edit message with URL', async () => {
      summaryService.processMessage.mockResolvedValue({
        cacheKey: 'save-key',
        result: mockSummaryResult,
      });
      summaryService.saveToGithub.mockResolvedValue(
        'https://github.com/user/repo/file.md',
      );

      // First create the entry via onText
      const textCtx = createMockCtx();
      await update.onText(textCtx as any);

      const ctx = createMockCtx({
        callbackQuery: { data: 'save:save-key' },
      });
      await update.onSave(ctx as any);

      expect(ctx.answerCbQuery).toHaveBeenCalledWith('저장 중...');
      expect(summaryService.saveToGithub).toHaveBeenCalled();
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('GitHub에 저장되었습니다'),
      );
    });

    it('should answer callback with error on failure', async () => {
      summaryService.saveToGithub.mockRejectedValue(
        new Error('GitHub error'),
      );

      const ctx = createMockCtx({
        callbackQuery: { data: 'save:bad-key' },
      });
      await update.onSave(ctx as any);

      expect(ctx.answerCbQuery).toHaveBeenCalledWith(
        '저장 중 오류가 발생했습니다.',
      );
    });
  });

  describe('onRegenerate', () => {
    it('should regenerate and update message', async () => {
      summaryService.processMessage.mockResolvedValue({
        cacheKey: 'regen-key',
        result: mockSummaryResult,
      });

      const newResult: SummaryResult = {
        ...mockSummaryResult,
        title: '새 제목',
      };
      summaryService.regenerate.mockResolvedValue({
        cacheKey: 'new-regen-key',
        result: newResult,
      });

      // First create entry
      const textCtx = createMockCtx();
      await update.onText(textCtx as any);

      const ctx = createMockCtx({
        callbackQuery: { data: 'regenerate:regen-key' },
      });
      await update.onRegenerate(ctx as any);

      expect(ctx.answerCbQuery).toHaveBeenCalledWith('재생성 중...');
      expect(summaryService.discard).toHaveBeenCalledWith('regen-key');
      expect(summaryService.regenerate).toHaveBeenCalled();
      expect(ctx.editMessageText).toHaveBeenCalledTimes(1);

      const editCall = ctx.editMessageText.mock.calls[0];
      expect(editCall[0]).toContain('새 제목');
    });
  });

  describe('onDelete', () => {
    it('should discard and delete message', async () => {
      const ctx = createMockCtx({
        callbackQuery: { data: 'delete:del-key' },
      });
      await update.onDelete(ctx as any);

      expect(ctx.answerCbQuery).toHaveBeenCalledWith('삭제됨');
      expect(summaryService.discard).toHaveBeenCalledWith('del-key');
      expect(ctx.deleteMessage).toHaveBeenCalled();
    });
  });
});
