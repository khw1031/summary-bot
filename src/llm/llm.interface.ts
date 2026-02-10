export interface SummaryResult {
  title: string;           // 한글 제목
  description: string;     // 영문 kebab-case slug
  category: string;        // Tech | AI | Business | Design | Productivity | Life
  tags: string[];          // 3-5개
  summary: string;         // 마크다운 요약 본문
}

export interface LlmProvider {
  summarize(content: string): Promise<SummaryResult>;
}
