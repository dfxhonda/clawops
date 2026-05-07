#!/usr/bin/env bash
# Collect input context for a given judge type
# Usage: runner.sh <judge-type> <commit>
set -euo pipefail

JUDGE="${1:-}"
COMMIT="${2:-HEAD}"

if [ -z "$JUDGE" ]; then
  echo "Usage: runner.sh <scope|forbidden|acceptance|test-quality> [commit]" >&2
  exit 1
fi

case "$JUDGE" in
  scope)
    echo "=== Changed files (git diff --name-only) ==="
    git diff --name-only "${COMMIT}~1" "${COMMIT}" 2>/dev/null \
      || git show --name-only --format= "$COMMIT"
    ;;
  forbidden)
    echo "=== Added lines in this commit ==="
    git show "$COMMIT" --format= \
      | grep "^+" | grep -v "^+++" \
      | head -300
    ;;
  acceptance)
    echo "=== Changed files (stat) ==="
    git show "$COMMIT" --stat
    echo ""
    echo "=== Commit message ==="
    git log -1 "$COMMIT" --format="%B"
    ;;
  test-quality)
    echo "=== Changed files (stat) ==="
    git show "$COMMIT" --stat
    echo ""
    echo "=== e2e/journey-infra-05.spec.js (HEAD) ==="
    git show "${COMMIT}:e2e/journey-infra-05.spec.js" 2>/dev/null | head -120 || echo "(not found in commit)"
    echo ""
    echo "=== scripts/run-evaluator.sh (HEAD) ==="
    git show "${COMMIT}:scripts/run-evaluator.sh" 2>/dev/null | head -80 || echo "(not found in commit)"
    ;;
  *)
    echo "Unknown judge type: $JUDGE" >&2
    exit 1
    ;;
esac
