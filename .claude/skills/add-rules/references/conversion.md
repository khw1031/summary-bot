# 기존 규칙 → Skill 변환 가이드

기존 규칙 파일(.mdc, .cursorrules, rules/*.md 등)을 Skill 체계로 변환하는 가이드입니다.

## 지원 소스 형식

| 소스 | 위치 | 특징 |
|------|------|------|
| Claude rules | `.claude/rules/*.md` | frontmatter + body, 파일 패턴 매칭 |
| Cursor rules | `.cursorrules` | 프로젝트 루트 단일 파일 |
| Cursor MDC | `*.mdc`, `.cursor/rules/*.mdc` | frontmatter + body, 파일 패턴 |
| 프로젝트 rules | `rules/*.md` | 프로젝트 내부 규칙 문서 |
| AGENTS.md | `AGENTS.md`, `**/AGENTS.md` | 디렉토리별 에이전트 지침 |

## 변환 워크플로우

### 1. 소스 규칙 읽기 및 분석

```bash
# 변환 대상 파일 읽기
cat {source_path}

# 규칙 내용 파악
# - 목적: 무엇을 규정하는가?
# - 범위: 어디에 적용되는가?
# - 트리거: 언제 활성화되는가?
# - 분량: 몇 줄인가?
```

### 2. 목적/범위/트리거 추출

소스 규칙에서 다음을 추출합니다:

| 추출 항목 | Claude rules | Cursor rules | MDC | 프로젝트 rules |
|----------|-------------|-------------|-----|---------------|
| 목적 | body 첫 문단 | 주요 섹션 | body 첫 문단 | 제목/서론 |
| 범위 | `paths` 필드 | 전체 적용 | `globs` 필드 | 문서 내 언급 |
| 트리거 | `auto-apply` 필드 | 항상 적용 | `auto-apply` 필드 | 문맥 기반 |

### 3. 적합한 통합 패턴 결정

```
추출된 정보 분석
      │
      ├─ 독립 도메인 규칙? → 패턴 A (독립 Rule-Skill)
      ├─ 워크플로우에 포함 필요? → 패턴 B (임베디드)
      └─ 기존 skill에 통합 가능? → 패턴 C (기존 확장)
```

### 4. Frontmatter 생성

소스 규칙의 속성을 Skill frontmatter로 매핑합니다:

```yaml
---
name: {extracted_name}         # 소스에서 추출 또는 새로 명명
description: >
  {extracted_purpose}          # 목적 1-2문장
  {trigger_keywords}           # 범위에서 추출한 트리거 키워드
user-invocable: {true/false}   # auto-apply 여부에 따라
---
```

### 5. 본문 변환

**Progressive Disclosure 적용:**

- 핵심 규칙 (매번 필요) → SKILL.md 본문 (Stage 2)
- 상세 예제, 엣지 케이스 → references/ (Stage 3)
- 500줄 기준으로 분리 판단

### 6. 사용자 확인

변환 전후 비교를 보여주고 승인을 받습니다.

### 7. 변환 실행

승인 후 해당 패턴의 실행 절차를 따릅니다.

## 변환 매핑 상세

### Claude Rules → Skill

```yaml
# 변환 전 (.claude/rules/typescript.md)
---
paths:
  - "**/*.ts"
  - "**/*.tsx"
auto-apply: true
---
TypeScript 작성 시 다음 규칙을 따르세요...

# 변환 후 (skills/typescript-convention/SKILL.md)
---
name: typescript-convention
description: >
  TypeScript 코딩 컨벤션. *.ts, *.tsx 파일 작성 시 자동 적용.
  TypeScript, 타입스크립트 코드 작성, 리뷰, 리팩토링 시 활성화.
user-invocable: false
---
TypeScript 작성 시 다음 규칙을 따르세요...
```

**매핑 규칙:**
| Claude Rule 속성 | Skill 속성 |
|-----------------|-----------|
| `paths: ["**/*.ts"]` | description에 "TypeScript", "*.ts" 트리거 |
| `auto-apply: true` | `user-invocable: false` |
| `auto-apply: false` | `user-invocable: true` (기본값) |
| body | SKILL.md 본문 (500줄 이하) 또는 references/ 분리 |

### Cursor Rules → Skill

```
# 변환 전 (.cursorrules)
You are an expert in TypeScript...
- Always use strict mode
- Prefer interfaces over type aliases
...

# 변환 후 (skills/cursor-conventions/SKILL.md)
---
name: cursor-conventions
description: >
  프로젝트 코딩 컨벤션 (Cursor rules 변환).
  코드 작성, TypeScript, strict mode 관련 작업 시 자동 적용.
user-invocable: false
---

# Project Conventions

(변환된 규칙 내용)
```

**매핑 규칙:**
| Cursor Rule 특성 | Skill 속성 |
|-----------------|-----------|
| 전체 적용 | `user-invocable: false` (보통 자동 적용) |
| 자유 형식 텍스트 | 구조화된 SKILL.md 본문으로 재구성 |
| 단일 파일 | 필요시 여러 skill로 분리 |

### MDC Rules → Skill

```yaml
# 변환 전 (.cursor/rules/react.mdc)
---
description: React component rules
globs: ["src/components/**/*.tsx"]
alwaysApply: false
---
React 컴포넌트 작성 규칙...

# 변환 후 (skills/react-convention/SKILL.md)
---
name: react-convention
description: >
  React 컴포넌트 작성 규칙. src/components/ 내 TSX 파일 대상.
  React, 컴포넌트 생성, 컴포넌트 수정 시 자동 적용.
user-invocable: false
---

React 컴포넌트 작성 규칙...
```

**매핑 규칙:**
| MDC 속성 | Skill 속성 |
|---------|-----------|
| `description` | description 첫 문장 참고 |
| `globs` | description에 파일 패턴 트리거 포함 |
| `alwaysApply: true` | `user-invocable: false` |
| `alwaysApply: false` | description 키워드 기반 활성화 |

### 프로젝트 Rules → Skill

프로젝트 내부 규칙 문서(rules/*.md)는 구조가 다양하므로:

1. 문서의 제목과 서론에서 목적 추출
2. 내용 분석하여 도메인/범위 판단
3. 적합한 패턴(A/B/C) 결정
4. SKILL.md 형식으로 재구조화

## 변환 전후 예시

### 예시 1: Claude Rule → 독립 Rule-Skill (패턴 A)

**변환 전** (`.claude/rules/error-handling.md`):
```yaml
---
paths:
  - "src/**/*.ts"
auto-apply: true
---
# Error Handling Rules

## try-catch 사용 규칙
- 외부 API 호출은 반드시 try-catch로 감싸기
- catch에서 에러 로깅 필수
- 사용자에게 보여줄 에러 메시지와 내부 로그 메시지 분리

## Error 타입
- 커스텀 에러 클래스 사용 (`AppError`, `ValidationError`)
- Error 상속 시 name 프로퍼티 설정
```

**변환 후** (`skills/error-handling/SKILL.md`):
```yaml
---
name: error-handling
description: >
  TypeScript 에러 핸들링 규칙. try-catch, 커스텀 Error 타입 작성 시 자동 적용.
  에러 처리, error handling, 예외 처리 관련 작업 시 활성화.
user-invocable: false
---

# Error Handling

## try-catch 사용 규칙
- 외부 API 호출은 반드시 try-catch로 감싸기
- catch에서 에러 로깅 필수
- 사용자에게 보여줄 에러 메시지와 내부 로그 메시지 분리

## Error 타입
- 커스텀 에러 클래스 사용 (`AppError`, `ValidationError`)
- Error 상속 시 name 프로퍼티 설정
```

### 예시 2: Cursor Rules → 여러 Skill (패턴 A 복수)

**변환 전** (`.cursorrules`):
```
You are an expert in React, TypeScript, and Next.js...

Naming:
- Use camelCase for variables...
- Use PascalCase for components...

API Rules:
- Always use fetch with error handling...
- Rate limiting on all endpoints...

Testing:
- Unit test for all utils...
- Integration test for API routes...
```

**변환 후** (내용이 많으면 도메인별 분리):
```
skills/react-convention/SKILL.md      ← 네이밍 + React 규칙
skills/api-convention/SKILL.md        ← API 규칙
skills/testing-convention/SKILL.md    ← 테스트 규칙
```

### 예시 3: 프로젝트 Rule → 기존 Skill 확장 (패턴 C)

**변환 전** (`rules/git-commit.md`):
```markdown
# Git Commit Convention

- feat: 새 기능
- fix: 버그 수정
- refactor: 리팩토링
...
```

**변환 후** (기존 `skills/commit/SKILL.md`에 통합):
```yaml
# 기존 commit skill의 description에 트리거 추가
description: >
  ... 커밋 컨벤션, git commit convention 규칙 포함.

# 기존 SKILL.md에 섹션 추가 또는 references/ 파일 추가
```

## 변환 시 주의사항

1. **원본 보존**: 변환 후 원본 삭제는 사용자에게 확인
2. **분량 판단**: 원본이 길면 여러 skill로 분리 고려
3. **트리거 추출**: 원본의 파일 패턴/조건을 description 키워드로 반영
4. **Progressive Disclosure**: 핵심만 본문에, 상세는 references/에
5. **기존 skill 확인**: 변환 전 관련 기존 skill이 있는지 반드시 확인
