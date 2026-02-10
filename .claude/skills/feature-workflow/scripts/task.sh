#!/bin/bash
# task.sh - Task lifecycle management for feature-workflow
set -e

COMMAND=${1:-help}
TASK_ID=$2
STEP_ID=$3
FLAG=$4

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
SKILL_NAME="$(basename "$SKILL_DIR")"
TASKS_BASE=".ai/tasks"
TASK_DIR="$TASKS_BASE/$TASK_ID"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
  cat << EOF
${BLUE}task.sh${NC} - Task lifecycle management for feature-workflow

${YELLOW}Usage:${NC}
  task.sh <command> [options]

${YELLOW}Commands:${NC}
  ${GREEN}init${NC} <TASK_ID>                    Create new task
  ${GREEN}status${NC} <TASK_ID>                  Show task status
  ${GREEN}list${NC}                              List all tasks
  ${GREEN}complete${NC} <TASK_ID> <STEP> [--finish]  Mark step as completed
  ${GREEN}help${NC}                              Show this help

${YELLOW}Examples:${NC}
  ./scripts/task.sh init PROJ-001
  ./scripts/task.sh status PROJ-001
  ./scripts/task.sh complete PROJ-001 step-1
  ./scripts/task.sh complete PROJ-001 step-5 --finish

${YELLOW}Task Directory:${NC}
  $TASKS_BASE/<TASK_ID>/
  ├── status.yaml           # Task status
  ├── 00-user-prompt.md     # User input (Step 1 input)
  ├── 10-output-plan.md     # Step 1 output
  ├── 20-output-system-design.md  # Step 2 output
  ├── 30-output-task.md     # Step 3 output
  ├── 40-output-implementation.md # Step 4 output
  ├── 50-output-review.md   # Step 5 output
  └── todos/                # Step 3+ subtasks
      ├── 00-TASK_MASTER.md
      └── 01-TASK.md, 02-TASK.md, ...

${YELLOW}Workflow Steps:${NC}
  Step 1: Requirements Analysis
  Step 2: Design & Planning
  Step 3: Task Analysis
  Step 4: Implementation
  Step 5: Review & Documentation
EOF
}

error() {
  echo -e "${RED}Error:${NC} $1" >&2
  exit 1
}

success() {
  echo -e "${GREEN}$1${NC}"
}

info() {
  echo -e "${BLUE}$1${NC}"
}

warn() {
  echo -e "${YELLOW}$1${NC}"
}

# Get current timestamp in ISO 8601 format
timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Fixed step list for feature-workflow (5 steps)
STEPS=("step-1" "step-2" "step-3" "step-4" "step-5")

# Step descriptions (bash 3.2 compatible - no associative arrays)
get_step_name() {
  case "$1" in
    step-1) echo "Requirements Analysis" ;;
    step-2) echo "Design & Planning" ;;
    step-3) echo "Task Analysis" ;;
    step-4) echo "Implementation" ;;
    step-5) echo "Review & Documentation" ;;
    *) echo "" ;;
  esac
}

# Generate steps YAML for status.yaml
generate_steps_yaml() {
  local indent="  "
  for step in "${STEPS[@]}"; do
    echo "${indent}$step:"
    echo "${indent}  status: pending"
    echo "${indent}  name: \"$(get_step_name "$step")\""
  done
}

# Get next step ID
get_next_step() {
  local current=$1
  local found=0
  for step in "${STEPS[@]}"; do
    if [ "$found" -eq 1 ]; then
      echo "$step"
      return
    fi
    if [ "$step" = "$current" ]; then
      found=1
    fi
  done
  echo "" # No next step (last step)
}

cmd_init() {
  [ -z "$TASK_ID" ] && error "TASK_ID required\nUsage: task.sh init <TASK_ID>"

  # Check if task already exists
  if [ -d "$TASK_DIR" ]; then
    warn "Task $TASK_ID already exists at $TASK_DIR"
    read -p "Overwrite? (y/N): " confirm
    [ "$confirm" != "y" ] && [ "$confirm" != "Y" ] && exit 0
    rm -rf "$TASK_DIR"
  fi

  mkdir -p "$TASK_DIR"
  mkdir -p "$TASK_DIR/todos"

  # Create status.yaml
  cat > "$TASK_DIR/status.yaml" << EOF
task_id: $TASK_ID
workflow: $SKILL_NAME
status: running
current_step: step-1
created_at: $(timestamp)
updated_at: $(timestamp)
steps:
$(generate_steps_yaml)
EOF

  # Copy input template (00-user-prompt.md) if exists
  if [ -f "$SKILL_DIR/assets/templates/00-user-prompt.md" ]; then
    cp "$SKILL_DIR/assets/templates/00-user-prompt.md" "$TASK_DIR/00-user-prompt.md"
    info "Input template copied: 00-user-prompt.md"
  else
    # Create minimal input file
    cat > "$TASK_DIR/00-user-prompt.md" << EOF
# User Prompt

## Task ID
$TASK_ID

## Description
<!-- Describe what you want to accomplish -->

## Requirements
- [ ]

## Constraints
<!-- Any limitations or requirements -->

## Additional Context
<!-- Any other relevant information -->
EOF
  fi

  success "Task $TASK_ID created"
  echo ""
  info "Task Directory: $TASK_DIR"
  echo ""
  info "Next steps:"
  echo "  1. Edit input: $TASK_DIR/00-user-prompt.md"
  echo "  2. Load rules: Read assets/rules/AGENTS.md"
  echo "  3. Start Step 1: Read references/step-1.md"
  echo "  4. Complete Step 1: ./scripts/task.sh complete $TASK_ID step-1"
}

