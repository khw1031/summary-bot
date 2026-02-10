# 통합 패턴 상세

## 패턴 A: 독립 Rule-Skill

독립적인 도메인의 규칙을 별도 skill로 생성합니다.

### 디렉토리 구조

```
skills/{rule-name}/
├── SKILL.md              # 핵심 규칙 (<500줄)
└── references/           # 상세 규칙, 예제
    ├── detail.md
    └── examples.md
```

### Frontmatter 설정

```yaml
---
name: {rule-name}
description: >
  {무엇을 하는 규칙인지 1-2문장}.
  {언제 활성화되는지 트리거 키워드}.
user-invocable: false     # 자동 적용 규칙
---
```

**핵심 포인트:**
- `user-invocable: false`로 설정하여 관련 작업 시 자동 활성화
- description에 트리거 키워드를 구체적으로 나열
- `/rule-name` 명시적 호출이 아닌 키워드 기반 자동 로드

### Description 트리거 키워드 설계

**원칙:** description에 포함된 키워드가 사용자 요청과 매칭되면 자동 활성화

```yaml
# 좋은 예: 구체적 키워드 + 상황
description: >
  TypeScript 네이밍 컨벤션을 정의합니다.
  변수명, 함수명, 클래스명, 인터페이스 작성 시 자동 적용.
  TypeScript, 네이밍, naming, 코딩 컨벤션 관련 작업 시 활성화.

# 나쁜 예: 모호하고 광범위
description: >
  코드 품질을 높이는 규칙입니다.
```

### 실제 예시: 코딩 컨벤션 Skill

```yaml
---
name: typescript-convention
description: >
  TypeScript 코딩 컨벤션. 네이밍, 타입, 파일 구조 규칙.
  TypeScript, 코드 작성, 리뷰, 리팩토링 시 자동 적용.
user-invocable: false
---

# TypeScript Convention

이 프로젝트의 TypeScript 코딩 컨벤션입니다.

## 네이밍

| 대상 | 규칙 | 예시 |
|------|------|------|
| 변수 | camelCase | `userName` |
| 상수 | UPPER_SNAKE | `MAX_COUNT` |
| 함수 | camelCase | `getUserById` |
| 클래스 | PascalCase | `UserService` |
| 인터페이스 | PascalCase (I 접두사 금지) | `UserProfile` |
| 타입 | PascalCase | `ApiResponse` |
| enum | PascalCase (멤버도) | `UserRole.Admin` |

## 파일 구조

- 파일명: kebab-case (`user-service.ts`)
- 컴포넌트 파일: PascalCase (`UserProfile.tsx`)
- 하나의 파일에 하나의 주요 export

## 타입

- `any` 사용 금지 (불가피한 경우 `unknown` 우선)
- 함수 반환 타입 명시 (공개 API)
- 유틸리티 타입 활용 (`Partial`, `Pick`, `Omit`)

## 상세 규칙

- [상세 네이밍 가이드](references/naming.md)
- [타입 패턴 가이드](references/types.md)
```

---

## 패턴 B: 임베디드 Rules (assets/rules/)

기존 워크플로우 skill에 규칙을 임베딩합니다. feature-workflow의 `assets/rules/` 패턴을 따릅니다.

### 디렉토리 구조

```
skills/{host-skill}/
├── SKILL.md
└── assets/
    └── rules/
        ├── AGENTS.md           # 규칙 인덱스 (필수)
        ├── MUST/               # 필수 규칙 (항상 로드)
        │   ├── workflow-rule.md
        │   └── quality-rule.md
        └── {domain}/           # 도메인 규칙 (조건부 로드)
            ├── AGENTS.md       # 도메인 인덱스 (선택)
            ├── react-rule.md
            └── api-rule.md
```

### AGENTS.md 인덱스 구조

```markdown
# Rules Index

## 필수 규칙 (항상 로드)

| 규칙 | 파일 | 설명 |
|------|------|------|
| 워크플로우 규칙 | MUST/workflow-rule.md | 기본 워크플로우 준수 |
| 품질 규칙 | MUST/quality-rule.md | 코드 품질 기준 |

## 도메인 규칙 (조건부 로드)

| 도메인 | 디렉토리 | 트리거 |
|--------|----------|--------|
| React | react/ | React, 컴포넌트 작업 |
| API | api/ | API, 엔드포인트 작업 |
| Testing | testing/ | 테스트, test 작업 |
```

### 동적 로딩 패턴

호스트 SKILL.md에서 규칙 로드를 지시하는 방법:

