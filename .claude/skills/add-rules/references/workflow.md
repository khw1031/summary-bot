# Add Rules 상세 워크플로우

## 1단계: 요청 분석

### 대상 스킬 디렉토리 확인 (최우선)

**규칙 내용을 묻기 전에 대상 스킬 디렉토리를 반드시 먼저 확인합니다.**

레포지토리마다 스킬 디렉토리가 다릅니다:

| 레포 유형 | 스킬 디렉토리 | 설명 |
|----------|-------------|------|
| 일반 프로젝트 | `.claude/skills/` | 프로젝트 자체에서 사용하는 스킬 |
| 스킬 라이브러리 | `skills/` | 배포용 스킬 모음 (타 프로젝트에 제공) |
| 모노레포 | `packages/{pkg}/.claude/skills/` | 패키지별 스킬 |
| 커스텀 | 사용자 지정 경로 | 프로젝트 컨벤션에 따름 |

**주의:** 스킬 라이브러리 레포에서 `skills/`는 배포용 라이브러리이므로, 해당 레포 자체의 규칙을 추가할 때는 `.claude/skills/`가 대상일 수 있습니다. 반드시 사용자에게 확인하세요.

```markdown
규칙을 추가하기 전에 확인이 필요합니다:

1. **대상 스킬 디렉토리**: 규칙을 추가할 스킬 디렉토리는 어디인가요?
   - `.claude/skills/` (이 프로젝트 자체의 스킬)
   - `skills/` (배포용 라이브러리 스킬)
   - 기타: ___
```

이후 워크플로우 전체에서 사용자가 지정한 디렉토리를 `{skills_dir}`로 사용합니다.

### 명확화 질문 템플릿

```markdown
규칙 추가 요청을 이해했습니다. 몇 가지 확인이 필요합니다:

1. **목적**: 이 규칙이 해결하려는 문제는 무엇인가요?
2. **범위**: 모든 파일에 적용되나요, 특정 패턴(예: *.ts, src/**)에만 적용되나요?
3. **트리거**: 언제 이 규칙이 활성화되어야 하나요?
   - 항상 자동으로?
   - 특정 작업(코드 리뷰, 새 파일 생성) 시?
   - 명시적 호출 시에만?
4. **예외**: 규칙이 적용되지 않아야 하는 경우가 있나요?
5. **예시**: 규칙 적용 전/후 예시를 보여주실 수 있나요?
```

### 요청 유형 분류

| 유형 | 특징 | 처리 방법 |
|------|------|----------|
| 명확한 규칙 | 내용, 범위, 트리거 명확 | 바로 구조 분석 |
| 부분 명확 | 일부 정보 누락 | 누락 부분만 질문 |
| 모호한 요청 | "좋은 코드 규칙 추가해줘" | 전체 명확화 필요 |
| 규칙 변환 | 기존 rule 파일 지정 | 소스 분석 후 패턴 D |

## 2단계: 구조 분석

### 자동 분석 실행

1단계에서 확인한 `{skills_dir}`를 인자로 전달합니다:

```bash
bash skills/add-rules/scripts/analyze-structure.sh {skills_dir}
# 예: bash skills/add-rules/scripts/analyze-structure.sh .claude/skills
# 예: bash skills/add-rules/scripts/analyze-structure.sh skills
```

스크립트가 없거나 실행 불가 시 수동으로 분석:

```bash
# 대상 스킬 디렉토리 확인 (사용자 지정 경로)
ls -la {skills_dir}/

# 기존 rules 확인
ls -la rules/ 2>/dev/null
ls -la .claude/rules/ 2>/dev/null

# 기타 규칙 파일
find . -name ".cursorrules" -o -name "*.mdc" 2>/dev/null
```

### 분석 결과 보고

```markdown
## 현재 구조 분석 결과

- **대상 스킬 디렉토리**: `{skills_dir}/`
- **Skills**: X개 존재
  - {skill-1}: {description 요약}
  - {skill-2}: {description 요약}
- **Rules**: Y개 존재
  - {경로}: {설명}
- **assets/rules 패턴**: 사용 중 / 미사용
- **관련 기존 규칙**: {있으면 나열}
- **기존 패턴 특징**: {naming, references 사용 등}
```

### 패턴 분석 체크포인트

```
[ ] 대상 스킬 디렉토리 존재 여부
[ ] 기존 skill의 naming convention
[ ] references/ 사용 패턴
[ ] user-invocable 설정 패턴
[ ] description 작성 스타일
[ ] assets/rules/ 패턴 사용 여부
[ ] 규칙 간 계층 구조 (있는 경우)
```

