jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));
jest.mock('@anthropic-ai/sdk', () => jest.fn());
jest.mock('@google/generative-ai', () => ({ GoogleGenerativeAI: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TelegramUpdate } from './telegram.update';
import { SummaryService } from '../summary/summary.service';
import { SummaryResult } from '../llm/llm.interface';

const mockSummaryResult: SummaryResult = {
  title: '테스트 제목',
  oneline: '테스트는 소프트웨어 품질을 보증하는 가장 효과적인 방법이다.',
  description: 'test-title',
  category: 'Tech',
  tags: ['tag1', 'tag2', 'tag3'],
  keywords: ['테스트', '기술', '개발'],
  concepts: {
    upper: ['소프트웨어 개발'],
    lower: ['단위 테스트', '통합 테스트'],
    related: ['TDD', 'CI/CD'],
    prerequisite: ['프로그래밍 기초'],
    followup: ['테스트 자동화'],
  },
  quotes: [
    { text: 'Tests are the cornerstone of software quality.', context: '테스트의 근본적 역할을 강조하는 문장이다.' },
  ],
  insights: ['**품질의 핵심**: 테스트는 소프트웨어 품질의 핵심이다.'],
  decoded: '소프트웨어 테스트란 프로그램이 제대로 동작하는지 미리 확인하는 작업이다. 문제를 사전에 발견해 품질을 보장한다.',
  summary: '# Summary\n\n소프트웨어 테스트는 품질을 보증하는 핵심 활동이다. 단위 테스트와 통합 테스트를 체계적으로 구성하면 버그를 사전에 차단할 수 있다.',
};

describe('TelegramUpdate', () => {
  let update: TelegramUpdate;
  let summaryService: jest.Mocked<SummaryService>;

  const ALLOWED_CHAT_ID = 123456789;

  const createMockCtx = (overrides: any = {}) => ({
    message: { text: 'https://example.com/article' },
    chat: { id: ALLOWED_CHAT_ID },
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
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue([String(ALLOWED_CHAT_ID)]),
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
        githubUrl: 'https://github.com/user/repo/file.md',
      });

      const ctx = createMockCtx();
      await update.onText(ctx as any);

      expect(ctx.sendChatAction).toHaveBeenCalledWith('typing');
      expect(summaryService.processMessage).toHaveBeenCalledWith(
        'https://example.com/article',
      );
      expect(ctx.reply).toHaveBeenCalledTimes(1);

      const replyCall = ctx.reply.mock.calls[0];
      expect(replyCall[0]).toContain('✅ 테스트 제목');
      expect(replyCall[0]).toContain(mockSummaryResult.oneline);
      expect(replyCall[0]).toContain('GitHub에서 보기');
      expect(replyCall[0]).not.toContain('Tech');
      expect(replyCall[0]).not.toContain('#tag1');
      expect(replyCall[1]).toHaveProperty('parse_mode', 'HTML');
      expect(replyCall[1]).toHaveProperty('reply_markup');
    });

    it('should reply with error and retry button on failure', async () => {
      summaryService.processMessage.mockRejectedValue(
        new Error('LLM failed'),
      );

      const ctx = createMockCtx();
      await update.onText(ctx as any);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyCall = ctx.reply.mock.calls[0];
      expect(replyCall[0]).toBe('요약 처리 중 오류가 발생했습니다.');
      expect(replyCall[1]).toHaveProperty('reply_markup');
    });

    it('should return early if no text in message', async () => {
      const ctx = createMockCtx({ message: {} });
      await update.onText(ctx as any);

      expect(summaryService.processMessage).not.toHaveBeenCalled();
    });

    it('should ignore messages from unauthorized chat IDs', async () => {
      const ctx = createMockCtx({ chat: { id: 999999999 } });
      await update.onText(ctx as any);

      expect(summaryService.processMessage).not.toHaveBeenCalled();
      expect(ctx.sendChatAction).not.toHaveBeenCalled();
    });
  });

  describe('onRetry', () => {
    it('should retry and update message on success', async () => {
      // Simulate a failed first attempt that stores retry key
      summaryService.processMessage.mockRejectedValueOnce(
        new Error('LLM failed'),
      );

      const textCtx = createMockCtx();
      await update.onText(textCtx as any);

      // Extract retry key from the reply
      const replyCall = textCtx.reply.mock.calls[0];
      const retryButton = replyCall[1].reply_markup.inline_keyboard[0][0];
      const retryKey = retryButton.callback_data.replace('retry:', '');

      // Now mock a successful processMessage for the retry
      summaryService.processMessage.mockResolvedValue({
        cacheKey: 'new-key',
        result: mockSummaryResult,
        githubUrl: 'https://github.com/user/repo/file.md',
      });

      const ctx = createMockCtx({
        callbackQuery: { data: `retry:${retryKey}` },
      });
      await update.onRetry(ctx as any);

      expect(ctx.answerCbQuery).toHaveBeenCalledWith('재시도 중...');
      expect(summaryService.processMessage).toHaveBeenCalledWith(
        'https://example.com/article',
      );
      expect(ctx.editMessageText).toHaveBeenCalledTimes(1);

      const editCall = ctx.editMessageText.mock.calls[0];
      expect(editCall[0]).toContain('테스트 제목');
    });

    it('should answer callback with expired message for unknown retry key', async () => {
      const ctx = createMockCtx({
        callbackQuery: { data: 'retry:unknown-key' },
      });
      await update.onRetry(ctx as any);

      expect(ctx.answerCbQuery).toHaveBeenCalledWith(
        '재시도 정보가 만료되었습니다.',
      );
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
