# 규칙 인덱스

> 워크플로우 실행 중 필요한 규칙을 동적으로 로드하기 위한 인덱스입니다.

---

## 규칙 로드 절차

### 1. 필수 규칙 (항상 로드)

워크플로우 시작 시 **반드시** 다음 규칙을 로드하세요:

```
MUST/AGENTS.md → MUST/workflow-rule.md
```

| 디렉토리 | 설명                      | 로드 시점               |
| -------- | ------------------------- | ----------------------- |
| `MUST/`  | 워크플로우 실행 필수 규칙 | **항상** (Step 시작 시) |

### 2. 도메인 규칙 (동적 로드)

작업 중 해당 컨텍스트를 만나면 규칙을 로드하세요:

| 키워드/컨텍스트                          | 디렉토리      | 로드 시점      |
| ---------------------------------------- | ------------- | -------------- |
| React, 컴포넌트, JSX, TSX, hooks         | `react/`      | 계획/구현/리뷰 |
| 테스트, test, spec, TDD, Given-When-Then | `testing/`    | 테스트 작성    |
| API, endpoint, fetch, axios, REST        | `api/`        | API 작업       |
| 타입, interface, type, generic           | `typescript/` | 타입 정의      |
| 상태관리, state, store, reducer          | `state/`      | 상태 설계/구현 |
| 스타일, CSS, styled, tailwind            | `styling/`    | UI 스타일링    |

> 디렉토리가 존재하지 않으면 건너뛰세요. 규칙은 점진적으로 추가됩니다.

---

## 탐색 방법

```
1. 현재 작업에서 키워드 식별
2. 해당 디렉토리의 AGENTS.md 읽기 (1단계 - 개요)
3. 필요한 상세 규칙 파일 로드 (2단계 - 상세)
```

### 예시: React 컴포넌트 구현 시

```
1. 키워드 식별: "React 컴포넌트"
2. react/AGENTS.md 읽기
3. react/component.md 로드 (필요시)
4. react/hooks.md 로드 (hooks 사용 시)
```

---

## 규칙 구조

```
assets/rules/
├── AGENTS.md              ← 현재 파일 (규칙 인덱스)
├── MUST/                  ← 필수 규칙 (항상 로드)
│   ├── AGENTS.md
│   └── workflow-rule.md
├── react/                 ← React 규칙 (동적 로드)
│   ├── AGENTS.md
│   └── *.md
├── testing/               ← 테스트 규칙 (동적 로드)
│   ├── AGENTS.md
│   └── *.md
└── [domain]/              ← 기타 도메인 규칙
    ├── AGENTS.md
    └── *.md
```

---

## 빠른 참조

### Step 시작 시 체크리스트

```
□ MUST/workflow-rule.md 로드함
□ 현재 작업 컨텍스트의 도메인 규칙 확인함
□ 필요한 도메인 규칙 로드함
```

### 새 규칙 추가 시

1. 해당 도메인 디렉토리 생성 (없으면)
2. `AGENTS.md` 작성 (1단계 - 개요, 키워드)
3. 상세 규칙 파일 작성 (2단계)
4. 이 파일의 "키워드 → 규칙 매핑" 테이블에 추가
