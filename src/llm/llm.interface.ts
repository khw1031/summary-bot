export interface SummaryResult {
  title: string;           // 한글 제목 (15자 이내)
  oneline: string;         // 한줄 요약 (완전한 문장)
  description: string;     // 영문 kebab-case slug (파일명용)
  category: string;        // Tech | Business | Finance | Design | Life | Society
  tags: string[];          // 영문 태그 3-5개
  keywords: string[];      // 한글 핵심 키워드 3-7개
  concepts: {
    upper: string[];       // 상위 개념 1-3개
    lower: string[];       // 하위 개념 2-5개
    related: string[];     // 연관 개념 2-5개
    prerequisite: string[]; // 선행 개념 1-3개
    followup: string[];    // 후속 개념 1-3개
  };
  quotes: { text: string; context: string }[]; // 주요 원문 인용 3-5개
  insights: string[];      // 핵심 인사이트 3-5개 ("**제목**: 설명" 형식)
  decoded: string;         // 쉬운 해석 (마크다운, decode 해석 모드 적용)
  summary: string;         // 서술형 마크다운 본문
}

export interface LlmProvider {
  summarize(content: string): Promise<SummaryResult>;
}

export function normalizeInsights(insights: unknown[]): string[] {
  return insights.map((item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object' && 'title' in item && 'description' in item) {
      const { title, description } = item as { title: string; description: string };
      return `**${title}**: ${description}`;
    }
    return JSON.stringify(item);
  });
}
