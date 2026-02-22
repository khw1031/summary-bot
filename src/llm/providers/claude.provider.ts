import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { LlmProvider, SummaryResult, normalizeInsights } from '../llm.interface';
import { SUMMARY_SYSTEM_PROMPT, SUMMARY_USER_PROMPT } from '../prompts';

@Injectable()
export class ClaudeProvider implements LlmProvider {
  private readonly logger = new Logger(ClaudeProvider.name);
  private readonly client: Anthropic;

  constructor(private readonly configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('llm.anthropicApiKey'),
    });
  }

  async summarize(content: string): Promise<SummaryResult> {
    this.logger.log('Requesting summary from Claude');

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: SUMMARY_USER_PROMPT(content),
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const result: SummaryResult = JSON.parse(textBlock.text);
    result.insights = normalizeInsights(result.insights);
    this.logger.log(`Summary generated: ${result.title}`);
    return result;
  }
}
