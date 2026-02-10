export interface SummaryResult {
  title: string;           // 한글 제목
  description: string;     // 영문 kebab-case slug
  category: string;        // Tech | AI | Business | Design | Productivity | Life
  tags: string[];          // 영문 태그 3-5개
  keywords: string[];      // 한글 핵심 키워드 3-7개
  concepts: {
    upper: string[];       // 상위 개념 1-3개
    lower: string[];       // 하위 개념 2-5개
    related: string[];     // 연관 개념 2-5개
  };
  insights: string[];      // 핵심 인사이트 3-5개
  summary: string;         // 마크다운 요약 본문
}

export interface LlmProvider {
  summarize(content: string): Promise<SummaryResult>;
}
