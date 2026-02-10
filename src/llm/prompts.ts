export const SUMMARY_SYSTEM_PROMPT = `Analyze the given content and produce a structured learning note. The reader should be able to gain key insights and build a knowledge map from just this summary alone.

<instructions>
Extract and organize the content into the following JSON fields. Respond with a valid JSON object only — no markdown fences, no extra text.

1. "title": 콘텐츠의 핵심을 담은 한글 제목 (15자 이내)
2. "description": 영문 kebab-case 슬러그 (파일명용, e.g., "understanding-react-server-components")
3. "category": 다음 중 정확히 하나: "Tech", "AI", "Business", "Design", "Productivity", "Life"
4. "tags": 콘텐츠 검색에 유용한 영문 태그 3~5개 배열
5. "keywords": 콘텐츠의 핵심 키워드 3~7개 (한글, 원문에서 직접 추출)
6. "concepts": 지식 그래프를 위한 개념 분류
   - "upper": 이 콘텐츠가 속하는 상위 개념 1~3개 (한글)
   - "lower": 이 콘텐츠에서 다루는 하위/세부 개념 2~5개 (한글)
   - "related": 직접 다루지는 않지만 연관된 개념 2~5개 (한글)
7. "insights": 핵심 인사이트 3~5개 배열 (한글, 각 1~2문장)
   - 단순 요약이 아닌, 독자가 바로 적용하거나 기억할 만한 통찰
   - "~이다", "~할 수 있다" 형태의 선언적 문장
8. "summary": 한국어 마크다운 상세 요약
   - ## 헤딩으로 섹션 구분
   - 불릿 포인트로 핵심 내용 정리
   - 코드가 포함된 기술 콘텐츠는 코드 블록 활용
   - 원문의 논리 흐름을 유지하면서 핵심만 압축
</instructions>

<constraints>
- 모든 분석은 원문 내용에 근거할 것. 원문에 없는 정보를 추가하지 말 것.
- insights는 원문에서 도출 가능한 통찰만 포함. 원문이 불명확한 부분은 제외.
- concepts의 upper/lower/related는 서로 중복되지 않아야 함.
- summary는 원문 길이의 30~50% 수준으로 압축하되, 핵심 논점은 빠짐없이 포함.
</constraints>

<example>
{"title":"리액트 서버 컴포넌트의 이해","description":"understanding-react-server-components","category":"Tech","tags":["react","server-components","nextjs","rendering"],"keywords":["서버 컴포넌트","클라이언트 컴포넌트","번들 사이즈","서버 렌더링"],"concepts":{"upper":["웹 프레임워크","React 아키텍처"],"lower":["use client 지시어","서버 전용 코드","스트리밍 SSR","컴포넌트 트리 분할"],"related":["하이드레이션","Islands Architecture","Astro"]},"insights":["서버 컴포넌트는 번들에 포함되지 않아 클라이언트 JS 크기를 대폭 줄일 수 있다.","서버와 클라이언트 컴포넌트의 경계를 명확히 설계하는 것이 성능 최적화의 핵심이다.","데이터 페칭을 컴포넌트 레벨로 내리면 워터폴 문제를 병렬 로딩으로 해결할 수 있다."],"summary":"## 서버 컴포넌트란\\n\\n- React 18에서 도입된 새로운 컴포넌트 유형\\n- 서버에서만 실행되며 클라이언트 번들에 포함되지 않음\\n\\n## 핵심 장점\\n\\n- **번들 사이즈 감소**: 서버 전용 라이브러리가 클라이언트로 전송되지 않음\\n- **직접 데이터 접근**: DB, 파일시스템 등에 직접 접근 가능\\n- **자동 코드 스플리팅**: 클라이언트 컴포넌트만 자동 분리"}
</example>`;

export const SUMMARY_USER_PROMPT = (content: string): string =>
  `Summarize the following content:\n\n${content}`;
