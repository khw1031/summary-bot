import { Logger } from '@nestjs/common';
import { Update, On, Action, Command } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { SummaryService } from '../summary/summary.service';
import { SummaryResult } from '../llm/llm.interface';

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);
  private readonly originalTexts = new Map<string, string>();
  private readonly allowedChatIds: string[];

  constructor(
    private readonly summaryService: SummaryService,
    private readonly configService: ConfigService,
  ) {
    this.allowedChatIds = this.configService.get<string[]>(
      'telegram.allowedChatIds',
    );
    if (this.allowedChatIds.length === 0) {
      this.logger.warn(
        'TELEGRAM_ALLOWED_CHAT_IDS is not set. Bot is open to all users.',
      );
    }
  }

  private isAllowed(chatId: number): boolean {
    if (this.allowedChatIds.length === 0) return true;
    return this.allowedChatIds.includes(String(chatId));
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 2,
    delayMs = 1000,
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        this.logger.warn(
          `Telegram API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error('Unreachable');
  }

  @Command('start')
  async onStart(ctx: Context) {
    const chatId = ctx.chat.id;
    await this.withRetry(() =>
      ctx.reply(
        `Your chat ID: <code>${chatId}</code>\n\n` +
          '이 값을 TELEGRAM_ALLOWED_CHAT_IDS 환경변수에 설정하면 본인만 봇을 사용할 수 있습니다.',
        { parse_mode: 'HTML' },
      ),
    );
  }

  @On('text')
  async onText(ctx: Context) {
    const text = (ctx.message as any)?.text;
    if (!text) return;
    if (!this.isAllowed(ctx.chat.id)) return;

    try {
      await this.withRetry(() => ctx.sendChatAction('typing'));

      const { cacheKey, result, githubUrl } = await this.summaryService.processMessage(text);
      this.originalTexts.delete(cacheKey);

      const preview = this.buildPreview(result, githubUrl);
      const keyboard = Markup.inlineKeyboard([
        Markup.button.callback('삭제', `delete:${cacheKey}`),
      ]);

      await this.withRetry(() =>
        ctx.reply(preview, { parse_mode: 'HTML', ...keyboard }),
      );
    } catch (error) {
      this.logger.error(`Failed to process message: ${error.message}`, error.stack);

      const retryKey = `retry-${Date.now()}`;
      this.originalTexts.set(retryKey, text);
      const keyboard = Markup.inlineKeyboard([
        Markup.button.callback('재시도', `retry:${retryKey}`),
      ]);

      try {
        await this.withRetry(() =>
          ctx.reply('요약 처리 중 오류가 발생했습니다.', keyboard),
        );
      } catch (replyError) {
        this.logger.error(`Failed to send error reply: ${replyError.message}`);
      }
    }
  }

  @Action(/^retry:/)
  async onRetry(ctx: Context) {
    if (!this.isAllowed(ctx.chat.id)) return;
    const retryKey = this.extractCacheKey(ctx, 'retry:');
    if (!retryKey) return;

    const originalText = this.originalTexts.get(retryKey);
    if (!originalText) {
      await this.withRetry(() =>
        ctx.answerCbQuery('재시도 정보가 만료되었습니다.'),
      );
      return;
    }

    try {
      await this.withRetry(() => ctx.answerCbQuery('재시도 중...'));
      this.originalTexts.delete(retryKey);

      const { cacheKey, result, githubUrl } =
        await this.summaryService.processMessage(originalText);

      const preview = this.buildPreview(result, githubUrl);
      const keyboard = Markup.inlineKeyboard([
        Markup.button.callback('삭제', `delete:${cacheKey}`),
      ]);

      await this.withRetry(() =>
        ctx.editMessageText(preview, {
          parse_mode: 'HTML',
          ...keyboard,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to retry: ${error.message}`, error.stack);
      try {
        await this.withRetry(() =>
          ctx.answerCbQuery('재시도에 실패했습니다.'),
        );
      } catch (replyError) {
        this.logger.error(`Failed to send retry error reply: ${replyError.message}`);
      }
    }
  }

  @Action(/^delete:/)
  async onDelete(ctx: Context) {
    if (!this.isAllowed(ctx.chat.id)) return;
    const cacheKey = this.extractCacheKey(ctx, 'delete:');
    if (!cacheKey) return;

    try {
      await this.withRetry(() => ctx.answerCbQuery('삭제됨'));
      this.summaryService.discard(cacheKey);
      this.originalTexts.delete(cacheKey);
      await this.withRetry(() => ctx.deleteMessage());
    } catch (error) {
      this.logger.error(`Failed to delete: ${error.message}`, error.stack);
      try {
        await this.withRetry(() =>
          ctx.answerCbQuery('삭제 중 오류가 발생했습니다.'),
        );
      } catch (replyError) {
        this.logger.error(`Failed to send delete error reply: ${replyError.message}`);
      }
    }
  }

  private buildPreview(result: SummaryResult, githubUrl: string): string {
    const lines = [
      `✅ ${this.escapeHtml(result.title)}`,
      this.escapeHtml(result.oneline),
      '',
      `<a href="${githubUrl}">GitHub에서 보기</a>`,
    ];

    return lines.join('\n');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private extractCacheKey(ctx: Context, prefix: string): string | null {
    const data = (ctx.callbackQuery as any)?.data;
    if (!data) return null;
    return data.replace(prefix, '');
  }
}
