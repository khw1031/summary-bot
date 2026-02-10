# SKILL.md 본문 작성 가이드

> SKILL.md의 markdown body (frontmatter 이후)를 효과적으로 구성하는 방법

---

## 본문의 역할

본문은 Progressive Disclosure **Stage 2**입니다.

- Stage 1 (frontmatter): "이 스킬이 필요한가?" 판단
- **Stage 2 (본문): 작업 수행에 필요한 핵심 지침** ← 여기
- Stage 3 (references/): 상세 문서, 예제, 스크립트

본문만 읽고 작업을 수행할 수 있어야 합니다. 상세 정보 없이도 80% 이상의 케이스를 처리할 수 있는 수준으로 작성하세요.

---

## 토큰 예산

| 제약 | 값 |
|------|-----|
| 최대 줄 수 | 500줄 |
| 최대 토큰 | 5000 토큰 |
| 권장 줄 수 | 100-300줄 |

500줄을 초과하면 references/로 분리가 필요합니다.

---

## 본문 구조 패턴

### 권장 구조

```markdown
# 스킬 제목

[1-2문장 핵심 설명]

## 핵심 규칙/원칙
[항상 따라야 하는 규칙 - 테이블이나 리스트]

## 사용 방법
[단계별 지침 - 핵심 흐름만]

## 상세 정보
- [참조 문서 링크](references/detail.md)
```

### 섹션별 가이드

| 섹션 | 목적 | 분량 |
|------|------|------|
| 제목 + 설명 | 스킬이 무엇인지 한눈에 | 2-3줄 |
| 핵심 규칙 | 매번 확인해야 하는 필수 사항 | 본문의 30-50% |
| 사용 방법 | 실행 흐름, 단계별 지침 | 본문의 30-50% |
| 참조 링크 | Stage 3 문서로의 진입점 | 5-10줄 |

---

## 본문 vs references 판단 기준

### 본문에 넣는 것

- 매번 참조해야 하는 핵심 규칙
- 필수 워크플로우 단계
- 주요 제약 사항과 경고
- 핵심 옵션/설정 테이블
- 자주 발생하는 패턴 1-2개

### references/로 분리하는 것

- 예제 모음 (3개 이상)
- 전체 옵션/스키마 상세
- 엣지 케이스 처리 방법
- 배경 지식, 이론 설명
- 트러블슈팅 가이드
- 템플릿 컬렉션

### 판단 질문

> "이 내용이 없으면 스킬을 사용할 수 없는가?"
> - Yes → 본문에 포함
> - No → references/로 분리

---

## 좋은/나쁜 본문 예시

### 나쁜 예: 과도한 본문

```markdown
# Git 커밋 메시지 생성

## 개요
커밋 메시지를 생성합니다...

## Conventional Commits 상세
(50줄의 상세 스펙)

## 커밋 타입별 설명
feat: 새로운 기능 추가 ...
fix: 버그 수정 ...
(20줄의 타입 설명)

## 예제 모음
### 예제 1: 단순 기능 추가
(10줄)
### 예제 2: 버그 수정
(10줄)
### 예제 3: 리팩토링
(10줄)
### 예제 4: 복합 변경
(15줄)
...

## 트러블슈팅
(30줄의 문제 해결)
```

**문제:** 예제와 상세 스펙이 본문을 비대하게 만듦

### 좋은 예: 적절한 본문

```markdown
# Git 커밋 메시지 생성

커밋 메시지를 Conventional Commits 형식으로 생성합니다.

## 형식

`<type>(<scope>): <subject>`

주요 타입: feat, fix, refactor, docs, test, chore

## 작성 단계

1. `git diff --staged` 분석
2. 변경 유형 판별 → type 결정
3. 영향 범위 → scope 결정
4. 핵심 변경 → subject 작성

## 규칙

- subject는 50자 이하, 현재형
- body는 why에 집중 (what은 diff에 있음)
- breaking change는 footer에 `BREAKING CHANGE:` 표기

## 상세 정보

- [타입별 상세 가이드](references/types.md)
- [예제 모음](references/examples.md)
```

**장점:** 핵심만 포함, 상세는 references로 분리

---

## 파일 참조 작성법

### 상대 경로 사용

```markdown
# 올바른 참조
- [가이드](references/guide.md)
- [스크립트](scripts/run.sh)
- [템플릿](assets/template.json)

# 잘못된 참조
- [가이드](/Users/user/.claude/skills/my-skill/references/guide.md)
- [가이드](../other-skill/references/guide.md)
```

### 1단계 깊이 유지

```
# 올바른 구조
references/guide.md         ← 1단계 깊이
scripts/analyze.py          ← 1단계 깊이

# 피해야 하는 구조
references/sub/deep/guide.md  ← 3단계 깊이 (로드 실패 가능)
```

### 참조 섹션 패턴

본문 마지막에 참조 링크를 모아두세요:

```markdown
## 상세 가이드

- [옵션 상세](references/options.md)
- [예제 모음](references/examples.md)
- [트러블슈팅](references/troubleshooting.md)
```
