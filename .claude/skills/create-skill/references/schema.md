# Skill Frontmatter 스키마

> SKILL.md frontmatter 필드 상세 명세

---

## 필수 필드

### name

| 항목 | 규칙 |
|------|------|
| 길이 | 1-64자 |
| 허용 | 소문자, 숫자, 하이픈(`-`) |
| 금지 | 대문자, 시작/끝 하이픈, 연속 하이픈, 언더스코어 |
| 일치 | 디렉토리명과 동일해야 함 |

```yaml
# 유효
name: pdf-processing
name: data-analysis
name: code-review-v2

# 무효
name: PDF-Processing    # 대문자 불가
name: -pdf              # 하이픈으로 시작 불가
name: pdf--processing   # 연속 하이픈 불가
name: pdf_processing    # 언더스코어 불가
```

### description

| 항목 | 규칙 |
|------|------|
| 길이 | 1-1024자 |
| 내용 | 무엇을 하는지 + 언제 사용하는지 |
| 트리거 | 자연어 키워드 포함 |

```yaml
# 좋은 예
description: >
  PDF 파일에서 텍스트와 테이블을 추출하고, 폼을 작성하며,
  여러 PDF를 병합합니다. PDF 문서 작업이나 사용자가 PDF,
  폼, 문서 추출을 언급할 때 사용하세요.

# 나쁜 예
description: PDF 관련 작업을 도와줍니다.  # 모호함
description: "PDF 처리"  # 따옴표, 키워드 부족
```

---

## 선택 필드

### argument-hint

자동완성 시 표시되는 인자 힌트:

```yaml
argument-hint: "[파일경로]"
argument-hint: "[이슈번호]"
argument-hint: "[버전] [환경]"
```

### disable-model-invocation

`true`면 사용자만 `/skill-name`으로 호출 가능. Claude가 자동 호출하지 않음.

```yaml
# 부작용 있는 작업 (배포, DB 변경 등)
disable-model-invocation: true
```

### user-invocable

`false`면 Claude만 내부적으로 사용. 사용자는 직접 호출 불가.

```yaml
# 내부 지식, 컨벤션
user-invocable: false
```

### context

`fork`면 별도 서브에이전트에서 실행:

```yaml
context: fork
agent: Explore  # 또는 Plan, general-purpose
```

### agent

`context: fork`와 함께 사용. 서브에이전트 유형 지정:

| 값 | 용도 |
|----|------|
| `Explore` | 읽기 전용 탐색 |
| `Plan` | 계획 수립 |
| `general-purpose` | 범용 작업 |

### allowed-tools

스킬 실행 시 허용할 도구 목록:

```yaml
allowed-tools: Read, Grep, Glob
allowed-tools: Bash(git:*) Read Write
```

### license

라이선스 식별자:

```yaml
license: Apache-2.0
license: MIT
license: Proprietary. LICENSE.txt 참조
```

### compatibility

환경 요구사항 (1-500자):

```yaml
compatibility: Python 3.8+, git, docker 필요
compatibility: macOS/Linux만 지원
```

### metadata

임의의 키-값 쌍:

```yaml
metadata:
  author: my-team
  version: "2.1.0"
  category: code-quality
  tags: ["git", "automation"]
```

---

## 필드 조합 예시

### 일반 스킬

```yaml
---
name: pdf-extractor
description: >
  PDF 파일에서 텍스트를 추출합니다.
  PDF, 문서, 텍스트 추출 요청 시 사용.
argument-hint: "[파일경로]"
---
```

### 사용자 전용 스킬 (부작용)

```yaml
---
name: deploy-production
description: >
  프로덕션 환경에 배포합니다.
  배포, 릴리스, 프로덕션 요청 시 사용.
argument-hint: "[버전]"
disable-model-invocation: true
---
```

### Claude 전용 스킬 (내부 지식)

```yaml
---
name: coding-standards
description: >
  프로젝트 코딩 컨벤션.
  코드 작성, 리뷰 시 자동 참조.
user-invocable: false
---
```

### 격리 실행 스킬

```yaml
---
name: codebase-analysis
description: >
  전체 코드베이스 구조를 분석합니다.
  아키텍처 분석, 구조 파악 요청 시 사용.
context: fork
agent: Explore
---
```

---

## 필드 요약 표

| 필드 | 필수 | 기본값 | 용도 |
|------|------|--------|------|
| `name` | O | - | 스킬 식별자 |
| `description` | O | - | 무엇+언제 설명 |
| `argument-hint` | X | - | 인자 힌트 |
| `disable-model-invocation` | X | `false` | 사용자만 호출 |
| `user-invocable` | X | `true` | Claude만 호출 |
| `context` | X | - | 실행 컨텍스트 |
| `agent` | X | - | 서브에이전트 유형 |
| `allowed-tools` | X | 전체 | 도구 제한 |
| `license` | X | - | 라이선스 |
| `compatibility` | X | - | 환경 요구사항 |
| `metadata` | X | - | 추가 정보 |
