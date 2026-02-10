import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LlmProvider, SummaryResult } from '../llm.interface';
import { SUMMARY_SYSTEM_PROMPT, SUMMARY_USER_PROMPT } from '../prompts';

@Injectable()
export class GeminiProvider implements LlmProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly model;

  constructor(private readonly configService: ConfigService) {
    const genAI = new GoogleGenerativeAI(
      this.configService.get<string>('llm.geminiApiKey'),
    );
    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SUMMARY_SYSTEM_PROMPT,
    });
  }

  async summarize(content: string): Promise<SummaryResult> {
    this.logger.log('Requesting summary from Gemini');

    const response = await this.model.generateContent(
      SUMMARY_USER_PROMPT(content),
    );

    let text = response.response.text();
    if (!text) {
      throw new Error('No text response from Gemini');
    }

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    const result: SummaryResult = JSON.parse(text);
    this.logger.log(`Summary generated: ${result.title}`);
    return result;
  }
}
