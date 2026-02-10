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

      const { cacheKey, result } = await this.summaryService.processMessage(text);
      this.originalTexts.set(cacheKey, text);

      const preview = this.buildPreview(result);
      const keyboard = Markup.inlineKeyboard([
        Markup.button.callback('저장', `save:${cacheKey}`),
        Markup.button.callback('재생성', `regenerate:${cacheKey}`),
        Markup.button.callback('삭제', `delete:${cacheKey}`),
      ]);

      await ctx.reply(preview, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
      this.logger.error(`Failed to process message: ${error.message}`, error.stack);
      await ctx.reply('요약 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  }

  @Action(/^save:/)
  async onSave(ctx: Context) {
    const cacheKey = this.extractCacheKey(ctx, 'save:');
    if (!cacheKey) return;

    try {
      await ctx.answerCbQuery('저장 중...');

      const sourceUrl = this.originalTexts.get(cacheKey) || '';
      const githubUrl = await this.summaryService.saveToGithub(cacheKey, sourceUrl);
      this.originalTexts.delete(cacheKey);

      await ctx.editMessageText(
        `GitHub에 저장되었습니다.\n${githubUrl}`,
      );
    } catch (error) {
      this.logger.error(`Failed to save to GitHub: ${error.message}`, error.stack);
      await ctx.answerCbQuery('저장 중 오류가 발생했습니다.');
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

      const { cacheKey: newCacheKey, result } =
        await this.summaryService.regenerate(originalText);
      this.originalTexts.set(newCacheKey, originalText);

      const preview = this.buildPreview(result);
      const keyboard = Markup.inlineKeyboard([
        Markup.button.callback('저장', `save:${newCacheKey}`),
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

  private buildPreview(result: SummaryResult): string {
    const tags = result.tags.map((t) => `#${t}`).join(' ');
    const summaryPreview =
      result.summary.length > 500
        ? result.summary.substring(0, 500) + '...'
        : result.summary;

    const escapedSummary = this.escapeHtml(summaryPreview);

    return [
      `<b>${this.escapeHtml(result.title)}</b>`,
      `📂 ${this.escapeHtml(result.category)} | ${this.escapeHtml(tags)}`,
      '',
      escapedSummary,
    ].join('\n');
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