## 3단계: 통합 패턴 결정

### 의사결정 트리

```
[규칙 내용 분석]
       │
       ├─ 기존 rule 파일(.mdc, .cursorrules) 변환? ──→ 패턴 D (Rule 변환)
       │                                                  │
       │                                                  └─→ 변환 후 A/B/C 중 선택
       │
       ├─ 기존 워크플로우 skill에 규칙 포함 필요? ──────→ 패턴 B (임베디드)
       │     (feature-workflow처럼 Step별 규칙 로드)
       │
       ├─ 기존 skill과 80% 이상 관련? ──────────────→ 패턴 C (기존 확장)
       │     (점수 기반 판단: 5점 이상)                     │
       │                                              ├─ 500줄 이하? → 직접 추가
       │                                              └─ 500줄 초과? → references/ 분리
       │
       └─ 새로운 독립 도메인? ──────────────────────→ 패턴 A (독립 Rule-Skill)
             (기존 skill과 관련 없는 독립 규칙)
```

### 점수 기반 판단 기준 (패턴 A vs C)

| 기준 | 점수 | 설명 |
|------|------|------|
| 동일 도메인의 기존 skill 존재 | +3 | 같은 주제/기술 영역 |
| 유사 트리거 조건 | +2 | 비슷한 상황에서 활성화 |
| 동일 적용 범위 | +2 | 같은 파일/디렉토리 대상 |
| 기존 skill 500줄 미만 | +1 | 추가 여유 있음 |
| description에 자연스럽게 언급 가능 | +1 | 트리거가 자연스러움 |

**총점 5점 이상: 패턴 C (기존 확장) 권장**
**총점 5점 미만: 패턴 A (독립 생성) 권장**

### 패턴별 세부 판단 조건

**패턴 A 선택 조건:**
- 기존 skill과 관련 없는 새 도메인
- 독립적으로 활성화/비활성화 필요
- 별도 트리거 키워드 세트 필요

**패턴 B 선택 조건:**
- 워크플로우 skill에 Step별 규칙 적용 필요
- 규칙이 여러 개이며 동적 로딩 필요
- AGENTS.md 인덱스 패턴이 적합

**패턴 C 선택 조건:**
- 기존 skill과 80%+ 도메인 일치
- 트리거 조건이 유사
- 기존 skill에 자연스럽게 통합 가능

