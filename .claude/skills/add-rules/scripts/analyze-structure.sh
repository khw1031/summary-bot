#!/bin/bash
# 레포지토리 규칙 관련 구조를 자동 분석하는 스크립트
# 사용법: bash skills/add-rules/scripts/analyze-structure.sh <skills_dir>
# 예시:   bash skills/add-rules/scripts/analyze-structure.sh .claude/skills
#         bash skills/add-rules/scripts/analyze-structure.sh skills

SKILLS_DIR="${1:?사용법: $0 <skills_dir> (예: .claude/skills, skills)}"

echo "=== 레포지토리 규칙 구조 분석 ==="
echo "대상 스킬 디렉토리: ${SKILLS_DIR}"
echo ""

# Skills 디렉토리 분석
echo "## Skills (${SKILLS_DIR})"
if [ -d "$SKILLS_DIR" ]; then
  skill_count=$(find "$SKILLS_DIR" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')
  echo "- 총 ${skill_count}개 skill 존재"
  for skill_dir in "$SKILLS_DIR"/*/; do
    [ -d "$skill_dir" ] || continue
    if [ -f "${skill_dir}SKILL.md" ]; then
      name=$(grep -m1 '^name:' "${skill_dir}SKILL.md" 2>/dev/null | sed 's/name: *//')
      ref_count=$(find "${skill_dir}references" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
      script_count=$(find "${skill_dir}scripts" -type f 2>/dev/null | wc -l | tr -d ' ')
      asset_count=$(find "${skill_dir}assets" -type f 2>/dev/null | wc -l | tr -d ' ')
      echo "  - ${name:-$(basename "$skill_dir")}: refs=${ref_count}, scripts=${script_count}, assets=${asset_count}"
    fi
  done
else
  echo "- ${SKILLS_DIR}/ 디렉토리 없음"
fi
echo ""

# Rules 디렉토리 분석
echo "## Rules"
if [ -d "rules" ]; then
  rule_count=$(find rules -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  echo "- rules/: ${rule_count}개 파일"
  find rules -name "*.md" 2>/dev/null | while read -r f; do echo "  - $f"; done
else
  echo "- rules/ 디렉토리 없음"
fi
echo ""

# Claude rules 분석
echo "## Claude Rules"
if [ -d ".claude/rules" ]; then
  claude_count=$(find .claude/rules -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  echo "- .claude/rules/: ${claude_count}개 파일"
  find .claude/rules -name "*.md" 2>/dev/null | while read -r f; do echo "  - $f"; done
else
  echo "- .claude/rules/ 디렉토리 없음"
fi
echo ""

# Cursor rules 분석
echo "## Cursor Rules"
if [ -f ".cursorrules" ]; then
  lines=$(wc -l < .cursorrules | tr -d ' ')
  echo "- .cursorrules: ${lines}줄"
else
  echo "- .cursorrules 없음"
fi
mdc_files=$(find . -name "*.mdc" -not -path "./node_modules/*" 2>/dev/null)
if [ -n "$mdc_files" ]; then
  echo "- MDC 파일:"
  echo "$mdc_files" | while read -r f; do echo "  - $f"; done
else
  echo "- .mdc 파일 없음"
fi
echo ""

# assets/rules 패턴 분석
echo "## Assets/Rules 패턴"
assets_found=false
for skill_dir in "$SKILLS_DIR"/*/; do
  [ -d "$skill_dir" ] || continue
  if [ -d "${skill_dir}assets/rules" ]; then
    assets_found=true
    agents_file="${skill_dir}assets/rules/AGENTS.md"
    rule_files=$(find "${skill_dir}assets/rules" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    echo "- $(basename "$skill_dir"): ${rule_files}개 규칙 파일"
    if [ -f "$agents_file" ]; then
      echo "  - AGENTS.md 인덱스 존재"
    fi
  fi
done
if [ "$assets_found" = false ]; then
  echo "- assets/rules/ 패턴 미사용"
fi
echo ""

# AGENTS.md 분석
echo "## AGENTS.md"
agents_files=$(find . -name "AGENTS.md" -not -path "./node_modules/*" -not -path "./${SKILLS_DIR}/*/assets/*" 2>/dev/null)
if [ -n "$agents_files" ]; then
  echo "$agents_files" | while read -r f; do echo "  - $f"; done
else
  echo "- AGENTS.md 없음"
fi
echo ""

echo "=== 분석 완료 ==="
