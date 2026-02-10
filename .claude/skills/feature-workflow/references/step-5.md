# Step 5: Review & PR (code-review-team 연동)

> **Context Isolation**
> 이전 대화의 내용은 이 Step과 관련이 없습니다.
> 아래 지시사항에만 집중하세요.

---

## 규칙 로드 (필수)

**이 Step을 시작하기 전에 다음 규칙을 로드하세요:**

1. **규칙 인덱스 읽기**: [assets/rules/AGENTS.md](../assets/rules/AGENTS.md)
2. **필수 규칙 로드**: `MUST/workflow-rule.md` (항상)
3. **도메인 규칙 확인**: 리뷰 대상에 따라 동적 로드

**빠른 체크:**

```
□ MUST/workflow-rule.md 로드함
□ Step 5 입력 파일: 40-output-implementation.md 존재 확인
□ status.yaml에서 Step 4 completed 확인
```

---

## 역할 정의

당신은 **Reviewer & PR Author (검토자 & PR 작성자)**입니다.

## 전체 흐름

```
Phase 1: code-review-team 스킬 기반 전문가 리뷰
  ── 사용자 검토 (개선 범위 지정) ──
Phase 2: 팀 개선 + PR 준비
```

---

## Phase 1: 전문가 리뷰

`code-review-team` 스킬의 프로세스를 참조하여 실행합니다.

### 1-1. 프로젝트 컨텍스트 탐색

변경 사항을 보기 **전에** 프로젝트 설정을 파악합니다.

**탐색 대상 (순서대로):**

| 우선순위 | 경로 | 파악할 내용 |
|----------|------|-------------|
| 1 | `CLAUDE.md`, `.claude/CLAUDE.md` | 핵심 규칙, 컨벤션 |
| 2 | `.claude/settings.json` | 허용 도구, 권한 |
| 3 | `.claude/skills/*/SKILL.md` (frontmatter) | 스킬 목록 |
| 4 | `.claude/agents/*/AGENT.md` (frontmatter) | 에이전트 목록 |
| 5 | 프로젝트 루트 설정 파일 | 언어/프레임워크 판별 |
| 6 | lint/format 설정 | 코드 스타일 규칙 |

### 1-2. 전문가 패널 구성

프로젝트 프로파일 기반으로 리뷰 전문가 관점을 동적으로 구성합니다.

**기본 관점** (항상 포함):
- **프로젝트 규칙 준수** — CLAUDE.md, lint 설정 등 프로젝트 자체 규칙 위반 여부
- **정확성** — 로직 오류, 에러 처리, 엣지 케이스

**조건부 관점** (프로파일에 따라 추가):
- 웹 프레임워크 감지 → 보안 관점
- DB/ORM 감지 → 데이터 계층 관점
- 테스트 프레임워크 감지 → 테스트 커버리지 관점

### 1-3. 변경 사항 분석

**diff 범위**: Step 1에서 생성한 feature 브랜치의 전체 변경

```bash
git diff main...HEAD --name-only      # 변경 파일 목록
git diff main...HEAD                   # 전체 diff
```

### 1-4. 리뷰 수행

각 전문가 관점에서 변경된 코드를 검토합니다.

**리뷰 원칙:**
- 프로젝트 컨텍스트 우선 — 일반론보다 이 프로젝트의 규칙/컨벤션 기준
- 이슈 위치를 정확히 지정 (파일:라인)
- 근거 제시 + 개선 방향 제안

**이슈 등급:**

| 등급 | 기준 |
|------|------|
| CRITICAL | 보안 취약점, 데이터 손실, 시스템 장애 유발 |
| MAJOR | 기능 오류, 핵심 규칙 위반, 심각한 성능 저하 |
| MEDIUM | 코드 품질, 컨벤션 불일치, 유지보수 어려움 |
| LOW | 사소한 개선, 스타일 |

### 1-5. 리뷰 문서 저장 및 전달

리뷰 결과를 `.ai/tasks/<TASK_ID>/review.md`에 저장합니다.

**사용자에게 전달:**

```
코드 리뷰 완료
문서: .ai/tasks/{TASK_ID}/review.md

프로젝트 컨텍스트: {언어}, {프레임워크}, {핵심 규칙 요약}
리뷰 관점: {적용된 전문가 목록}

| 등급 | 건수 |
|------|------|
| CRITICAL | N |
| MAJOR | N |
| MEDIUM | N |
| LOW | N |

주요 이슈:
1. src/auth.ts:45 — [보안] 입력 검증 누락
2. ...

개선을 진행하려면 범위를 지정해주세요.
예: "CRITICAL 전부", "1, 3번", "전부", "넘어가기"
```

