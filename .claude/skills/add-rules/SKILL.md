---
name: add-rules
description: >
  프로젝트에 규칙을 Skill 기반으로 추가하고 기존 규칙을 Skill로 변환합니다.
  규칙 추가, 룰 추가, rule 추가, 새 규칙, 컨벤션 추가,
  스타일 가이드 추가, 가이드라인 추가, 규칙 변환, rule 통합 요청 시 활성화.
---

# Add Rules

레포지토리 구조를 분석하여 Skill 기반 규칙을 적절한 위치에 추가하고, 기존 규칙 파일(.mdc, .cursorrules 등)을 Skill로 변환합니다.

## 핵심 원칙

1. **모호하면 물어본다**: 불명확한 요구사항은 반드시 확인
2. **구조 우선 분석**: 기존 패턴을 파악한 후 결정
3. **사용자 확인 필수**: 추가/수정 전 반드시 승인 요청
4. **Progressive Disclosure 적용**: 규칙도 3단계 로드 원칙 적용
   - Stage 1: description에 트리거 키워드 → 자동 활성화
   - Stage 2: SKILL.md 본문에 핵심 규칙 (<500줄)
   - Stage 3: references/에 상세/예제
5. **Skill 기반 트리거 통합**: description 키워드로 규칙 자동 활성화

## Progressive Disclosure 통합

규칙을 Skill로 추가할 때 3단계 로드 원칙을 적용합니다:

| 단계 | 역할 | 규칙 관점 | 위치 |
|------|------|----------|------|
| Stage 1 | Discovery | 트리거 키워드로 활성화 판단 | frontmatter description |
| Stage 2 | Activation | 핵심 규칙만 (<500줄) | SKILL.md 본문 |
| Stage 3 | Execution | 상세 규칙, 예제, 엣지 케이스 | references/ |

**판단 기준:**
- 매번 참조해야 하는 핵심 규칙 → 본문 (Stage 2)
- 예제 모음, 상세 옵션, 배경 설명 → references/ (Stage 3)
- 실행 스크립트, 분석 도구 → scripts/ (Stage 3)
- 정적 리소스, 템플릿 → assets/ (Stage 3)

## 워크플로우 개요

```
[1. 요청 분석] → [2. 구조 분석] → [3. 통합 패턴 결정] → [4. 사용자 확인] → [5. 규칙 추가]
      │               │                  │                    │                │
      ▼               ▼                  ▼                    ▼                ▼
  대상 디렉토리   scripts/           4가지 패턴 중          제안 검토        패턴별 실행
  + 모호함 확인  analyze-structure.sh   최적 선택           승인/수정
               활용
```

### 1단계: 요청 분석

**대상 스킬 디렉토리를 반드시 먼저 확인합니다.**

레포지토리에 따라 스킬 디렉토리가 다를 수 있습니다:
- 일반 프로젝트: `.claude/skills/` (프로젝트 자체의 스킬)
- 스킬 라이브러리 레포: `skills/` (배포용 스킬 모음)
- 기타 커스텀 경로

```markdown
규칙을 추가할 **대상 스킬 디렉토리**를 확인합니다:

- 이 프로젝트에서 실제 사용되는 스킬 디렉토리는 어디인가요?
  - 예: `.claude/skills/`, `skills/`, 기타 경로
- (라이브러리 레포인 경우) 배포용 스킬과 프로젝트 자체 스킬을 구분해야 하나요?
```

이후 추가 확인:

| 확인 항목 | 질문 예시 |
|----------|----------|
| 규칙의 목적 | "이 규칙은 어떤 문제를 해결하나요?" |
| 적용 범위 | "특정 파일/디렉토리에만 적용되나요?" |
| 트리거 조건 | "언제 이 규칙이 활성화되어야 하나요?" |
| 기존 규칙 충돌 | "비슷한 기존 규칙이 있나요?" |

### 2단계: 구조 분석

사용자가 지정한 스킬 디렉토리를 인자로 전달하여 분석합니다:

```bash
bash skills/add-rules/scripts/analyze-structure.sh {skills_dir}
# 예: bash skills/add-rules/scripts/analyze-structure.sh .claude/skills
# 예: bash skills/add-rules/scripts/analyze-structure.sh skills
```

### 3단계: 통합 패턴 결정 (4가지 패턴 중 선택)

### 4단계: 사용자 확인 (제안서 작성 → 승인)

### 5단계: 규칙 추가 (패턴별 실행)

상세 워크플로우는 [references/workflow.md](references/workflow.md) 참조.

## 4가지 통합 패턴

| 패턴 | 설명 | user-invocable | 사용 시점 |
|------|------|----------------|----------|
| **A. 독립 Rule-Skill** | 새 skill 디렉토리 생성 | `false` (자동 적용) | 새로운 독립 도메인 규칙 |
| **B. 임베디드 Rules** | `assets/rules/` 패턴 | N/A (호스트 skill 따름) | 기존 워크플로우에 규칙 포함 |
| **C. 기존 Skill 확장** | 기존 skill에 섹션/ref 추가 | 기존 설정 유지 | 기존 skill과 80%+ 관련 |
| **D. Rule 변환** | 기존 rule 파일 → Skill 변환 | 소스에 따라 결정 | .mdc, .cursorrules 등 변환 |

### 패턴 A: 독립 Rule-Skill

