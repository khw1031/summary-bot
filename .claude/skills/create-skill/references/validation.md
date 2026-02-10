# 검증 및 보안 가이드

> 스킬 생성 후 품질 검증과 보안 고려사항

---

## skills-ref 도구

`skills-ref`는 스킬 스펙 준수를 검증하는 CLI 도구입니다.

### 주요 명령어

```bash
# 스킬 유효성 검증
skills-ref validate .claude/skills/skill-name

# frontmatter 속성 읽기
skills-ref read-properties .claude/skills/skill-name/SKILL.md

# 프롬프트로 변환 (실제 로드 결과 확인)
skills-ref to-prompt .claude/skills/skill-name/SKILL.md
```

### validate 검증 항목

- name 형식 (소문자/숫자/하이픈, 1-64자)
- name과 디렉토리명 일치 여부
- description 존재 및 길이 (1-1024자)
- SKILL.md 파일 존재 여부
- frontmatter YAML 파싱 가능 여부
- 알 수 없는 필드 경고

---

## 수동 검증 체크리스트

### Stage 1: Discovery 검증

```
□ name이 1-64자인가?
□ name이 소문자, 숫자, 하이픈만 사용하는가?
□ name이 하이픈으로 시작/끝나지 않는가?
□ name에 연속 하이픈이 없는가?
□ name이 디렉토리명과 정확히 일치하는가?
□ description이 1-1024자인가?
□ description이 "무엇을 하는지"를 명시하는가?
□ description이 "언제 사용하는지" 트리거 키워드를 포함하는가?
□ description만 읽고 스킬 필요 여부를 판단할 수 있는가?
```

### Stage 2: Activation 검증

```
□ SKILL.md 본문이 500줄 이하인가?
□ 본문이 핵심 지침만 포함하는가?
□ 본문만으로 80% 이상의 사용 케이스를 처리할 수 있는가?
□ 상세 예제/가이드가 references/로 분리되었는가?
□ 하나의 관심사에 집중하는가?
```

### Stage 3: Execution 검증

```
□ 파일 참조가 상대 경로인가?
□ 참조 깊이가 1단계인가? (references/file.md)
□ references/ 파일이 독립적으로 이해 가능한가?
□ scripts/ 파일이 자체 완결적인가?
□ assets/ 파일이 적절한 형식인가?
```

### 전체 구조 검증

```
□ 디렉토리 구조가 규약에 맞는가?
□ 불필요한 파일이 없는가?
□ 선택 필드가 올바르게 사용되었는가?
□ 사용 패턴(일반/사용자전용/Claude전용/격리)에 맞는 설정인가?
```

---

## 보안 고려사항

스킬은 코드 실행 권한을 가질 수 있으므로 보안에 주의해야 합니다.

### 4가지 보안 원칙

| 원칙 | 설명 | 적용 |
|------|------|------|
| **Sandboxing** | 실행 환경 격리 | `context: fork`로 서브에이전트 격리 |
| **Allowlisting** | 허용 도구 제한 | `allowed-tools`로 최소 권한 부여 |
| **Confirmation** | 사용자 승인 | `disable-model-invocation: true`로 자동 실행 방지 |
| **Logging** | 실행 이력 추적 | scripts/ 내 에러 처리 및 로깅 |

### 언제 어떤 보안 설정을 사용하는가

```
파일 시스템 변경 → allowed-tools 제한
외부 API 호출 → disable-model-invocation: true
대량 데이터 처리 → context: fork
배포/DB 작업 → disable-model-invocation: true + allowed-tools 제한
읽기 전용 분석 → context: fork + agent: Explore
```

### 위험 수준별 권장 설정

| 위험 수준 | 예시 | 권장 설정 |
|----------|------|----------|
| 낮음 | 코드 분석, 문서 생성 | 기본값 |
| 중간 | 파일 생성/수정 | `allowed-tools` 제한 |
| 높음 | 외부 서비스 호출, 배포 | `disable-model-invocation: true` |
| 매우 높음 | 프로덕션 DB, 인프라 변경 | 모든 보안 설정 적용 |

---

## 스크립트 보안

`scripts/` 디렉토리의 코드 작성 시:

### 자체 완결성

```python
# 좋은 예: 필요한 의존성을 명시적으로 확인
import sys
import shutil

if not shutil.which("jq"):
    print("Error: jq is required. Install with: brew install jq", file=sys.stderr)
    sys.exit(1)
```

### 에러 메시지

```bash
# 좋은 예: 명확한 에러 메시지
if [ ! -f "$1" ]; then
    echo "Error: File not found: $1" >&2
    echo "Usage: $0 <input-file>" >&2
    exit 1
fi
```

### 격리 실행

- 스크립트는 현재 디렉토리 외부를 수정하지 않아야 함
- 임시 파일은 `/tmp` 또는 명시적 출력 경로 사용
- 네트워크 요청은 최소화하고 타임아웃 설정

### 스크립트 체크리스트

```
□ 외부 의존성을 실행 전에 확인하는가?
□ 에러 시 명확한 메시지를 출력하는가?
□ 입력 값을 검증하는가?
□ 현재 디렉토리 외부를 수정하지 않는가?
□ 타임아웃이 설정되어 있는가? (네트워크 요청 시)
□ 민감 정보(토큰, 비밀번호)를 하드코딩하지 않았는가?
```