**패턴 D 선택 조건:**
- 사용자가 기존 rule 파일 변환을 요청
- .mdc, .cursorrules, rules/*.md 파일 존재
- 기존 규칙을 Skill 체계로 마이그레이션

## 4단계: 사용자 확인

**반드시 다음 형식으로 제안하고 승인을 받습니다.**

### 제안서 템플릿 (패턴 A: 독립 생성)

```markdown
## 규칙 추가 제안

### 요청 분석
- **요청 내용**: {user_request}
- **해석**: {interpreted_meaning}

### 규칙 정보
- **이름**: {rule_name}
- **목적**: {purpose}
- **트리거 조건**: {trigger_conditions}
- **적용 범위**: {scope}

### 위치 결정
- **패턴**: A (독립 Rule-Skill)
- **경로**: `{skills_dir}/{name}/`
- **판단 근거**: {reasons}

### 생성될 파일 구조

```
{skills_dir}/{name}/
├── SKILL.md              # user-invocable: false
└── references/           # 필요시
    └── detail.md
```

### SKILL.md 미리보기

```yaml
---
name: {name}
description: >
  {description_with_triggers}
user-invocable: false
---

# {Title}

{content_preview}
```

---

이대로 진행할까요? (Y / N / 수정 요청)
```

### 제안서 템플릿 (패턴 B: 임베디드)

```markdown
## 규칙 추가 제안

### 요청 분석
- **요청 내용**: {user_request}

### 규칙 정보
- **이름**: {rule_name}
- **목적**: {purpose}

### 위치 결정
- **패턴**: B (임베디드 Rules)
- **호스트 Skill**: `{skills_dir}/{host_skill}/`
- **경로**: `{skills_dir}/{host_skill}/assets/rules/{domain}/`

### 변경 내용

1. `assets/rules/{domain}/{rule_name}.md` 생성
2. `assets/rules/AGENTS.md` 인덱스에 추가
3. SKILL.md "규칙 로드" 섹션에서 참조

---

이대로 진행할까요? (Y / N / 수정 요청)
```

### 제안서 템플릿 (패턴 C: 기존 확장)

```markdown
## 규칙 추가 제안

### 요청 분석
- **요청 내용**: {user_request}

### 규칙 정보
- **이름**: {rule_name}
- **목적**: {purpose}

### 위치 결정
- **패턴**: C (기존 Skill 확장)
- **대상**: `{skills_dir}/{existing_skill}/SKILL.md`
- **판단 근거**: 점수 {N}/9 (기존 확장 권장)

### 변경 미리보기

**현재 상태** (일부):
```
{existing_content_excerpt}
```

**변경 후**:
```
{new_content_preview}
```

### 영향 분석
- 기존 기능 영향: 없음 / 있음 (설명)
- 줄 수 변화: {before}줄 → {after}줄

---

이대로 진행할까요? (Y / N / 수정 요청)
```

### 제안서 템플릿 (패턴 D: Rule 변환)

```markdown
## 규칙 변환 제안

### 소스 분석
- **소스 파일**: {source_path}
- **형식**: {.mdc / .cursorrules / rules/*.md}
- **내용 요약**: {content_summary}

### 변환 계획
- **대상 패턴**: A / B / C
- **경로**: {target_path}
- **변환 매핑**: {mapping_summary}

### 변환 전후 비교

**변환 전** ({source_path}):
```
{source_excerpt}
```

**변환 후** ({target_path}):
```
{converted_preview}
```

---

이대로 진행할까요? (Y / N / 수정 요청)
```

## 5단계: 규칙 추가

### 패턴 A 실행 절차

```bash
# 1. 디렉토리 생성
mkdir -p {skills_dir}/{name}/references

# 2. SKILL.md 생성
# → frontmatter + 핵심 규칙 본문 (<500줄)

# 3. references/ 생성 (필요시)
# → 상세 규칙, 예제 등

# 4. 검증
wc -l {skills_dir}/{name}/SKILL.md  # 500줄 미만 확인
```

### 패턴 B 실행 절차

```bash
# 1. assets/rules/ 구조 생성
mkdir -p {skills_dir}/{host}/assets/rules/MUST
mkdir -p {skills_dir}/{host}/assets/rules/{domain}

# 2. AGENTS.md 인덱스 생성/수정
# → 규칙 인덱스 작성

# 3. 규칙 파일 생성
# → MUST/ 또는 domain/ 에 규칙 작성

# 4. 호스트 SKILL.md에 규칙 로드 섹션 추가/수정
```

### 패턴 C 실행 절차

```bash
# 1. 현재 상태 확인
wc -l {skills_dir}/{name}/SKILL.md

# 2-A. 500줄 이하면 직접 추가
# → 적절한 섹션에 내용 추가

# 2-B. 500줄 초과 예상시 references/ 분리
# → references/{new_rule}.md 생성
# → SKILL.md에 링크 추가

# 3. description에 트리거 키워드 추가 (필요시)
```

### 패턴 D 실행 절차

상세는 [conversion.md](conversion.md) 참조.

```bash
# 1. 소스 규칙 읽기 및 분석
# 2. 목적/범위/트리거 추출
# 3. 적합한 패턴(A/B/C) 결정
# 4. 해당 패턴의 실행 절차 수행
# 5. 원본 파일 처리 (보존/삭제 사용자 결정)
```

## 완료 보고

```markdown
## 규칙 추가 완료

### 결과 요약
- **이름**: {name}
- **패턴**: {A/B/C/D}
- **경로**: {path}

### 생성/수정된 파일
| 파일 | 역할 | 줄 수 |
|------|------|-------|
| {file} | {role} | {lines} |

### 사용 방법
- **자동 적용** (user-invocable: false):
  - 트리거: {조건}
  - 활성화: {키워드} 관련 작업 시 자동
- **수동 호출** (user-invocable: true):
  - 명령어: `/{name}`

### 검증 결과
```
[x] name 규칙 준수 (1-64자, 소문자/숫자/하이픈)
[x] description 무엇+언제 명확
[x] 트리거 키워드 포함
[x] SKILL.md 500줄 이하
[x] Progressive Disclosure 적절
[x] 기존 규칙 충돌 없음
[x] 사용자 승인 완료
```
```

## 롤백 절차

문제 발생 시:

```bash
# Git으로 롤백
git checkout -- {skills_dir}/{name}/

# 새로 생성한 skill 전체 삭제
rm -rf {skills_dir}/{name}/
```
