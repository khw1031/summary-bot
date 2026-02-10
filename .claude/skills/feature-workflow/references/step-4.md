# Step 4: Implementation (Agent Team)

> **Context Isolation**
> 이전 대화의 내용은 이 Step과 관련이 없습니다.
> 아래 지시사항에만 집중하세요.

---

## 규칙 로드 (필수)

**이 Step을 시작하기 전에 다음 규칙을 로드하세요:**

1. **규칙 인덱스 읽기**: [assets/rules/AGENTS.md](../assets/rules/AGENTS.md)
2. **필수 규칙 로드**: `MUST/workflow-rule.md` (항상)
3. **도메인 규칙 확인**: 구현 대상에 따라 동적 로드
   - 예: React 컴포넌트 → `react/AGENTS.md`
   - 예: API 클라이언트 → `api/AGENTS.md`
   - 예: 테스트 작성 → `testing/AGENTS.md`

**빠른 체크:**

```
□ MUST/workflow-rule.md 로드함
□ Step 4 입력 파일: 20-output-system-design.md, 30-output-task.md, todos/*.md 존재 확인
□ status.yaml에서 Step 3 completed 확인
```

---

## 역할 정의

당신은 **Coordinator (Team Lead)**입니다.

## 책임

1. **Team 구성**: Agent Team을 스폰하여 구현 작업을 병렬 수행
2. **작업 분배**: Step 3에서 분해된 태스크를 Team Task로 생성하고 의존성 설정
3. **진행 관리**: Worker 메시지를 수신하며 진행 상황 모니터링
4. **결과 취합**: 모든 Worker 완료 후 결과를 검증하고 문서화

## 작업 절차

### 1. 입력 파일 읽기

다음 파일들을 읽어 구현 계획을 이해합니다:

- `.ai/tasks/<TASK_ID>/20-output-system-design.md` — 전체 설계
- `.ai/tasks/<TASK_ID>/30-output-task.md` — 작업 분해 결과
- `.ai/tasks/<TASK_ID>/todos/00-TASK_MASTER.md` — 전체 조율 계획
- `.ai/tasks/<TASK_ID>/todos/*.md` — 개별 서브태스크

### 2. Team 스폰

[Team 스폰 상세 가이드](team-spawn.md)를 참조하여 Agent Team을 구성합니다.

다음 절차를 **순서대로** 실행합니다.

#### 2-1. 팀 생성

`TeamCreate` 도구를 호출합니다.

| 파라미터 | 값 |
|----------|-----|
| `team_name` | `"impl-{TASK_ID}"` |
| `description` | `"{TASK_ID} 기능 구현"` |

#### 2-2. 태스크 생성

각 `todos/NN-TASK.md` 파일을 기반으로 `TaskCreate` 도구를 호출합니다. 모든 태스크를 **동시에** 생성합니다.

| 파라미터 | 값 |
|----------|-----|
| `subject` | `"impl: {작업명}"` |
| `description` | TASK_MASTER INSTRUCTION 섹션 전체 + 해당 태스크 상세 인라인 |
| `activeForm` | `"{작업명} 구현 중"` |

의존성이 있는 태스크는 생성 직후 `TaskUpdate` 도구로 `addBlockedBy`를 설정합니다.

#### 2-3. Worker 스폰

Worker 수만큼 `Task` 도구를 호출합니다. **모든 Worker를 동시에** 스폰합니다.

| 파라미터 | 값 |
|----------|-----|
| `subagent_type` | `"general-purpose"` |
| `team_name` | `"impl-{TASK_ID}"` |
| `name` | `"impl-worker-{N}"` (1부터 순번) |
| `description` | `"기능 구현 Worker {N}"` |
| `mode` | `"bypassPermissions"` |
| `prompt` | Worker 프롬프트 ([team-spawn.md](team-spawn.md) 템플릿 참조) |

**Worker 프롬프트에 반드시 포함할 내용:**
- TASK_MASTER INSTRUCTION 전체 (코드 패턴, 금지 사항, 완료 조건, Git 규칙)
- 프로젝트 핵심 규칙/컨벤션 요약
- **작업 절차 지시** (TaskList → 클레임 → TaskUpdate in_progress → TDD 구현 → 커밋 → SendMessage 보고 → TaskUpdate completed → TaskList 반복)

