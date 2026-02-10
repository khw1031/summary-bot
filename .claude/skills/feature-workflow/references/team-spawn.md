# Agent Team SPAWN 상세 가이드 (Step 4 구현)

> Step 4 Implementation에서 Agent Team을 스폰하여 병렬 구현하는 절차

---

## 팀 구성

| 역할 | 수 | 담당 |
|------|-----|------|
| Coordinator (본인 = Team Lead) | 1 | 작업 분배, 진행 관리, 결과 수집 |
| impl-worker | 2~5 | 개별 태스크 구현 (TDD) |

**Worker 수 결정 기준:**

| 독립 태스크 수 | Worker 수 |
|---------------|-----------|
| 1~2개 | 2명 |
| 3~4개 | 3명 |
| 5개 이상 | 최대 5명 |

의존성 그래프의 최대 병렬도를 기준으로 결정합니다.

---

## 스폰 절차

### Step 1: TeamCreate 도구 호출

| 파라미터 | 값 |
|----------|-----|
| `team_name` | `"impl-{TASK_ID}"` |
| `description` | `"{TASK_ID} 기능 구현"` |

### Step 2: TaskCreate 도구 호출 (todos/*.md 기반, 동시에)

각 `todos/NN-TASK.md` 파일을 Team Task로 생성합니다. 모든 태스크를 **동시에** 생성합니다.

| 파라미터 | 값 |
|----------|-----|
| `subject` | `"impl: {작업명}"` |
| `description` | TASK_MASTER INSTRUCTION + 태스크 상세 인라인 (아래 참조) |
| `activeForm` | `"{작업명} 구현 중"` |

**description에 포함할 내용:**

```
## TASK_MASTER INSTRUCTION
{00-TASK_MASTER.md의 INSTRUCTION 섹션 전체 인라인}

## 태스크 상세
{해당 NN-TASK.md 핵심 내용 인라인}

## 파일
- 생성: {파일 경로}
- 수정: {파일 경로}

## 의존
- 선행: {선행 태스크 subject}

## TDD
- 관련 TS: {TS-xxx 목록}
```

의존성이 있는 태스크는 생성 직후 `TaskUpdate` 도구로 `addBlockedBy`를 설정합니다.

**TaskCreate 매핑 예시:**

| todos 파일 | Team Task subject | blockedBy |
|------------|-------------------|-----------|
| 01-TASK.md | impl: 타입 정의 | - |
| 02-TASK.md | impl: API 클라이언트 | Task #1 |
| 03-TASK.md | impl: 비즈니스 로직 | Task #1, #2 |
| 04-TASK.md | impl: UI 컴포넌트 | Task #3 |
| 05-TASK.md | impl: 통합 테스트 | Task #4 |

### Step 3: Task 도구로 Worker 스폰 (동시에)

Worker 수만큼 `Task` 도구를 호출합니다. **모든 Worker를 동시에** 스폰합니다.

| 파라미터 | 값 |
|----------|-----|
| `subagent_type` | `"general-purpose"` |
| `team_name` | `"impl-{TASK_ID}"` |
| `name` | `"impl-worker-{N}"` (1부터 순번) |
| `description` | `"기능 구현 Worker {N}"` |
| `mode` | `"bypassPermissions"` |
| `prompt` | Worker 프롬프트 (아래 템플릿 참조) |

> **중요**: Worker는 Lead의 대화 히스토리를 상속하지 않습니다. prompt에 필요한 맥락을 **모두** 포함해야 합니다.

### Step 4: 모니터링 및 조율

- Worker의 SendMessage 자동 수신 (완료/이슈 보고)
- 문제 발생 시 `SendMessage` 도구로 Worker에게 재조정 지시
  - `type`: `"message"`, `recipient`: `"impl-worker-{N}"`, `content`: 재조정 내용, `summary`: 요약
- TASK_MASTER.md 진행 상황 업데이트

> Worker가 idle 상태가 되는 것은 정상입니다. idle ≠ 종료. 메시지를 보내면 다시 활성화됩니다.

