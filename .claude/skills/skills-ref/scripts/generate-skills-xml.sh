#!/bin/bash
# 스킬 디렉토리를 스캔하여 Available Skills XML을 생성하는 스크립트
# 사용법: bash skills/skill-ref/scripts/generate-skills-xml.sh <skills_dir>
# 예시:   bash skills/skill-ref/scripts/generate-skills-xml.sh .claude/skills
#         bash skills/skill-ref/scripts/generate-skills-xml.sh skills

SKILLS_DIR="${1:?사용법: $0 <skills_dir> (예: .claude/skills, skills)}"

if [ ! -d "$SKILLS_DIR" ]; then
  echo "Error: 디렉토리를 찾을 수 없습니다: $SKILLS_DIR" >&2
  exit 1
fi

# frontmatter에서 description을 추출하는 함수
extract_description() {
  local file="$1"
  local in_frontmatter=false
  local in_description=false
  local description=""

  while IFS= read -r line; do
    if [ "$line" = "---" ]; then
      if [ "$in_frontmatter" = true ]; then
        break
      fi
      in_frontmatter=true
      continue
    fi

    if [ "$in_frontmatter" = true ]; then
      # description 필드 시작
      if echo "$line" | grep -q '^description:'; then
        in_description=true
        # 인라인 값이 있는 경우 (description: > 또는 description: | 제외)
        local value
        value=$(echo "$line" | sed 's/^description: *//')
        if [ "$value" != ">" ] && [ "$value" != "|" ] && [ -n "$value" ]; then
          description="$value"
        fi
        continue
      fi

      # description 여러 줄 계속
      if [ "$in_description" = true ]; then
        if echo "$line" | grep -q '^[a-z_-]*:'; then
          break
        fi
        if echo "$line" | grep -q '^  '; then
          local trimmed
          trimmed=$(echo "$line" | sed 's/^  *//')
          if [ -n "$description" ]; then
            description="$description $trimmed"
          else
            description="$trimmed"
          fi
        else
          break
        fi
      fi
    fi
  done < "$file"

  echo "$description"
}

# frontmatter에서 name을 추출하는 함수
extract_name() {
  local file="$1"
  grep -m1 '^name:' "$file" 2>/dev/null | sed 's/^name: *//'
}

echo '<available-skills>'
echo ''

for skill_dir in "$SKILLS_DIR"/*/; do
  [ -d "$skill_dir" ] || continue
  skill_file="${skill_dir}SKILL.md"
  [ -f "$skill_file" ] || continue

  name=$(extract_name "$skill_file")
  [ -z "$name" ] && continue

  full_desc=$(extract_description "$skill_file")
  [ -z "$full_desc" ] && continue

  # description과 trigger 분리 (awk로 안전하게 처리)
  # 첫 번째 한국어 문장 종결 패턴(합니다./입니다./됩니다./습니다.)으로 분리
  desc_part=$(echo "$full_desc" | awk '{
    match($0, /[^ ]+(합니다\.|입니다\.|됩니다\.|습니다\.)/)
    if (RSTART > 0) {
      print substr($0, 1, RSTART + RLENGTH - 1)
    } else {
      print $0
    }
  }')
  trigger_part=""
  if [ "$desc_part" != "$full_desc" ] && [ -n "$desc_part" ]; then
    # desc_part 길이 이후의 문자열을 trigger로 추출
    desc_len=${#desc_part}
    trigger_part="${full_desc:$desc_len}"
    # 앞뒤 공백 제거
    trigger_part=$(echo "$trigger_part" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
  fi

  # 분리 실패 시 전체를 description으로
  if [ -z "$desc_part" ]; then
    desc_part="$full_desc"
    trigger_part=""
  fi

  ref_path="${skill_dir%/}"

  echo "<skill name=\"${name}\" ref=\"${ref_path}\">"
  echo "  <description>${desc_part}</description>"
  if [ -n "$trigger_part" ]; then
    echo "  <trigger>${trigger_part}</trigger>"
  else
    echo "  <trigger></trigger>"
  fi
  echo '</skill>'
  echo ''
done

echo '</available-skills>'