> **중요**: Worker는 Lead의 대화 히스토리를 상속하지 않습니다. prompt에 필요한 맥락을 **모두** 포함해야 합니다.

#### 2-4. 모니터링

- Worker의 SendMessage 자동 수신 (완료/이슈 보고)
- 문제 발생 시 `SendMessage` 도구로 Worker에게 재조정 지시
- TASK_MASTER.md 진행 상황 업데이트

**Worker 수 결정:**

- 의존성 그래프의 최대 병렬도 기반
- 1~2개 독립 태스크 → 2명, 3~4개 → 3명, 5+ → 최대 5명

### 3. 모니터링

Worker 작업 진행을 확인합니다:

- Worker의 SendMessage 자동 수신 (완료/이슈 보고)
- 구현된 코드 및 테스트 통과 여부 확인
- 문제 발생 시 SendMessage로 재조정 지시
- TASK_MASTER.md 진행 상황 표 업데이트

### 4. 완료 처리

**트리거 조건**: 모든 Team Task가 `completed`

**필수 작업:**

1. **모든 Worker에게 `SendMessage` 도구로 `shutdown_request` 전송**
   - `type`: `"shutdown_request"`, `recipient`: `"impl-worker-{N}"`, `content`: `"작업 완료. 종료합니다."`
2. **모든 Worker 종료 후 `TeamDelete` 도구 호출**
3. **40-output-implementation.md 생성**
   - 템플릿: [assets/templates/40-output-implementation.md](../assets/templates/40-output-implementation.md)
   - 출력 위치: `.ai/tasks/<TASK_ID>/40-output-implementation.md`
4. **내용 작성**
   - Phase별 구현 내역 정리
   - 모든 변경 파일 목록
   - 검증 결과 체크리스트
   - Step 5 검토 요청사항
5. **status.yaml 업데이트**
   - step-4.status → `completed`
   - current_step → `step-5`

> **주의**: 40-output-implementation.md 생성 없이 status.yaml을 completed로 변경하지 마세요.

## 체크리스트

- [ ] 모든 서브태스크가 Worker를 통해 완료되었는가?
- [ ] Worker가 생성한 코드가 설계 문서와 일치하는가?
- [ ] 단위 테스트가 작성되고 통과하는가?
- [ ] 코드 컨벤션을 준수하는가?
- [ ] 엣지 케이스가 처리되었는가?
- [ ] 보안 취약점은 없는가?
- [ ] Git 커밋이 의미 있게 분리되었는가?
- [ ] 40-output-implementation.md에 문서화되었는가?

## 주의사항

- **Agent Team 활용**: 직접 코드를 작성하지 말고 Worker에게 위임합니다.
- **TDD 강제**: Worker는 반드시 테스트 먼저 작성 후 구현합니다.
- **의존성 관리**: TaskCreate 시 `addBlockedBy`로 의존성을 설정합니다.
- **작업 검증**: Worker가 완료한 작업을 반드시 검토합니다.

## 출력 가이드

[assets/templates/40-output-implementation.md](../assets/templates/40-output-implementation.md) 형식을 따르세요.

출력 파일 위치: `.ai/tasks/<TASK_ID>/40-output-implementation.md`

---

## 완료 처리

### 1. 사용자 확인 (필수)

모든 Team Task가 completed이고 40-output-implementation.md가 작성되었다면 사용자에게 확인합니다:

```
Step 4 체크리스트 완료 확인:
- [x] Agent Team 스폰 및 모든 서브태스크 완료
- [x] 코드가 설계 문서와 일치함
- [x] 단위 테스트 통과
- [x] 40-output-implementation.md 작성 완료
- [x] Team 정리 완료 (shutdown + TeamDelete)

Step 4를 완료 처리할까요?
```

> **사용자 승인 없이 다음 단계로 진행하지 마세요.**

### 2. 승인 후 처리

#### Git 커밋

```bash
git add .ai/tasks/<TASK_ID>/40-output-implementation.md
git commit -m "feat/<TASK_ID>-[AI]: Completed Step 4 implementation summary"
```

#### status.yaml 업데이트

```yaml
current_step: step-5
steps:
  step-4:
    status: completed
  step-5:
    status: pending
```

### 3. 다음 Step 안내

```
Step 4 완료!

새 대화에서 다음 명령어로 Step 5를 시작하세요:
"<TASK_ID> 작업 이어서 진행해줘"
```