### Step 5: 종료 및 정리

1. 모든 Team Task가 `completed` 확인
2. 모든 Worker에게 `SendMessage` 도구로 종료 요청:

| 파라미터 | 값 |
|----------|-----|
| `type` | `"shutdown_request"` |
| `recipient` | `"impl-worker-{N}"` |
| `content` | `"작업 완료. 종료합니다."` |

3. 모든 Worker 종료 후 `TeamDelete` 도구 호출
4. `40-output-implementation.md` 작성

---

## Worker 프롬프트 템플릿

아래 템플릿의 `{placeholder}`를 실제 값으로 채워서 `Task` 도구의 `prompt` 파라미터에 전달합니다.

```markdown
당신은 기능 구현 담당 팀메이트입니다.
팀 "impl-{TASK_ID}"에 소속되어 있습니다.
당신의 이름은 "impl-worker-{N}"입니다.

## TASK_MASTER INSTRUCTION

{00-TASK_MASTER.md의 INSTRUCTION 섹션 전체}
- 코드 패턴 가이드
- 금지 사항
- 완료 조건
- Git 규칙

## 프로젝트 컨텍스트

{프로젝트 핵심 규칙/컨벤션 요약}

## 작업 절차

다음 절차를 반복 수행하세요:

1. **TaskList 도구** 호출 → 할당 가능한 Task 확인 (blockedBy가 비어있고 owner가 없는 것)
2. **TaskUpdate 도구** 호출 → 클레임 (owner를 자신의 이름 "impl-worker-{N}"으로 설정)
3. **TaskUpdate 도구** 호출 → status를 "in_progress"로 변경
4. **TaskGet 도구** 호출 → 태스크 상세 내용 확인
5. 구현 (TDD):
   a. 관련 TS-xxx 테스트 코드 먼저 작성 (Red)
   b. 구현 코드 작성 (Green)
   c. 리팩토링 (Refactor)
   d. 모든 관련 테스트 통과 확인
6. Git 커밋:
   ```bash
   git add [변경된 파일들]
   git commit -m "feat({TASK_ID}): [요약] - task-[NUM]"
   ```
7. **SendMessage 도구** 호출 → 리더에게 완료 보고:
   - type: "message"
   - recipient: "leader" (또는 팀 리더의 실제 이름)
   - content: 변경 파일, 테스트 결과, 요약
   - summary: "Worker {N} task-[NUM] 완료"
8. **TaskUpdate 도구** 호출 → status를 "completed"로 변경
9. **TaskList 도구** 호출 → 다음 할당 가능한 Task 확인 (있으면 2번으로 돌아가 반복)

## 규칙

- TASK_MASTER의 코드 패턴 가이드를 반드시 따르세요
- TASK_MASTER의 금지 사항을 위반하지 마세요
- TDD 원칙: 테스트 먼저 작성 → 구현 → 리팩토링
- 담당 Task의 범위만 구현하세요
- blockedBy가 있는 Task는 클레임하지 마세요
- 문제 발생 시 SendMessage 도구로 리더에게 보고하세요:
  - type: "message", recipient: "leader", content: 문제 내용, summary: "Worker {N} 이슈 보고"
- 종료 요청(shutdown_request)을 받으면 SendMessage 도구로 승인하세요:
  - type: "shutdown_response", request_id: (요청의 requestId), approve: true
```

---

## 에러 처리

| 상황 | 대응 |
|------|------|
| Worker가 파일을 찾지 못함 | 리더에게 SendMessage로 보고, 경로 안내 |
| Worker 간 파일 충돌 | 그룹핑 오류 → 리더가 순차 처리로 전환 |
| Worker 타임아웃 | 미완료 Task를 다른 Worker에 재할당 |
| 테스트 실패 | Worker가 리더에게 SendMessage로 보고 → 리더가 원인 판단 |
| 규칙 불명확 | Worker가 리더에게 SendMessage로 질문 → 리더가 판단 후 안내 |
