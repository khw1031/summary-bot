# Agent Team SPAWN 상세 가이드

> Phase 2 개선 작업 시 팀 스폰 및 관리 상세

---

## 팀 구성

| 역할 | 수 | 담당 |
|------|-----|------|
| 리더 (본인) | 1 | 작업 분배, 프로젝트 컨텍스트 전달, 결과 수집 |
| refactor-worker | 1~5 | 파일 단위 개선 실행 |

**팀원 수**: 이슈 그룹 수에 따라 결정 (1~2그룹 → 1~2명, 3~4그룹 → 3~4명, 5+ → 5명 최대)

---

## 스폰 절차

### Step 1: TeamCreate 도구 호출

```
TeamCreate 도구:
  team_name: "review-{TICKET_ID}"
  description: "{TICKET_ID} 코드 리뷰 이슈 개선"
```

### Step 2: TaskCreate 도구 호출 (그룹별, 동시에)

이슈 그룹마다 TaskCreate 도구를 호출합니다. 독립적이므로 **모두 동시에** 호출합니다.

```
TaskCreate 도구:
  subject: "개선: {파일명} ({이슈 수}건)"
  description: |
    ## 프로젝트 컨텍스트
    {Phase 1에서 파악한 프로젝트 프로파일 요약}
    - 핵심 규칙: ...
    - 코드 스타일: ...

    ## 담당 파일
    {파일 경로}

    ## 수정할 이슈
    1. 라인 {N}: [{관점}] {설명}
       근거: {근거}
       개선 방향: {방향}
    2. ...
  activeForm: "{파일명} 개선 중"
```

### Step 3: Task 도구로 Worker 스폰 (동시에)

Worker 수만큼 Task 도구를 호출합니다. 독립적이므로 **모두 동시에** 호출합니다.

```
Task 도구:
  subagent_type: "general-purpose"
  team_name: "review-{TICKET_ID}"
  name: "refactor-worker-1"
  description: "코드 개선 Worker 1"
  mode: "bypassPermissions"
  prompt: (아래 Worker 프롬프트 참조)
```

> **중요**: Worker는 Lead의 대화 히스토리를 상속하지 않습니다. prompt에 필요한 맥락을 **모두** 포함해야 합니다.

### Step 4: TaskUpdate로 할당

Worker 스폰 후 각 Worker에게 Task를 할당합니다.

```
TaskUpdate 도구:
  taskId: "{태스크 ID}"
  owner: "refactor-worker-1"
```

### Step 5: 완료 대기

Worker들이 SendMessage로 결과를 보고합니다. 메시지는 자동 수신됩니다.
모든 Worker의 보고가 도착하면 결과를 취합합니다.

> Worker가 idle 상태가 되는 것은 정상입니다. idle ≠ 종료. 메시지를 보내면 다시 활성화됩니다.

### Step 6: 종료 및 정리

모든 Worker에게 SendMessage로 종료를 요청합니다.

```
SendMessage 도구:
  type: "shutdown_request"
  recipient: "refactor-worker-1"
  content: "작업 완료. 종료합니다."
```

모든 Worker가 종료된 후 TeamDelete 도구를 호출합니다.

---

## 이슈 그룹핑

### 같은 Task로 묶는 경우

- 같은 파일의 이슈
- import/export로 직접 연결된 파일
- 같은 함수/클래스에 걸친 이슈

### 별도 Task로 분리하는 경우

- 독립적인 파일
- 서로 다른 모듈/기능 영역

---

## Worker 프롬프트 템플릿

아래 템플릿의 `{placeholder}`를 실제 값으로 채워서 Task 도구의 `prompt` 파라미터에 전달합니다.

```markdown
당신은 코드 개선 담당 팀메이트입니다.
팀 "review-{TICKET_ID}"에 소속되어 있습니다.
당신의 이름은 "refactor-worker-{N}"입니다.

## 프로젝트 컨텍스트

이 프로젝트의 규칙과 컨벤션입니다. 수정 시 반드시 따르세요.

{CLAUDE.md에서 추출한 핵심 규칙}
{lint/format 설정 요약}
{관련 스킬이 정의한 컨벤션}

## 담당 파일
{파일 경로 목록}

## 수정할 이슈

### 이슈 #{번호}: [{관점}] {설명}
- **위치**: {파일}:{라인}
- **근거**: {근거}
- **개선 방향**: {방향}

## 작업 절차

다음 절차를 순서대로 수행하세요:

1. **TaskList 도구** 호출 → 할당된 태스크 확인
2. **TaskGet 도구** 호출 → 태스크 상세 내용 확인
3. **TaskUpdate 도구** 호출 → status를 "in_progress"로 변경
4. **Read 도구**로 대상 파일 읽기
5. **Edit 도구**로 이슈별 수정 적용 (프로젝트 규칙/컨벤션 준수)
6. **SendMessage 도구** 호출 → 리더에게 변경 내역 보고
   - type: "message"
   - recipient: "leader"  (팀 리더 이름)
   - content: 수정한 내용 요약
   - summary: "Worker {N} 작업 완료"
7. **TaskUpdate 도구** 호출 → status를 "completed"로 변경

## 규칙
- 담당 파일만 수정하세요
- 프로젝트의 기존 코드 스타일을 유지하세요
- 이슈와 무관한 코드를 건드리지 마세요
- 새로운 의존성을 추가하지 마세요
- 리뷰에서 제시한 개선 방향을 따르세요
- 종료 요청(shutdown_request)을 받으면 SendMessage 도구로 승인하세요:
  type: "shutdown_response", request_id: (요청의 requestId), approve: true
```

---

## 에러 처리

| 상황 | 대응 |
|------|------|
| Worker가 파일을 찾지 못함 | 리더에게 SendMessage로 보고, 해당 Task skip |
| Worker 간 파일 충돌 | 그룹핑 오류 → 리더가 순차 처리 |
| Worker 타임아웃 | 미완료로 보고 |
| 프로젝트 규칙 불명확 | Worker가 리더에게 SendMessage로 질문 → 리더가 판단 |
