---
name: project-rules
description: >
  Summary Bot 프로젝트의 아키텍처, 기술 스택, 코딩 컨벤션 규칙을 정의합니다.
  코드 작성, 모듈 추가, 구조 변경, 컨벤션 확인 시 자동 참조됩니다.
user-invocable: false
---

# Summary Bot Project Rules

Telegram 봇으로 URL/텍스트를 받아 LLM 요약 후 GitHub에 마크다운으로 저장하는 NestJS 앱.

## 기술 스택

| 레이어 | 선택 |
|--------|------|
| Package Manager | pnpm |
| Runtime | Node.js 20+ |
| Framework | NestJS |
| Telegram | `telegraf` + `nestjs-telegraf` |
| LLM | `@anthropic-ai/sdk` + `@google/generative-ai` (Vercel AI SDK 사용 금지) |
| GitHub | `@octokit/rest` |
| URL 파싱 | `@extractus/article-extractor` |
| 배포 | Railway (Webhook 모드) |

## 프로젝트 구조 규칙

```
src/
├── app.module.ts
├── main.ts
├── telegram/       # Telegraf 봇, webhook, 메시지 핸들러
├── summary/        # 오케스트레이션 (URL파싱 -> LLM -> GitHub)
├── llm/            # LLM 호출 추상화 + providers/
├── github/         # Octokit 파일 push
├── extractor/      # URL -> 본문 추출
└── config/         # 환경변수 관리
```

- 각 도메인은 NestJS 모듈로 분리 (module.ts + service.ts)
- DTO는 해당 모듈의 `dto/` 하위에 배치
- LLM 프로바이더는 `llm/providers/`에 추가

## 핵심 패턴

### LLM Provider

- `LlmProvider` 인터페이스 구현 (`summarize(content): Promise<SummaryResult>`)
- Primary: Claude (`claude-sonnet-4-20250514`), Fallback: Gemini (`gemini-2.0-flash`)
- `LLM_PROVIDER` 환경변수로 기본 프로바이더 선택
- 실패 시 자동으로 다른 프로바이더로 fallback

### SummaryResult 구조

```typescript
interface SummaryResult {
  title: string;           // 한글 제목
  description: string;     // 영문 kebab-case slug
  category: string;        // Tech | AI | Business | Design | Productivity | Life
  tags: string[];          // 3-5개
  summary: string;         // 마크다운 요약 본문
}
```

### GitHub 저장 규칙

- 경로: `90-summaries/YYYY-MM-DD-{slug}.md`
- 커밋 메시지: `docs: add summary - {한글 제목}`
- 마크다운 frontmatter 필수: title, date, category, tags, source

### Telegram 핸들러

- `nestjs-telegraf` 데코레이터 사용 (`@Update`, `@On`, `@Action`)
- 텍스트 수신 -> 요약 미리보기 + 인라인 버튼 (저장/재생성/삭제)
- 요약 결과는 메모리 캐시에 임시 저장 (TTL 10분)

## 환경변수

필수: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_DOMAIN`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GITHUB_TOKEN`, `GITHUB_REPO`

## 상세 참조

- [아키텍처 상세](references/architecture.md)
