# Agent Frontmatter 스키마

> AGENT.md frontmatter 필드 상세 명세

---

## 필수 필드

### name

| 항목 | 규칙 |
|------|------|
| 형식 | 소문자, 하이픈만 |
| 제한 | 하이픈으로 시작 불가, 연속 하이픈 불가 |
| 용도 | 고유 식별자 |

```yaml
# 유효
name: code-reviewer
name: security-scanner
name: data-analyst

# 무효
name: CodeReviewer      # 대문자 불가
name: code_reviewer     # 언더스코어 불가
name: -code-reviewer    # 하이픈 시작 불가
name: code--reviewer    # 연속 하이픈 불가
```

### description

Claude가 태스크 위임 시 판단하는 핵심 기준입니다.

| 항목 | 규칙 |
|------|------|
| 내용 | 역할 + 위임 조건 + "Use proactively" 패턴 |
| 중요도 | CRITICAL - 위임 여부 결정 |

```yaml
# 좋은 예
description: >
  코드 리뷰 전문가. 코드 변경 후 사전에 품질, 보안,
  유지보수성을 검토합니다. 코드 작성/수정 직후 사용.
  Use proactively after code changes.

# 나쁜 예
description: 코드를 검토합니다.  # 모호함, 위임 조건 없음
```

---

## 선택 필드

### tools

허용할 도구 목록. 생략 시 전체 상속.

```yaml
# 읽기 전용
tools: Read, Grep, Glob, Bash

# 수정 가능
tools: Read, Edit, Write, Grep, Glob, Bash

# 최소 권한
tools: Read, Grep, Glob

# 특정 subagent만 스폰 허용
tools: Task(worker, researcher), Read, Bash
```

### disallowedTools

명시적으로 거부할 도구:

```yaml
# 읽기 전용 에이전트
tools: Read, Grep, Glob, Bash
disallowedTools: Write, Edit
```

### model

서브에이전트 모델 선택:

| 값 | 설명 |
|----|------|
| `haiku` | 빠른 탐색, 간단한 검색, 비용 효율 |
| `sonnet` | 분석, 리뷰, 균형 잡힌 작업 |
| `opus` | 복잡한 추론, 아키텍처 결정 |
| `inherit` | 메인 대화와 동일 (기본값) |

```yaml
model: sonnet
model: inherit
```

### permissionMode

권한 처리 방식:

| 값 | 설명 |
|----|------|
| `default` | 기본 확인 (기본값) |
| `acceptEdits` | 편집 자동 승인 |
| `dontAsk` | 모든 프롬프트 거부 |
| `bypassPermissions` | 모든 권한 우회 |
| `plan` | 계획 모드 |

```yaml
permissionMode: acceptEdits
```

### skills

시작 시 주입할 스킬 목록. 스킬 내용이 에이전트 컨텍스트에 포함됩니다.

```yaml
skills:
  - api-conventions
  - error-handling-patterns
```

### maxTurns

최대 에이전틱 턴 수:

```yaml
maxTurns: 10
```

### mcpServers

사용할 MCP 서버:

```yaml
mcpServers:
  server-name:
    command: "npx"
    args: ["-y", "@example/mcp-server"]
```

### memory

영속 메모리. 활성화 시 `MEMORY.md` 자동 로드 (200줄까지), Read/Write/Edit 도구 자동 활성화.

| Scope | 경로 | 적합한 경우 |
|-------|------|------------|
| `user` | `~/.claude/agent-memory/<name>/` | 모든 프로젝트 공통 학습 |
| `project` | `.claude/agent-memory/<name>/` | 프로젝트 고유, VCS 공유 가능 |
| `local` | `.claude/agent-memory-local/<name>/` | 프로젝트 고유, VCS 제외 |

```yaml
memory: user
```

### hooks

에이전트 라이프사이클 훅. 핸들러 타입은 3가지:

| 타입 | 설명 |
|------|------|
| `command` | 셸 명령 실행, stdin으로 JSON 수신 |
| `prompt` | LLM에 단일 턴 평가 요청 |
| `agent` | 서브에이전트 스폰, Read/Grep/Glob 사용 가능 |

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-query.sh"
```

---

## 필드 조합 예시

### 읽기 전용 분석 에이전트

```yaml
---
name: security-scanner
description: >
  보안 취약점 분석 전문가. 코드 변경 후 자동으로 사용.
  OWASP Top 10, 인젝션, 인증 취약점을 검사합니다.
  Use proactively after code changes to security-sensitive files.
tools: Read, Grep, Glob, Bash
disallowedTools: Write, Edit
---
```

### 수정 가능 에이전트

```yaml
---
name: refactoring-expert
description: >
  코드 리팩토링 전문가. 중복 코드 제거, 구조 개선을 수행합니다.
  리팩토링, 코드 정리, 구조 개선 요청 시 위임하세요.
  Use proactively when detecting code smells or duplication.
tools: Read, Edit, Write, Grep, Glob, Bash
permissionMode: acceptEdits
---
```

### 도메인 지식 에이전트 (스킬 주입)

```yaml
---
name: react-developer
description: >
  React 개발 전문가. 컴포넌트 설계, 상태 관리, 훅 작성을 담당합니다.
  React 관련 코드 작성, 컴포넌트 개선 요청 시 위임.
  Use proactively for React-related implementation tasks.
tools: Read, Edit, Write, Grep, Glob, Bash
skills:
  - react-patterns
  - coding-standards
---
```

### 검증 훅 에이전트

```yaml
---
name: database-operator
description: >
  데이터베이스 작업 전문가. 안전한 DB 쿼리만 실행합니다.
  마이그레이션, 쿼리 실행, 데이터 조회 요청 시 위임.
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-db-query.sh"
---
```

---

## 필드 요약 표

| 필드 | 필수 | 기본값 | 용도 |
|------|------|--------|------|
| `name` | O | - | 에이전트 식별자 |
| `description` | O | - | 역할 + 위임 조건 + proactive |
| `tools` | X | 전체 상속 | 허용 도구 |
| `disallowedTools` | X | - | 거부 도구 |
| `model` | X | `inherit` | 모델 선택 |
| `permissionMode` | X | `default` | 권한 모드 |
| `maxTurns` | X | - | 최대 에이전틱 턴 수 |
| `skills` | X | - | 스킬 주입 |
| `hooks` | X | - | 라이프사이클 훅 |
| `mcpServers` | X | - | MCP 서버 지정 |
| `memory` | X | - | 영속 메모리 스코프 |

---

## 우선순위

에이전트 로드 우선순위:

```
1. --agents CLI 플래그 (세션 한정)
2. .claude/agents/ (프로젝트)
3. ~/.claude/agents/ (사용자)
4. 플러그인 agents/ (가장 낮음)
```

동일 이름일 경우 높은 우선순위가 적용됩니다.
