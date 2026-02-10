# 기법별 상세 가이드 및 예시

## 1. 명시성 — 구체적 지시 작성법

### Before/After 패턴

```text
# Before
Create an analytics dashboard

# After
Create an analytics dashboard. Include as many relevant features and interactions
as possible. Go beyond the basics to create a fully-featured implementation.
```

```text
# Before
NEVER use ellipses

# After
Your response will be read aloud by a text-to-speech engine, so never use
ellipses since the text-to-speech engine will not know how to pronounce them.
```

### 구체화 체크리스트

- [ ] 작업 결과의 **용도**가 명시되어 있는가?
- [ ] **대상** (누가 읽는가/사용하는가)이 있는가?
- [ ] 원하는 **출력 형식**이 정확한가? (형식, 분량, 톤)
- [ ] **순차적 단계**로 지시가 제공되는가?
- [ ] 제약 조건의 **이유**가 설명되어 있는가?

### "하지 말라" → "하라" 전환

| Before | After |
|--------|-------|
| "Do not use markdown" | "Compose smoothly flowing prose paragraphs" |
| "Don't be verbose" | "Respond in 2-3 concise sentences" |
| "Never make up facts" | "Only include information from the provided documents. If unsure, say so." |

---

## 2. Few-shot 예시 — 3원칙

### 구조화 패턴

```xml
<example>
<input>The new dashboard is a mess! It takes forever to load.</input>
<output>
Category: UI/UX, Performance
Sentiment: Negative
Priority: High
</output>
</example>
```

### 3원칙

| 원칙 | 설명 | 예시 |
|------|------|------|
| **관련성** | 실제 유스케이스를 반영 | 실제 고객 피드백 사용 |
| **다양성** | 엣지 케이스 포함 | 긍정/부정/혼합 감정 모두 |
| **명확성** | `<example>` 태그로 구조화 | 입력/출력 명확히 분리 |

### 예시 수에 따른 효과

| 조건 | 성능 향상 |
|------|----------|
| Zero-shot (예시 없음) | 기준선 |
| One-shot (예시 1개) | +32.4% |
| Few-shot (예시 3개) | +50% |

---

## 3. Chain-of-Thought — 3단계 적용

### 적용 기준

- **적용**: 수학, 논리 추론, 복잡한 분석, 다단계 의사결정
- **불필요**: 단순 변환, 형식 지정, 정보 추출

### 3단계 예시

```text
# Level 1: 기본
Think step-by-step before you write the email.

# Level 2: 가이드
Think before you write. First, consider what messaging would appeal to this
donor given their history. Then, identify which program aspects would resonate.
Finally, write the personalized email.

# Level 3: 구조화 (가장 강력)
Think before you write in <thinking> tags. First, analyze the donor's history.
Then, match program aspects. Finally, write the email in <email> tags.
```

---

## 4. XML 태그 구조화 — 모범 사례

### 일반적인 태그 구조

```xml
<context>
[작업에 필요한 배경 정보]
</context>

<instructions>
1. [첫 번째 단계]
2. [두 번째 단계]
</instructions>

<constraints>
- [제약 조건 1]
- [제약 조건 2]
</constraints>

<output_format>
[원하는 출력 형식 설명 또는 예시]
</output_format>
```

### 여러 문서 제공 시

```xml
<documents>
  <document index="1">
    <source>annual_report_2023.pdf</source>
    <document_content>{{ANNUAL_REPORT}}</document_content>
  </document>
  <document index="2">
    <source>competitor_analysis.xlsx</source>
    <document_content>{{COMPETITOR_ANALYSIS}}</document_content>
  </document>
</documents>

Analyze the annual report and competitor analysis. Identify strategic advantages.
```

### 태그명 원칙
- 내용과 의미적으로 일치: `<contract>`, `<instructions>`, `<example>`
- 프롬프트 전체에서 일관된 이름 사용
- 콘텐츠 참조 시 태그명 언급: "Using the contract in `<contract>` tags..."

---

## 5. Context Engineering — 맥락 최적화

### 배치 원칙

```
[긴 문서 / 참조 데이터] ← 상단
[지시사항]
[질문 / 요청] ← 하단
```

이 배치만으로 응답 품질 최대 30% 향상.

### 맥락 양 기준

| 토큰 수 | 정확도 |
|---------|--------|
| ~4,000 | 최적 |
| 4,000~5,500 | 유지 (Claude) |
| 5,500+ | 하락 시작 |

**원칙**: 필요한 맥락은 충분히, 불필요한 정보는 제거.

---

## 6. 환각 방지 — 4가지 기법

### 기법 1: 탈출구 제공

```text
Who is the heaviest hippo? Only answer if you know with certainty.
```

### 기법 2: 증거 먼저 찾기

```xml
<question>What was the subscriber count on May 31, 2020?</question>

Read the document below. In <scratchpad> tags, pull the most relevant quote
and assess if it answers the question. Then write your answer in <answer> tags.

<document>{{DOCUMENT}}</document>
```

### 기법 3: 조사 후 답변 (에이전틱 환경)

```xml
<investigate_before_answering>
Never speculate about code you have not opened. Read relevant files BEFORE
answering. Give grounded, hallucination-free answers.
</investigate_before_answering>
```

### 기법 4: 불확실성 허용

모델에게 "모르겠다"고 답할 수 있는 명시적 권한 부여.

---

## 7. 도구 트리거 조절 (에이전틱 프롬프트)

```text
# 비효과적 (과잉 트리거)
CRITICAL: You MUST use this tool when...

# 효과적
Use this tool when...
```

프론티어 모델은 공격적 지시에 과잉 반응하므로, 자연스러운 조건부 지시를 사용합니다.