cmd_status() {
  [ -z "$TASK_ID" ] && error "TASK_ID required\nUsage: task.sh status <TASK_ID>"
  [ ! -f "$TASK_DIR/status.yaml" ] && error "Task $TASK_ID not found"

  echo ""
  info "Task: $TASK_ID"
  echo "─────────────────────────────────"
  cat "$TASK_DIR/status.yaml"
  echo ""

  # List output files
  info "Output Files:"
  for file in "$TASK_DIR"/*.md; do
    if [ -f "$file" ]; then
      echo "  $(basename "$file")"
    fi
  done

  # List todo files if exist
  if [ -d "$TASK_DIR/todos" ] && [ "$(ls -A "$TASK_DIR/todos" 2>/dev/null)" ]; then
    echo ""
    info "Todo Files:"
    for file in "$TASK_DIR/todos"/*.md; do
      if [ -f "$file" ]; then
        echo "  todos/$(basename "$file")"
      fi
    done
  fi
}

cmd_list() {
  echo ""
  info "Tasks in $TASKS_BASE/"
  echo "─────────────────────────────────"

  if [ ! -d "$TASKS_BASE" ]; then
    echo "  (no tasks found)"
    return
  fi

  local found=0
  for dir in "$TASKS_BASE"/*/; do
    if [ -f "$dir/status.yaml" ]; then
      found=1
      local task_id
      task_id=$(basename "$dir")
      local status
      status=$(grep "^status:" "$dir/status.yaml" | cut -d' ' -f2)
      local current_step
      current_step=$(grep "^current_step:" "$dir/status.yaml" | cut -d' ' -f2)
      local workflow
      workflow=$(grep "^workflow:" "$dir/status.yaml" | cut -d' ' -f2)

      # Get step name
      local step_name=""
      if [ -n "$current_step" ]; then
        step_name="$(get_step_name "$current_step")"
      fi

      case "$status" in
        completed) echo -e "  ${GREEN}✓${NC} $task_id [$workflow] - $status" ;;
        running)   echo -e "  ${YELLOW}▶${NC} $task_id [$workflow] - $current_step ($step_name)" ;;
        failed)    echo -e "  ${RED}✗${NC} $task_id [$workflow] - $status" ;;
        *)         echo "  ? $task_id [$workflow] - $status" ;;
      esac
    fi
  done

  [ "$found" -eq 0 ] && echo "  (no tasks found)"
  echo ""
}

cmd_complete() {
  [ -z "$TASK_ID" ] && error "TASK_ID required"
  [ -z "$STEP_ID" ] && error "STEP_ID required\nUsage: task.sh complete <TASK_ID> <STEP>"
  [ ! -f "$TASK_DIR/status.yaml" ] && error "Task $TASK_ID not found"

  # Validate step ID
  local valid_step=0
  for step in "${STEPS[@]}"; do
    if [ "$step" = "$STEP_ID" ]; then
      valid_step=1
      break
    fi
  done
  [ "$valid_step" -eq 0 ] && error "Invalid step: $STEP_ID\nValid steps: ${STEPS[*]}"

  local now
  now=$(timestamp)

  # Update status.yaml using sed (portable approach)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/updated_at:.*/updated_at: $now/" "$TASK_DIR/status.yaml"
    # Update step status to completed
    sed -i '' "/$STEP_ID:/,/name:/{s/status: pending/status: completed/;s/status: in_progress/status: completed/;}" "$TASK_DIR/status.yaml"
  else
    # Linux
    sed -i "s/updated_at:.*/updated_at: $now/" "$TASK_DIR/status.yaml"
    sed -i "/$STEP_ID:/,/name:/{s/status: pending/status: completed/;s/status: in_progress/status: completed/;}" "$TASK_DIR/status.yaml"
  fi

  success "Step $STEP_ID ($(get_step_name "$STEP_ID")) completed"

  # Check if this is the last step or --finish flag
  if [ "$FLAG" = "--finish" ] || [ "$STEP_ID" = "step-5" ]; then
    # Mark task as completed
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/^status: running/status: completed/" "$TASK_DIR/status.yaml"
    else
      sed -i "s/^status: running/status: completed/" "$TASK_DIR/status.yaml"
    fi
    echo ""
    success "🎉 Workflow completed!"
    echo ""
    info "Task outputs:"
    ls "$TASK_DIR"/*.md 2>/dev/null | while read -r f; do echo "  $(basename "$f")"; done
  else
    # Find next step
    local next_step
    next_step=$(get_next_step "$STEP_ID")

    if [ -n "$next_step" ]; then
      # Update current_step
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/current_step:.*/current_step: $next_step/" "$TASK_DIR/status.yaml"
        sed -i '' "/$next_step:/,/name:/{s/status: pending/status: in_progress/;}" "$TASK_DIR/status.yaml"
      else
        sed -i "s/current_step:.*/current_step: $next_step/" "$TASK_DIR/status.yaml"
        sed -i "/$next_step:/,/name:/{s/status: pending/status: in_progress/;}" "$TASK_DIR/status.yaml"
      fi

      echo ""
      info "Next: $next_step ($(get_step_name "$next_step"))"
      echo ""
      echo "  1. Load rules: Read assets/rules/AGENTS.md"
      echo "  2. Read step guide: references/$next_step.md"
      echo ""
      warn "💡 Recommended: Start a new conversation for the next step"
    fi
  fi
}

# Main
case "$COMMAND" in
  init)     cmd_init ;;
  status)   cmd_status ;;
  list)     cmd_list ;;
  complete) cmd_complete ;;
  help|--help|-h) show_help ;;
  *)
    error "Unknown command: $COMMAND"
    show_help
    ;;
esac
