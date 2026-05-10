#!/usr/bin/env bash
# Evaluator agent: runs 4 judges against HEAD commit via claude CLI
# Usage: bash scripts/run-evaluator.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVAL_DIR="$SCRIPT_DIR/eval"
COMMIT=$(git rev-parse HEAD)

JUDGES=("scope" "forbidden" "acceptance" "test-quality")
FAILED_JUDGES=()

for judge in "${JUDGES[@]}"; do
  echo "=== Running ${judge}-judge ==="

  PROMPT_FILE=$(mktemp)
  {
    cat "$EVAL_DIR/${judge}-judge.md"
    echo ""
    echo "## Commit: $COMMIT"
    echo "## Input Data:"
    bash "$EVAL_DIR/runner.sh" "$judge" "$COMMIT" 2>/dev/null || echo "(runner error — continuing)"
  } > "$PROMPT_FILE"

  OUTPUT=$(claude -p "$(cat "$PROMPT_FILE")" --model sonnet --dangerously-skip-permissions 2>&1 || true)
  rm -f "$PROMPT_FILE"

  echo "$OUTPUT"

  if echo "$OUTPUT" | grep -q "VERDICT: PASSED"; then
    echo "✅ ${judge}-judge: PASSED"
  else
    echo "❌ ${judge}-judge: FAILED"
    FAILED_JUDGES+=("$judge")
  fi
  echo ""
done

if [ ${#FAILED_JUDGES[@]} -eq 0 ]; then
  echo "EVALUATOR: ALL PASSED commit=$COMMIT"
  exit 0
else
  FAILED_LIST=$(IFS=','; echo "${FAILED_JUDGES[*]}")
  echo "EVALUATOR: FAILED failed_judges=$FAILED_LIST commit=$COMMIT"
  exit 1
fi