새로운 독립 도메인의 규칙을 별도 skill로 생성합니다.

```
{skills_dir}/{rule-name}/
├── SKILL.md              # user-invocable: false (자동 적용)
└── references/           # 필요시
    └── detail.md
```

- `user-invocable: false`로 설정하여 자동 적용
- description에 트리거 키워드 포함 필수

### 패턴 B: 임베디드 Rules (assets/rules/)

feature-workflow 방식으로 호스트 skill의 `assets/rules/`에 규칙을 임베딩합니다.

```
{skills_dir}/{host-skill}/
├── SKILL.md              # "규칙 로드" 섹션에서 참조
└── assets/
    └── rules/
        ├── AGENTS.md     # 규칙 인덱스
        ├── MUST/         # 필수 규칙
        │   └── core-rule.md
        └── domain/       # 도메인 규칙
            └── specific-rule.md
```

### 패턴 C: 기존 Skill 확장

기존 skill에 규칙 섹션이나 references 파일을 추가합니다.

- 500줄 미만 시: SKILL.md에 직접 섹션 추가
- 500줄 초과 예상 시: references/ 파일로 분리
- 기존 description에 트리거 키워드 추가

### 패턴 D: Rule 변환

기존 rule 파일(.mdc, .cursorrules, rules/*.md)을 Skill로 변환합니다.

| 소스 | 위치 | 변환 대상 |
|------|------|----------|
| Claude rules | `.claude/rules/*.md` | Skill frontmatter + body |
| Cursor rules | `.cursorrules`, `*.mdc` | Skill로 재구조화 |
| 프로젝트 rules | `rules/*.md` | 적합한 패턴(A/B/C)으로 변환 |

상세는 [references/conversion.md](references/conversion.md) 참조.

## 패턴 선택 판단 기준

```
새 독립 도메인?                          → 패턴 A (독립 Rule-Skill)
기존 워크플로우에 규칙 포함 필요?         → 패턴 B (임베디드)
기존 skill과 80%+ 관련?                  → 패턴 C (기존 확장)
기존 rule 파일 변환?                     → 패턴 D (변환)
```

**점수 기반 세부 판단 (패턴 A vs C):**

| 기준 | 점수 |
|------|------|
| 동일 도메인의 기존 skill 존재 | +3 |
| 유사 트리거 조건 | +2 |
| 동일 적용 범위 | +2 |
| 기존 skill 500줄 미만 | +1 |
| description에 자연스럽게 언급 가능 | +1 |

**총점 5점 이상 → 패턴 C (기존 확장) 권장, 미만 → 패턴 A (독립 생성)**

상세는 [references/patterns.md](references/patterns.md) 참조.

## 트리거 설계

### 자동 적용 vs 명시적 호출

| 규칙 유형 | user-invocable | description 예시 |
|----------|----------------|-----------------|
| 코딩 컨벤션 | `false` | "TypeScript 코딩 컨벤션. 코드 작성, 리뷰 시 자동 적용." |
| 스타일 가이드 | `false` | "React 컴포넌트 스타일 가이드. 컴포넌트 생성 시 자동 적용." |
| 작업 지침 | `true` (기본) | "코드 리뷰 체크리스트. 리뷰 요청 시 활성화." |
| 체크리스트 | `true` (기본) | "배포 전 체크리스트. 배포, deploy 요청 시 사용." |

### 좋은/나쁜 트리거 예시

```yaml
# 좋은 description: 구체적 키워드 + 상황
description: >
  TypeScript 네이밍 컨벤션. 변수명, 함수명, 클래스명 작성 시 자동 적용.
  TypeScript, 네이밍, naming convention 관련 작업 시 활성화.

# 나쁜 description: 모호하고 광범위
description: >
  코드 품질을 높이는 규칙입니다.
```

## 검증

규칙 추가 완료 후 확인:

```
[ ] name이 1-64자, 소문자/숫자/하이픈만 사용하는가?
[ ] name이 디렉토리명과 일치하는가?
[ ] description이 무엇+언제를 명확히 설명하는가?
[ ] 트리거 키워드가 포함되어 있는가?
[ ] SKILL.md가 500줄 이하인가?
[ ] 상세 내용이 references/로 분리되었는가?
[ ] 파일 참조가 상대 경로, 1단계 깊이인가?
[ ] 기존 규칙과 충돌이 없는가?
[ ] 사용자 승인을 받았는가?
[ ] Progressive Disclosure 단계별 분리가 적절한가?
```

create-skill의 상세 검증은 [create-skill/references/validation.md](../create-skill/references/validation.md) 참조.

## 완료 보고

```markdown
## 규칙 추가 완료

- **이름**: {name}
- **패턴**: A/B/C/D
- **경로**: {skills_dir}/{name}/ 또는 기존 skill 경로

### 생성/수정된 파일
| 파일 | 역할 | 줄 수 |
|------|------|-------|
| ... | ... | ... |

### 사용 방법
- 자동 적용: {조건}
- 수동 호출: `/{name}` (user-invocable인 경우)

### 검증 결과
[체크리스트 통과 여부]
```

## 상세 가이드

- [상세 워크플로우](references/workflow.md)
- [통합 패턴 상세](references/patterns.md)
- [기존 규칙 변환](references/conversion.md)
- [템플릿 모음](references/templates.md)
