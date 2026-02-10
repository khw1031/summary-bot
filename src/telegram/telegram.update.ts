import { Logger } from '@nestjs/common';
import { Update, On, Action } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { SummaryService } from '../summary/summary.service';
import { SummaryResult } from '../llm/llm.interface';

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);
  private readonly originalTexts = new Map<string, string>();

  constructor(private readonly summaryService: SummaryService) {}

  @On('text')
  async onText(ctx: Context) {
    const text = (ctx.message as any)?.text;
    if (!text) return;

    try {
      await ctx.sendChatAction('typing');

      const { cacheKey, result, githubUrl } = await this.summaryService.processMessage(text);
      this.originalTexts.set(cacheKey, text);

      const preview = this.buildPreview(result, githubUrl);
      const keyboard = Markup.inlineKeyboard([
        Markup.button.callback('재생성', `regenerate:${cacheKey}`),
        Markup.button.callback('삭제', `delete:${cacheKey}`),
      ]);

      await ctx.reply(preview, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
      this.logger.error(`Failed to process message: ${error.message}`, error.stack);
      await ctx.reply('요약 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  }

  @Action(/^regenerate:/)
  async onRegenerate(ctx: Context) {
    const cacheKey = this.extractCacheKey(ctx, 'regenerate:');
    if (!cacheKey) return;

    try {
      await ctx.answerCbQuery('재생성 중...');

      const originalText = this.originalTexts.get(cacheKey) || '';
      this.originalTexts.delete(cacheKey);
      this.summaryService.discard(cacheKey);

      const { cacheKey: newCacheKey, result, githubUrl } =
        await this.summaryService.regenerate(originalText);
      this.originalTexts.set(newCacheKey, originalText);

      const preview = this.buildPreview(result, githubUrl);
      const keyboard = Markup.inlineKeyboard([
        Markup.button.callback('재생성', `regenerate:${newCacheKey}`),
        Markup.button.callback('삭제', `delete:${newCacheKey}`),
      ]);

      await ctx.editMessageText(preview, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch (error) {
      this.logger.error(`Failed to regenerate: ${error.message}`, error.stack);
      await ctx.answerCbQuery('재생성 중 오류가 발생했습니다.');
    }
  }

  @Action(/^delete:/)
  async onDelete(ctx: Context) {
    const cacheKey = this.extractCacheKey(ctx, 'delete:');
    if (!cacheKey) return;

    try {
      await ctx.answerCbQuery('삭제됨');
      this.summaryService.discard(cacheKey);
      this.originalTexts.delete(cacheKey);
      await ctx.deleteMessage();
    } catch (error) {
      this.logger.error(`Failed to delete: ${error.message}`, error.stack);
      await ctx.answerCbQuery('삭제 중 오류가 발생했습니다.');
    }
  }

  private buildPreview(result: SummaryResult, githubUrl: string): string {
    const tags = result.tags.map((t) => `#${t}`).join(' ');
    const keywords = result.keywords.map((k) => `#${k}`).join(' ');
    const summaryPreview =
      result.summary.length > 300
        ? result.summary.substring(0, 300) + '...'
        : result.summary;

    const lines = [
      `<b>${this.escapeHtml(result.title)}</b>`,
      `📂 ${this.escapeHtml(result.category)} | ${this.escapeHtml(tags)}`,
      '',
      this.escapeHtml(summaryPreview),
      '',
      '<b>💡 핵심 인사이트</b>',
      ...result.insights.map((i) => `• ${this.escapeHtml(i)}`),
      '',
      `🔑 ${this.escapeHtml(keywords)}`,
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
