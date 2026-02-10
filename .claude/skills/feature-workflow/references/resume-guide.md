# 작업 재개 가이드

> 사용자가 TASK_ID를 언급하거나 "작업 이어서" 요청 시 이 절차를 따릅니다.

---

## 진입 조건

다음 패턴으로 재개 요청을 인식합니다:

- **TASK_ID 패턴**: `XXXX-NNN` 형식 (예: TASK-001, AI-TOOLKIT-001, PROJ-001)
- **키워드**: 작업 이어서, 작업 계속, 다음 단계, resume, continue, proceed
- **경로 참조**: `.ai/tasks/<TASK_ID>/` 경로 언급

---

## 재개 절차

### 1. status.yaml 읽기

```bash
cat .ai/tasks/<TASK_ID>/status.yaml
```

### 2. 현재 상태 파악

| 필드 | 설명 |
|------|------|
| `current_step` | 현재 진행 중인 Step |
| `steps.<step-N>.status` | 각 Step의 상태 (`pending` / `in_progress` / `completed`) |

### 3. 규칙 로드

1. [assets/rules/AGENTS.md](../assets/rules/AGENTS.md) 읽기
2. 해당 Step의 필수 규칙 로드 (`MUST/workflow-rule.md`)
3. 도메인 규칙 동적 로드

### 4. 다음 동작 결정

| 현재 Step status | 동작 |
|-----------------|------|
| `pending` | 해당 Step 시작 |
| `in_progress` | 이전 출력 파일 확인 후 계속 진행 |
| `completed` | 다음 Step으로 이동 |

### 5. 사용자에게 안내

```
현재 상태: Step X ({status})
완료된 Step: Step 1, Step 2, ...
다음 Step: Step Y

Step Y를 시작하시겠습니까?
```

---

## 수동 재개 명령어 예시

```
"<TASK_ID> 작업 이어서 진행해줘"
"<TASK_ID> Step 2 시작"
"<TASK_ID> 다음 단계 계속"
```

---

## 진행 상태 확인

```bash
./scripts/task.sh status <TASK_ID>
./scripts/task.sh list
```
