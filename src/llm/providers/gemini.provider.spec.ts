import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider';
import { SummaryResult } from '../llm.interface';

const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

describe('GeminiProvider', () => {
  let provider: GeminiProvider;

  const mockSummaryResult: SummaryResult = {
    title: '리액트 서버 컴포넌트 이해하기',
    description: 'understanding-react-server-components',
    category: 'Tech',
    tags: ['react', 'server-components', 'web'],
    keywords: ['서버 컴포넌트', '클라이언트 컴포넌트', '번들 사이즈'],
    concepts: {
      upper: ['React 아키텍처'],
      lower: ['use client 지시어', '스트리밍 SSR'],
      related: ['하이드레이션', 'Astro'],
    },
    insights: ['서버 컴포넌트는 번들에 포함되지 않아 JS 크기를 줄일 수 있다.'],
    summary: '## 핵심 내용\n\n- 서버 컴포넌트는 서버에서 렌더링됩니다.',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-api-key'),
          },
        },
      ],
    }).compile();

    provider = module.get<GeminiProvider>(GeminiProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should return a SummaryResult on successful summarization', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(mockSummaryResult),
      },
    });

    const result = await provider.summarize('Some article content');

    expect(result).toEqual(mockSummaryResult);
    expect(mockGenerateContent).toHaveBeenCalled();
  });

  it('should throw when Gemini returns empty text', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => '',
      },
    });

    await expect(provider.summarize('Some content')).rejects.toThrow(
      'No text response from Gemini',
    );
  });

  it('should throw when Gemini returns invalid JSON', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'not valid json',
      },
    });

    await expect(provider.summarize('Some content')).rejects.toThrow();
  });
});
