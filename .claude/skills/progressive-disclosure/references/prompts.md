# Prompts에 Progressive Disclosure 적용

> 시스템 프롬프트 및 지침 구조화 가이드 (Anthropic 공식 권장 기반)

---

## 1. 프롬프트에 Progressive Disclosure가 필요한 이유

Claude Code의 시스템 프롬프트는 이미 **~50개 지침**을 포함합니다.
CLAUDE.md나 추가 지침은 **보편적으로 적용 가능한 최소한**으로 유지해야 합니다.

> "All else being equal, an LLM will perform better on a task when its context window
> is full of focused, relevant context including examples, related files, tool calls,
> and tool results compared to when its context window has a lot of irrelevant context."

---

## 2. 단계별 구조

### 1단계: 역할과 목적 (~100 토큰)

프롬프트 시작 부분에 역할과 고수준 설명을 1-2문장으로 정의합니다.

```text
당신은 시니어 코드 리뷰어로, 코드 품질과 보안을 검토합니다.
```

또는 XML 태그 사용:

```xml
<role>
시니어 코드 리뷰어. 코드 품질, 보안, 모범 사례를 검토합니다.
</role>
```

### 2단계: 핵심 지침 (<5000 토큰)

태스크별 핵심 규칙과 동작 지침을 포함합니다.

**권장 섹션:**
- 구체적인 수행 단계
- 출력 형식 요구사항
- 제약 조건

```xml
<instructions>
코드 리뷰 시:
1. git diff로 변경 사항 확인
2. 수정된 파일에 집중
3. 우선순위별로 피드백 정리

출력 형식:
- 치명적 이슈 (반드시 수정)
- 경고 (수정 권장)
- 제안 (개선 고려)
</instructions>
```

### 3단계: 리소스 (온디맨드)

필요할 때만 참조하는 상세 자료:

| 유형 | 예시 |
|------|------|
| 예제 | few-shot 예제, 입출력 샘플 |
| 참조 문서 | API 명세, 스타일 가이드 |
| 템플릿 | 출력 템플릿, 보고서 형식 |

```xml
<examples>
[필요시에만 로드되는 상세 예제...]
</examples>

<reference>
[상세 API 문서나 스타일 가이드 참조...]
</reference>
```

---

## 3. XML 태그 활용

Anthropic은 프롬프트 섹션을 XML 태그로 구분할 것을 권장합니다.

### 권장 태그 구조

```xml
<role>
[1-2문장 역할 정의]
</role>

<context>
[태스크 배경 정보]
</context>

<instructions>
[핵심 동작 지침]
</instructions>

<output_format>
[출력 형식 요구사항]
</output_format>

<constraints>
[제약 조건 및 금지 사항]
</constraints>

<examples>
[필요시 few-shot 예제]
</examples>
```

### 태그 명명 규칙

- 소문자 스네이크 케이스 사용: `<output_format>`, `<background_information>`
- 의미가 명확한 이름 사용
- 중첩은 1-2단계로 제한

---

## 4. CLAUDE.md 구조화

### 권장 구조

```markdown
# 프로젝트명

> 한 줄 설명 (1단계)

## 핵심 원칙 (2단계)
- 원칙 1
- 원칙 2

## 기술 스택
- [기술 목록]

## 빌드/테스트 명령
- `npm test` - 테스트 실행
- `npm run build` - 빌드

## 상세 문서 (3단계 참조)
- [아키텍처 가이드](docs/ARCHITECTURE.md)
- [코딩 컨벤션](docs/CONVENTIONS.md)
```

### 피해야 할 패턴

```markdown
# 나쁜 예 - 너무 많은 정보

## 모든 명령어 목록
[수십 개의 명령어...]

## 전체 코딩 스타일 가이드
[수백 줄의 스타일 규칙...]

## 모든 API 엔드포인트
[전체 API 문서...]
```

---

## 5. 하위 디렉토리 CLAUDE.md

대규모 코드베이스에서는 하위 디렉토리에 로컬 CLAUDE.md를 배치:

