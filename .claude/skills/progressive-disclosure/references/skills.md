# Skills에 Progressive Disclosure 적용

> agentskills.io 명세 기반 스킬 작성 가이드

---

## 1. 디렉토리 구조

```
skill-name/
├── SKILL.md           # 필수 - 2단계 지침
├── scripts/           # 선택 - 3단계 실행 코드
├── references/        # 선택 - 3단계 상세 문서
└── assets/            # 선택 - 3단계 정적 자산
```

---

## 2. 단계별 내용

### 1단계: 메타데이터 (~100 토큰)

YAML frontmatter의 `name`과 `description` 필드. 에이전트 시작 시 모든 스킬에서 로드됩니다.

```yaml
---
name: pdf-processing
description: >
  PDF 파일에서 텍스트/테이블 추출, 폼 작성, 문서 병합.
  PDF 관련 작업 요청 시 사용.
---
```

### 2단계: 지침 (<5000 토큰)

SKILL.md 본문. 스킬 활성화 시 전체 로드됩니다.

**권장 섹션:**
- 단계별 사용 방법
- 입력/출력 예제
- 주요 엣지 케이스

### 3단계: 리소스 (온디맨드)

필요할 때만 로드되는 보조 파일들:

| 디렉토리 | 용도 | 예시 |
|---------|------|------|
| `scripts/` | 실행 가능한 코드 | `extract.py`, `merge.sh` |
| `references/` | 추가 문서 | `REFERENCE.md`, `FORMS.md` |
| `assets/` | 정적 자산 | 템플릿, 이미지, 스키마 |

---

## 3. Frontmatter 스키마

### [CRITICAL] name 필드

| 항목 | 규칙 |
|------|------|
| 길이 | 1-64자 |
| 허용 | 소문자, 숫자, 하이픈(`-`) |
| 금지 | 대문자, 시작/끝 하이픈, 연속 하이픈, 언더스코어 |
| 일치 | 디렉토리명과 동일해야 함 |

**Incorrect:**
```yaml
name: PDF-Processing    # 대문자 불가
name: -pdf              # 하이픈으로 시작 불가
name: pdf--processing   # 연속 하이픈 불가
name: pdf_processing    # 언더스코어 불가
```

**Correct:**
```yaml
name: pdf-processing
name: data-analysis
name: code-review
```

### [CRITICAL] description 필드

- 1-1024자
- **무엇**을 하는지 + **언제** 사용하는지 명시
- 트리거 키워드 포함

**Incorrect:**
```yaml
description: 코드 리뷰 규칙
description: PDF 관련 작업을 도와줍니다.
```

**Correct:**
```yaml
description: >
  코드 리뷰 시 적용되는 품질 기준.
  PR 리뷰, 코드 검토, 품질 점검 요청 시 활성화.

description: >
  PDF 파일에서 텍스트와 테이블을 추출하고, 폼을 작성하며,
  여러 PDF를 병합합니다. PDF 문서 작업이나 사용자가 PDF,
  폼, 문서 추출을 언급할 때 사용하세요.
```

### [MEDIUM] 선택 필드

| 필드 | 용도 |
|------|------|
| `license` | 라이선스명 또는 라이선스 파일 참조 |
| `compatibility` | 환경 요구사항 (1-500자) |
| `metadata` | 임의의 키-값 매핑 |
| `allowed-tools` | 사전 승인된 도구 목록 (실험적) |

---

## 4. Rule → Skill 변환

### [HIGH] Rule 대신 Skill 사용

| 의도 | Skill 설정 |
|------|-----------|
| 자동 적용 | `user-invocable: false` |
| 조건부 트리거 | description에 트리거 조건 명시 |
| 부작용 있는 작업 | `disable-model-invocation: true` |

**Incorrect (Rule 방식):**
```yaml
# rules/code-style.md
---
description: 코드 스타일 규칙
paths:
  - "**/*.ts"
---
```

**Correct (Skill 방식):**
```yaml
# skills/code-style/SKILL.md
---
name: code-style
description: >
  TypeScript 코드 작성 시 적용되는 스타일 가이드.
  코드 작성, 리뷰, 리팩토링 시 자동 참조.
user-invocable: false
---
```

---

## 5. 파일 참조 규칙

### [HIGH] 참조 경로 깊이

SKILL.md에서 다른 파일 참조 시 상대 경로 사용:

**Incorrect:**
```markdown
[문서](references/sub/deep/nested/doc.md)
[스크립트](/absolute/path/script.py)
```

**Correct:**
```markdown
[레퍼런스 가이드](references/REFERENCE.md)
[추출 스크립트](scripts/extract.py)
```

**핵심 규칙:**
- 참조 경로는 1단계 깊이 유지
- 깊은 중첩 참조 체인 피하기
- 개별 참조 파일은 집중된 내용으로 유지

---

## 6. 작성 가이드라인

### [HIGH] 본문 크기 제한

- **500줄 이하** 유지
- 상세 레퍼런스는 별도 파일로 분리
- 에이전트가 활성화 시 전체 본문을 로드하므로 간결하게

**Incorrect:**
```
skill-name/
└── SKILL.md  # 1000줄 이상, 모든 예제와 문서 포함
```

**Correct:**
```
skill-name/
├── SKILL.md           # <500줄, 핵심만
├── references/
│   ├── REFERENCE.md   # 상세 문서
│   └── EXAMPLES.md    # 예제 모음
└── scripts/
    └── main.py
```

### [MEDIUM] scripts/ 디렉토리

- 자체 완결형이거나 의존성을 명확히 문서화
- 유용한 에러 메시지 포함
- 엣지 케이스를 우아하게 처리

### [LOW] references/ 디렉토리

- 개별 파일을 집중된 주제로 유지
- 에이전트가 온디맨드로 로드하므로 작은 파일이 효율적
- 예: `REFERENCE.md`, `FORMS.md`, `finance.md`

---

## 7. 검증 체크리스트

스킬 작성 시 확인:

```
□ [CRITICAL] name이 1-64자, 소문자/숫자/하이픈만 사용하는가?
□ [CRITICAL] name이 디렉토리명과 일치하는가?
□ [CRITICAL] description이 무엇+언제를 명확히 설명하는가?
□ [HIGH] SKILL.md 본문이 500줄 이하인가?
□ [HIGH] 상세 내용이 references/로 분리되었는가?
□ [MEDIUM] scripts/가 자체 완결형이거나 의존성이 문서화되었는가?
□ [MEDIUM] 파일 참조가 1단계 깊이인가?
```

---

## 8. 예제: 완전한 스킬 구조

```
pdf-processing/
├── SKILL.md
├── scripts/
│   ├── extract.py
│   └── merge.sh
├── references/
│   ├── REFERENCE.md
│   └── FORMS.md
└── assets/
    └── form-template.pdf
```

**SKILL.md 예제:**

```yaml
---
name: pdf-processing
description: >
  PDF 파일에서 텍스트/테이블 추출, 폼 작성, 문서 병합.
  PDF 관련 작업 요청 시 사용.
license: Apache-2.0
metadata:
  author: example-org
  version: "1.0"
---

# PDF Processing

PDF 문서 작업을 위한 스킬입니다.

## 사용 방법

1. 추출: `scripts/extract.py <input.pdf>`
2. 병합: `scripts/merge.sh <file1.pdf> <file2.pdf>`

## 상세 정보

- [기술 레퍼런스](references/REFERENCE.md)
- [폼 템플릿 가이드](references/FORMS.md)
```
