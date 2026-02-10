# Skill 템플릿 모음

> 복사-붙여넣기 가능한 Skill 템플릿

---

## 기본 Skill - Reference (지식/패턴 제공)

> Reference 콘텐츠: Claude가 inline으로 참조하는 지식, 패턴, 가이드라인

```yaml
---
name: pdf-extractor
description: >
  PDF 파일에서 텍스트와 테이블을 추출합니다.
  PDF 작업, 문서 추출, 폼 처리 요청 시 사용.
argument-hint: "[파일경로]"
---

# PDF 텍스트 추출

PDF 파일에서 구조화된 데이터를 추출합니다.

## 사용 방법

1. PDF 파일 경로 확인
2. 추출 대상 선택 (텍스트/테이블/이미지)
3. 출력 형식 지정

## 상세 정보

- [추출 옵션 상세](references/options.md) (필요시)
```

---

## 사용자 전용 Skill - Task (단계별 지침)

> Task 콘텐츠: 부작용이 있어 사용자가 직접 실행해야 하는 작업

```yaml
---
name: deploy-production
description: >
  프로덕션 환경에 배포합니다.
  배포, 릴리스, 프로덕션 푸시 요청 시 사용.
argument-hint: "[버전]"
disable-model-invocation: true
---

# 프로덕션 배포

이 작업은 실제 서비스에 영향을 줍니다.

## 실행 단계

1. 테스트 통과 확인
2. 버전 태그 생성
3. 배포 스크립트 실행
4. 헬스체크 확인
```

---

## Claude 전용 Skill - Reference (배경 지식)

> Reference 콘텐츠: Claude가 자동으로 참조하는 내부 지식 (사용자 호출 불가)

```yaml
---
name: coding-standards
description: >
  프로젝트 코딩 컨벤션과 스타일 가이드.
  코드 작성, 리뷰, 리팩토링 시 자동 참조.
user-invocable: false
---

# 코딩 표준

이 프로젝트의 코딩 컨벤션입니다.

## 핵심 개념

- TypeScript strict 모드 사용
- 함수형 프로그래밍 선호

## 적용 규칙

- 모든 함수에 타입 명시
- 부작용 함수는 명확히 분리
```

---

## 서브에이전트 실행 Skill - Task (격리 실행)

> Task 콘텐츠: 격리된 컨텍스트에서 실행되는 무거운 작업

```yaml
---
name: codebase-analysis
description: >
  전체 코드베이스 구조와 의존성을 분석합니다.
  아키텍처 분석, 코드베이스 탐색, 구조 파악 요청 시 사용.
argument-hint: "[분석 범위]"
context: fork
agent: Explore
---

# 코드베이스 분석

전체 프로젝트 구조를 분석하고 요약합니다.

## 수행 단계

1. 디렉토리 구조 탐색
2. 핵심 모듈 식별
3. 의존성 관계 파악

## 출력 형식

- 프로젝트 구조 트리
- 핵심 컴포넌트 목록
- 아키텍처 다이어그램
```

---

## 동적 컨텍스트 Skill - Reference (실시간 정보)

> Reference 콘텐츠: 실행 시점의 동적 정보를 주입하여 참조

```yaml
---
name: git-context
description: >
  현재 Git 상태와 브랜치 정보를 제공합니다.
  커밋, PR 작성, 브랜치 관리 시 자동 참조.
context: fork
agent: Explore
---

# Git 컨텍스트

## 현재 상태

- 현재 브랜치: !`git branch --show-current`
- 최근 변경: !`git log --oneline -5`
- 상태: !`git status --short`

## 작업 지침

위 정보를 기반으로 적절한 Git 작업을 수행합니다.
```

---

## 디렉토리 구조 템플릿

### 단순 구조 (단일 파일)

```
skill-name/
└── SKILL.md
```

### 표준 구조 (권장)

```
skill-name/
├── SKILL.md           # 메인 지침 (필수)
└── references/        # 상세 문서
    └── detail.md
```

### 확장 구조 (복잡한 스킬)

```
skill-name/
├── SKILL.md           # 메인 지침
├── references/        # 상세 문서
│   ├── guide.md
│   └── examples.md
├── scripts/           # 실행 스크립트
│   └── main.py
└── assets/            # 정적 자산
    └── template.json
```

### 확장 구조 예시: scripts/ 활용

```yaml
---
name: code-metrics
description: >
  코드베이스의 복잡도와 품질 메트릭을 측정합니다.
  코드 분석, 복잡도, 메트릭, 품질 측정 요청 시 사용.
context: fork
agent: general-purpose
---

# 코드 메트릭 분석

## 사용 방법

1. 분석 대상 디렉토리 확인
2. 메트릭 스크립트 실행: `scripts/analyze.py <경로>`
3. 결과 해석 및 요약

## 참고

- [메트릭 상세 설명](references/metrics.md)
```

```python
# scripts/analyze.py - 자체 완결적 스크립트
"""코드 복잡도 분석 스크립트."""
import sys
import os

def analyze(path):
    """지정 경로의 코드 메트릭을 분석한다."""
    if not os.path.exists(path):
        print(f"Error: Path not found: {path}", file=sys.stderr)
        sys.exit(1)

    file_count = 0
    total_lines = 0
    for root, _, files in os.walk(path):
        for f in files:
            if f.endswith(('.py', '.js', '.ts')):
                file_count += 1
                with open(os.path.join(root, f)) as fh:
                    total_lines += sum(1 for _ in fh)

    print(f"Files: {file_count}")
    print(f"Total lines: {total_lines}")
    print(f"Avg lines/file: {total_lines // max(file_count, 1)}")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "."
    analyze(target)
```

---

## 빠른 시작 템플릿

### 최소 템플릿

```yaml
---
name: my-skill
description: >
  무엇을 하는지 설명.
  언제 사용하는지 키워드.
---

# 스킬 제목

## 사용 방법

1. 단계 1
2. 단계 2
3. 단계 3
```

### 전체 템플릿

```yaml
---
name: my-skill
description: >
  무엇을 하는지 상세 설명.
  사용자가 요청할 트리거 키워드 포함.
argument-hint: "[인자 설명]"
license: MIT
compatibility: Node.js 18+
metadata:
  author: team-name
  version: "1.0.0"
---

# 스킬 제목

## 개요

핵심 기능 2-3문장 요약.

## 사용 방법

1. 첫 번째 단계
2. 두 번째 단계
3. 세 번째 단계

## 예제

### 기본 사용

입력: ...
출력: ...

## 주의사항

- 엣지 케이스 1
- 엣지 케이스 2

## 참고 자료

- [상세 가이드](references/detail.md)
```
