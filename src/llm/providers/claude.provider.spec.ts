import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClaudeProvider } from './claude.provider';
import { SummaryResult } from '../llm.interface';

jest.mock('@anthropic-ai/sdk', () => {
  const mockCreate = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
    _mockCreate: mockCreate,
  };
});

const { _mockCreate: mockCreate } =
  jest.requireMock('@anthropic-ai/sdk');

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider;

  const mockSummaryResult: SummaryResult = {
    title: '리액트 서버 컴포넌트 이해하기',
    description: 'understanding-react-server-components',
    category: 'Tech',
    tags: ['react', 'server-components', 'web'],
    summary: '## 핵심 내용\n\n- 서버 컴포넌트는 서버에서 렌더링됩니다.',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaudeProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-api-key'),
          },
        },
      ],
    }).compile();

    provider = module.get<ClaudeProvider>(ClaudeProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should return a SummaryResult on successful summarization', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify(mockSummaryResult),
        },
      ],
    });

    const result = await provider.summarize('Some article content');

    expect(result).toEqual(mockSummaryResult);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
      }),
    );
  });

  it('should throw when Claude returns no text block', async () => {
    mockCreate.mockResolvedValue({
      content: [],
    });

    await expect(provider.summarize('Some content')).rejects.toThrow(
      'No text response from Claude',
    );
  });

  it('should throw when Claude returns invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not valid json' }],
    });

    await expect(provider.summarize('Some content')).rejects.toThrow();
  });
});
