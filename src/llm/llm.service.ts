import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SummaryResult } from './llm.interface';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly claudeProvider: ClaudeProvider,
    private readonly geminiProvider: GeminiProvider,
  ) {}

  async summarize(content: string): Promise<SummaryResult> {
    const providerName = this.configService.get<string>('llm.provider') || 'claude';
    const [primary, fallback] =
      providerName === 'gemini'
        ? [this.geminiProvider, this.claudeProvider]
        : [this.claudeProvider, this.geminiProvider];

    const primaryName = providerName === 'gemini' ? 'Gemini' : 'Claude';
    const fallbackName = providerName === 'gemini' ? 'Claude' : 'Gemini';

    try {
      this.logger.log(`Using primary provider: ${primaryName}`);
      return await primary.summarize(content);
    } catch (primaryError) {
      this.logger.warn(
        `Primary provider (${primaryName}) failed: ${primaryError.message}. Falling back to ${fallbackName}`,
      );

      try {
        return await fallback.summarize(content);
      } catch (fallbackError) {
        this.logger.error(
          `Fallback provider (${fallbackName}) also failed: ${fallbackError.message}`,
        );
        throw new Error(
          `All LLM providers failed. Primary (${primaryName}): ${primaryError.message}, Fallback (${fallbackName}): ${fallbackError.message}`,
        );
      }
    }
  }
}