```
project/
├── CLAUDE.md              # 프로젝트 전체 원칙
├── packages/
│   ├── frontend/
│   │   └── CLAUDE.md      # 프론트엔드 특화 규칙
│   └── backend/
│       └── CLAUDE.md      # 백엔드 특화 규칙
└── scripts/
    └── CLAUDE.md          # 스크립트 관련 규칙
```

Claude Code는 작업 중인 파일의 상위 디렉토리에서 CLAUDE.md를 자동 발견합니다.

---

## 6. 프롬프트 작성 원칙

### 명시적으로 작성

Claude 4.x 모델은 명확하고 명시적인 지침에 잘 반응합니다.

```text
# 덜 효과적
분석 대시보드를 만들어줘

# 더 효과적
분석 대시보드를 만들어줘. 관련 기능과 인터랙션을 가능한 많이 포함해.
기본을 넘어서 완전한 기능의 구현을 만들어줘.
```

### 컨텍스트 제공

지침의 이유를 설명하면 Claude가 더 잘 이해합니다.

```text
# 덜 효과적
줄임표를 절대 사용하지 마

# 더 효과적
응답은 TTS 엔진으로 읽힐 예정이므로 줄임표를 사용하지 마세요.
TTS 엔진이 줄임표를 어떻게 발음해야 할지 모르기 때문입니다.
```

### 하지 말라 대신 해라

```text
# 덜 효과적
마크다운을 사용하지 마

# 더 효과적
응답을 자연스럽게 흐르는 산문 문단으로 구성하세요.
```

---

## 7. 긴 프롬프트 구조화

### 섹션 분리

```xml
<background_information>
[태스크 배경 및 도메인 지식]
</background_information>

<task_description>
[구체적인 태스크 설명]
</task_description>

<tool_guidance>
[도구 사용 방법 및 제약]
</tool_guidance>

<output_description>
[기대하는 출력 형식]
</output_description>
```

### 조건부 섹션

특정 조건에서만 적용되는 지침은 분리:

```xml
<when_reviewing_code>
코드 리뷰 시에만 적용되는 규칙...
</when_reviewing_code>

<when_writing_code>
코드 작성 시에만 적용되는 규칙...
</when_writing_code>
```

---

## 8. 예제의 Progressive Disclosure

### 인라인 최소 예제 (2단계)

```xml
<instructions>
JSON 형식으로 응답하세요.

예: {"status": "success", "data": [...]}
</instructions>
```

### 상세 예제 분리 (3단계)

```xml
<instructions>
JSON 형식으로 응답하세요. 상세 예제는 아래 examples 섹션 참조.
</instructions>

<examples>
입력: "사용자 목록을 조회해줘"
출력:
{
  "status": "success",
  "data": [
    {"id": 1, "name": "Alice"},
    {"id": 2, "name": "Bob"}
  ],
  "meta": {
    "total": 2,
    "page": 1
  }
}

입력: "존재하지 않는 사용자 조회"
출력:
{
  "status": "error",
  "error": {
    "code": "NOT_FOUND",
    "message": "사용자를 찾을 수 없습니다"
  }
}
</examples>
```

---

## 9. 시스템 프롬프트 vs 사용자 프롬프트

### 시스템 프롬프트 (고정)

- 역할 정의
- 전역 제약 조건
- 출력 형식 규칙
- 도구 사용 가이드

### 사용자 프롬프트 (동적)

- 구체적인 태스크
- 입력 데이터
- 세션별 컨텍스트

```
시스템 프롬프트 (1-2단계)
├── 역할 정의
├── 핵심 지침
└── 형식 규칙

사용자 프롬프트 (태스크별)
├── 구체적 요청
├── 입력 데이터
└── 추가 컨텍스트 (필요시)
```

---

## 10. 체크리스트

프롬프트 작성 시 확인:

```
□ 역할이 1-2문장으로 명확히 정의되었는가?
□ 핵심 지침이 5000 토큰 이하인가?
□ XML 태그로 섹션이 구분되었는가?
□ 상세 예제가 별도 섹션으로 분리되었는가?
□ "하지 마" 대신 "해라" 형식인가?
□ 지침의 이유가 설명되었는가?
□ 하위 디렉토리 CLAUDE.md로 로컬 규칙이 분리되었는가?
```
