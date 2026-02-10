# XML 형식 상세

## skills-ref (uvx)

### 개요

`skills-ref`는 Agent Skills 공식 레퍼런스 라이브러리입니다. 스킬 검증, 메타데이터 파싱, 프롬프트 XML 생성을 제공합니다.

- **PyPI 패키지**: `skills-ref`
- **CLI 엔트리포인트**: `agentskills`
- **Python 요구사항**: >= 3.11
- **저장소**: https://github.com/agentskills/agentskills

### 실행 환경 확인

`uvx`가 있으면 별도 설치 없이 바로 실행 가능합니다:

```bash
uvx --from skills-ref agentskills --help 2>/dev/null && echo "사용 가능" || echo "사용 불가"
```

`uvx`가 없으면 `uv`를 먼저 설치합니다:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 주요 명령어

```bash
# 스킬 유효성 검증
uvx --from skills-ref agentskills validate {skills_dir}/{name}

# frontmatter 속성 읽기 (JSON 출력)
uvx --from skills-ref agentskills read-properties {skills_dir}/{name}/SKILL.md

# 프롬프트 XML 생성 (여러 스킬)
uvx --from skills-ref agentskills to-prompt {skills_dir}/*/
```

### to-prompt 출력 형식 (공식)

`uvx --from skills-ref agentskills to-prompt`는 다음 형식을 출력합니다:

```xml
<available_skills>
  <skill>
    <name>skill-a</name>
    <description>What skill-a does</description>
    <location>/absolute/path/to/skill-a/SKILL.md</location>
  </skill>
</available_skills>
```

이 출력을 CLAUDE.md용 형식으로 변환하여 사용합니다 (아래 "CLAUDE.md용 형식" 참조).

---

## 왜 XML인가

CLAUDE.md에 스킬 목록을 작성할 때 XML을 사용하는 이유:

1. **구조화된 파싱**: Claude가 태그 기반으로 정확히 파싱 가능
2. **속성 기반 메타데이터**: `name`, `ref` 같은 속성으로 식별자와 경로를 분리
3. **마크다운 호환**: XML 태그는 마크다운 렌더링에 영향 없음
4. **선택적 로딩**: Claude가 `ref` 경로를 따라 필요 시 SKILL.md를 로드

## CLAUDE.md용 형식

```xml
<available-skills>

<skill name="{name}" ref="{path}">
  <description>{what_it_does}</description>
  <trigger>{when_to_activate}</trigger>
</skill>

</available-skills>
```

### 속성

| 속성 | 필수 | 설명 | 예시 |
|------|------|------|------|
| `name` | Y | 스킬 식별자 (frontmatter name) | `create-skill` |
| `ref` | Y | 스킬 디렉토리 상대 경로 | `.claude/skills/create-skill` |

### 자식 요소

| 요소 | 필수 | 설명 |
|------|------|------|
| `<description>` | Y | 스킬이 무엇을 하는지 (첫 문장) |
| `<trigger>` | Y | 언제 활성화되는지 (트리거 키워드) |

## Description → Description + Trigger 분리

frontmatter의 `description` 필드를 두 부분으로 분리합니다.

### 분리 알고리즘

```
1. description 텍스트에서 첫 번째 문장 종결 패턴을 찾는다:
   - "합니다." / "입니다." / "됩니다." / "습니다."
   - 또는 첫 번째 줄바꿈

2. 첫 문장 → <description>
3. 나머지 → <trigger>

4. trigger가 비어있으면 description 전체를 <description>에,
   <trigger>는 빈 값으로 둔다.
```

### 분리 예시

**예시 1: 표준 형식**
```yaml
description: >
  Claude Code Skill을 생성합니다.
  스킬 생성, SKILL.md 작성, 새 스킬 만들기 요청 시 활성화.
```
```xml
<description>Claude Code Skill을 생성합니다.</description>
<trigger>스킬 생성, SKILL.md 작성, 새 스킬 만들기 요청 시 활성화.</trigger>
```

**예시 2: 여러 줄 description**
```yaml
description: >
  프로젝트에 규칙을 Skill 기반으로 추가하고 기존 규칙을 Skill로 변환합니다.
  규칙 추가, 룰 추가, rule 추가, 새 규칙, 컨벤션 추가,
  스타일 가이드 추가, 가이드라인 추가, 규칙 변환, rule 통합 요청 시 활성화.
```
```xml
<description>프로젝트에 규칙을 Skill 기반으로 추가하고 기존 규칙을 Skill로 변환합니다.</description>
<trigger>규칙 추가, 룰 추가, rule 추가, 새 규칙, 컨벤션 추가, 스타일 가이드 추가, 가이드라인 추가, 규칙 변환, rule 통합 요청 시 활성화.</trigger>
```

**예시 3: description만 있는 경우**
```yaml
description: >
  TypeScript 코딩 컨벤션. 코드 작성, 리뷰, 리팩토링 시 자동 적용.
```
```xml
<description>TypeScript 코딩 컨벤션.</description>
<trigger>코드 작성, 리뷰, 리팩토링 시 자동 적용.</trigger>
```

## 정렬 순서

스킬은 다음 순서로 정렬합니다:

1. `user-invocable: false`가 아닌 스킬 (사용자 호출 가능) 먼저
2. 같은 그룹 내에서는 `name` 알파벳 순

## CLAUDE.md 내 위치

### 권장 위치

CLAUDE.md에서 Available Skills 섹션은 **파일의 주요 가이드 뒤, 부록/참고 앞**에 위치합니다:

```markdown
# Project Guide

## 프로젝트 개요
...

## 개발 가이드
...

## Available Skills       ← 여기

<available-skills>
...
</available-skills>

## 참고
...
```

### 기존 CLAUDE.md 수정 시

기존 `<available-skills>` 태그를 찾아 그 사이의 내용만 교체합니다:

```
교체 범위: <available-skills> ... </available-skills>
```

`## Available Skills` 헤딩은 `<available-skills>` 태그 바로 위에 있어야 합니다.

## 확장: 그룹핑

스킬 수가 많을 때 카테고리별 그룹핑도 가능합니다:

```xml
## Available Skills

<available-skills>

<!-- Workflow -->
<skill name="feature-workflow" ref=".claude/skills/feature-workflow">
  <description>기능 구현을 위한 단계별 워크플로우를 제공합니다.</description>
  <trigger>새 기능 구현, 기능 개발, feature, implement 요청 시 활성화.</trigger>
</skill>

<!-- Creation -->
<skill name="create-skill" ref=".claude/skills/create-skill">
  <description>Claude Code Skill을 생성합니다.</description>
  <trigger>스킬 생성, SKILL.md 작성, 새 스킬 만들기 요청 시 활성화.</trigger>
</skill>

</available-skills>
```

XML 주석(`<!-- -->`)으로 카테고리를 구분할 수 있습니다.