```markdown
## 규칙 로드

**각 Step 시작 시 반드시 규칙을 로드하세요:**

1. [assets/rules/AGENTS.md](assets/rules/AGENTS.md) 읽기 (규칙 인덱스)
2. **필수 규칙**: `MUST/` 디렉토리의 모든 규칙 항상 로드
3. **도메인 규칙**: 작업 컨텍스트에 따라 동적 로드

```
작업 시작
    │
    ├─→ MUST/*.md (항상)
    │
    └─→ 작업 컨텍스트에 따라:
        ├─ React 작업 → react/AGENTS.md
        ├─ 테스트 작업 → testing/AGENTS.md
        └─ (디렉토리 없으면 건너뛰기)
```
```

### 언제 패턴 B를 선택하는가

- 호스트 skill이 다단계 워크플로우 (Step 1→2→3...)
- 규칙이 여러 개이며 상황에 따라 다른 규칙 적용 필요
- 규칙 세트가 확장 가능해야 함 (새 도메인 추가 용이)
- feature-workflow처럼 동적 규칙 로딩이 필요

---

## 패턴 C: 기존 Skill 확장

기존 skill에 규칙 섹션이나 references 파일을 추가합니다.

### 500줄 미만: 직접 추가

기존 SKILL.md에 새 섹션을 추가합니다:

```markdown
# 기존 Skill

(기존 내용)

## {새 규칙 섹션}       ← 추가

{규칙 내용}

### 좋은 예

```
{good_example}
```

### 나쁜 예

```
{bad_example}
```
```

### 500줄 초과 예상: references/ 분리

```bash
# 1. references/ 파일 생성
skills/{name}/references/{new_rule}.md

# 2. SKILL.md에 링크 추가
## 상세 가이드 섹션에:
- [{New Rule 제목}](references/{new_rule}.md)
```

### Description 트리거 키워드 추가

기존 description에 새 트리거 키워드를 추가합니다:

```yaml
# 변경 전
description: >
  TypeScript 코딩 컨벤션. 코드 작성 시 자동 적용.

# 변경 후
description: >
  TypeScript 코딩 컨벤션. 코드 작성 시 자동 적용.
  에러 핸들링, error handling 규칙 포함.    ← 추가
```

### 주의사항

- 기존 기능에 영향을 주지 않도록 주의
- 추가 후 전체 줄 수 500줄 이하 유지
- 기존 트리거와 충돌하지 않는지 확인

---

## 패턴 D: Rule 변환

기존 rule 파일을 Skill로 변환합니다. 상세 변환 가이드는 [conversion.md](conversion.md) 참조.

**변환 흐름:**

```
기존 Rule 파일 → 분석 → 패턴 결정(A/B/C) → 변환 실행
```

---

## 트리거 설계 가이드

### 트리거 키워드 선택 방법

1. **핵심 도메인 용어**: 규칙이 다루는 기술/영역의 핵심어
2. **작업 동사**: "작성", "생성", "리뷰", "리팩토링" 등
3. **한국어 + 영어**: 두 언어 모두 포함 권장
4. **구체적 상황**: "컴포넌트 생성 시", "API 설계 시" 등

### 자동 적용 vs 명시적 호출 판단

```
규칙이 항상 적용되어야 하는가?
  YES → user-invocable: false (자동)
    예: 코딩 컨벤션, 네이밍 규칙, 파일 구조

  NO → user-invocable: true (명시적, 기본값)
    예: 배포 체크리스트, 리뷰 가이드
```

### 트리거 충돌 방지

여러 skill의 description이 같은 키워드를 포함하면 충돌 가능:

**방지 전략:**
1. **구체적 키워드**: "코드 품질" → "TypeScript 네이밍 컨벤션"
2. **도메인 한정**: "리뷰" → "React 컴포넌트 리뷰"
3. **기존 skill description 확인**: 추가 전 기존 트리거 확인

```yaml
# 충돌 위험
description: >
  코드 작성 규칙. 코드 작성 시 적용.

# 충돌 방지
description: >
  TypeScript 에러 핸들링 규칙. try-catch, Error 타입 작성 시 적용.
```

### 좋은 description 체크리스트

```
[ ] 무엇을 하는지 1-2문장으로 설명했는가?
[ ] 구체적 트리거 키워드가 3개 이상 포함되었는가?
[ ] 한국어와 영어 키워드를 모두 포함했는가?
[ ] 기존 skill과 트리거가 충돌하지 않는가?
[ ] 너무 광범위하지 않은가? (예: "코드" → 너무 광범위)
```
