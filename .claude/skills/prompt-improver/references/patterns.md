# 프롬프트 유형별 개선 패턴

## 유형 판별 → 핵심 기법 매핑

| 프롬프트 유형 | 핵심 체크포인트 | 우선 적용 기법 |
|--------------|---------------|--------------|
| **단순 지시** (변환, 포맷팅) | 명시성, 제약조건 | 출력 형식 구체화, XML 태그 |
| **복잡한 추론** (분석, 수학) | 명시성, Few-shot, CoT | 구조화된 CoT, 예시 추가 |
| **정보 추출** (문서 분석) | 명시성, Context, 환각방지 | 맥락 배치 최적화, 증거 먼저 찾기 |
| **창의적 작업** (글쓰기, 기획) | 명시성, 제약조건, (Persona) | 톤/스타일 지정, 예시 제공 |
| **코드 생성** | 명시성, Few-shot, 제약조건 | 입출력 예시, 기술 스택 명시 |
| **에이전틱 시스템 프롬프트** | 전체 | 도구 트리거 조절, 환각 방지, 행동 지시 |

---

## 패턴 1: 단순 지시 개선

### Before
```text
Translate this to Korean.
```

### After
```xml
<instructions>
Translate the following text to Korean. Maintain the original tone and formality
level. For technical terms without established Korean equivalents, keep the
English term and add a Korean explanation in parentheses.
</instructions>

<text>
{{TEXT}}
</text>
```

**적용 기법**: 명시성 (톤 유지, 기술 용어 처리), XML 구조화

---

## 패턴 2: 복잡한 추론 개선

### Before
```text
Analyze this financial data and give recommendations.
```

### After
```xml
<context>
You are analyzing Q3 financial data for a mid-size SaaS company to prepare
an executive summary for the board meeting.
</context>

<data>
{{FINANCIAL_DATA}}
</data>

<instructions>
Analyze the financial data above. In <thinking> tags:
1. Identify revenue trends (QoQ and YoY)
2. Evaluate profit margins against industry benchmarks
3. Flag any anomalies or risks

Then in <report> tags, write the executive summary with these sections:
- Key Metrics (table format)
- Strengths
- Areas of Concern
- Recommended Actions (prioritized)
</instructions>

<example>
<input>Revenue: $2.1M (Q2: $1.9M), Churn: 4.2%</input>
<output>
<thinking>
Revenue grew 10.5% QoQ. Churn at 4.2% is above SaaS median of 3.5%...
</thinking>
<report>
## Key Metrics
| Metric | Q3 | Q2 | Change |
...
</report>
</output>
</example>
```

**적용 기법**: 명시성 (용도, 대상), Context (배경 정보), 구조화된 CoT, Few-shot, XML 태그

---

## 패턴 3: 정보 추출 개선

### Before
```text
What does this contract say about termination?
```

### After
```xml
<contract>
{{CONTRACT_TEXT}}
</contract>

<instructions>
Review the contract above. In <evidence> tags, quote the specific clauses
related to termination (early termination, termination for cause, notice period,
penalties). Then in <summary> tags, summarize the key termination terms in a
structured table.

If any standard termination term is not addressed in the contract, explicitly
note it as "Not specified in this contract."
</instructions>
```

**적용 기법**: Context (문서 상단), 환각 방지 (증거 먼저, 미명시 항목 처리), XML 구조화

---

## 패턴 4: 에이전틱 시스템 프롬프트 개선

### Before
```text
You are an expert code reviewer. ALWAYS review code thoroughly. You MUST find
all bugs. NEVER miss anything.
```

### After
```xml
<role>
Perform code reviews focusing on correctness, security, and maintainability.
</role>

<review_process>
1. Read the entire diff to understand the change scope
2. Check for correctness: logic errors, edge cases, off-by-one errors
3. Check for security: OWASP top 10, input validation at boundaries
4. Check for maintainability: naming, complexity, test coverage
</review_process>

<constraints>
- Focus feedback on substantive issues, not style preferences
- If a file was not modified in the diff, do not review it
- When uncertain about intent, ask rather than assume
</constraints>

<output_format>
For each issue found:
- File and line number
- Severity: critical / warning / suggestion
- Description of the issue
- Suggested fix (code snippet if applicable)
</output_format>
```

**적용 기법**: 역할 선언 제거 ("expert" 불필요), 공격적 지시 완화 ("MUST"/"NEVER" 제거), 구체적 프로세스 제시, XML 구조화, 출력 형식 명시

---

## 패턴 5: 프롬프트 체이닝이 필요한 경우

단일 프롬프트가 너무 복잡해진 경우, 체이닝을 권장합니다.

### 판단 기준
- 프롬프트가 3개 이상의 독립적 작업을 포함
- 이전 작업의 출력이 다음 작업의 입력이 됨
- 단일 프롬프트로 일관된 품질을 얻기 어려움

### 체이닝 패턴

```text
# Step 1: 분석
[분석 프롬프트] → 분석 결과

# Step 2: 초안 (Step 1 결과를 입력으로)
[작성 프롬프트 + {{STEP1_OUTPUT}}] → 초안

# Step 3: 검토 (Step 2 결과를 입력으로)
[검토 프롬프트 + {{STEP2_OUTPUT}}] → 최종 결과
```

이 경우 프롬프트 개선보다 **워크플로우 분할**을 권장하고, 각 단계의 프롬프트를 개별적으로 개선합니다.