---

## Phase 2: 이슈 개선 + PR 준비

사용자가 개선 범위를 지정하면 실행합니다. "넘어가기" 선택 시 바로 PR 준비로 이동합니다.

### 2-1. Team 기반 개선

`code-review-team` 스킬의 Phase 2 프로세스를 참조하여 실행합니다.

**절차 (순서대로):**

1. **범위 확정 및 그룹핑**: 대상 이슈를 파일 단위로 그룹핑
2. **`TeamCreate` 도구 호출**: `team_name`: `"review-{TASK_ID}"`, `description`: `"{TASK_ID} 리뷰 이슈 개선"`
3. **`TaskCreate` 도구 호출** (그룹별, 동시에): 프로젝트 컨텍스트 + 담당 이슈 목록 + 개선 방향을 description에 포함
4. **`Task` 도구로 Worker 스폰** (동시에):
   - `subagent_type`: `"general-purpose"`, `team_name`: `"review-{TASK_ID}"`
   - `name`: `"review-worker-{N}"`, `mode`: `"bypassPermissions"`
   - `prompt`: 프로젝트 규칙 + 이슈 목록 + 작업 절차 (TaskList → TaskUpdate → Edit → SendMessage → TaskUpdate)
5. **`TaskUpdate` 도구**로 각 Worker에게 Task 할당 (`owner`: Worker name)
6. **완료 대기**: Worker의 SendMessage 자동 수신
7. **`SendMessage` 도구**로 모든 Worker에게 `shutdown_request` 전송
8. **`TeamDelete` 도구** 호출로 팀 정리

### 2-2. PR 준비

50-output-review.md에 바로 사용 가능한 PR 내용을 작성합니다:

- **PR 제목**: `feat(<TASK_ID>): <기능 요약>`
- **Summary**: 주요 변경 사항 (bullet points)
- **Changes**: 변경 파일 목록과 설명
- **Test Plan**: TS-xxx 통과 현황
- **Review**: 리뷰 결과 요약 (이슈 등급별 건수, 개선 완료 여부)
- **Checklist**: 검증 항목

## 체크리스트

- [ ] Phase 1 전문가 리뷰 완료
- [ ] 리뷰 결과가 review.md에 저장됨
- [ ] 사용자가 개선 범위를 확인함
- [ ] Phase 2 개선 작업 완료 (해당 시)
- [ ] PR 제안 작성 완료
- [ ] 50-output-review.md 작성 완료

## 주의사항

- **code-review-team 스킬 참조**: 전문가 패널 구성, 리뷰 원칙은 해당 스킬의 프로세스를 따릅니다.
- **diff 범위**: 마지막 커밋이 아닌 feature 브랜치 전체 변경(`main...HEAD`)을 대상으로 합니다.
- **복사 가능한 출력**: PR 제안은 바로 복사하여 사용할 수 있어야 합니다.
- **블로커 식별**: CRITICAL 이슈 중 미해결 항목이 있으면 PR 생성을 보류합니다.

## 출력 가이드

[assets/templates/50-output-review.md](../assets/templates/50-output-review.md) 형식을 따르세요.

출력 파일 위치: `.ai/tasks/<TASK_ID>/50-output-review.md`

---

## 완료 처리

### 1. 사용자 확인 (필수)

체크리스트를 모두 만족했다면 사용자에게 확인합니다:

```
Step 5 체크리스트 완료 확인:
- [x] 전문가 리뷰 완료 (review.md 저장)
- [x] 리뷰 이슈 개선 완료 (또는 스킵)
- [x] PR 제안 작성 완료
- [x] 50-output-review.md 작성 완료

Step 5를 완료 처리하고 워크플로우를 종료할까요?
```

> **사용자 승인 없이 완료 처리하지 마세요.**

### 2. 승인 후 처리

#### Git 커밋

```bash
git add .ai/tasks/<TASK_ID>/50-output-review.md .ai/tasks/<TASK_ID>/review.md
git commit -m "feat/<TASK_ID>-[AI]: Completed Step 5 review"
```

#### status.yaml 업데이트

```yaml
status: completed
current_step: step-5
steps:
  step-5:
    status: completed
```

### 3. PR 생성

50-output-review.md의 "PR 제안" 섹션을 사용하여 PR을 생성합니다:

```bash
git push origin <branch-name>
gh pr create --title "<제안된 제목>" --body "<제안된 본문>"
```

### 4. 완료 안내

```
Step 5 완료! 워크플로우가 모두 완료되었습니다!

다음 작업:
1. PR 리뷰 요청
2. 머지 후 브랜치 정리
```
