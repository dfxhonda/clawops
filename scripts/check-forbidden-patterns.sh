#!/bin/sh
# Forbidden pattern detector
# Usage: sh scripts/check-forbidden-patterns.sh [dirs_or_files...]
# Default: src/ e2e/
#
# Checks for patterns that must never be committed:
#   test.skip( / test.only( / @ts-nocheck / TODO: skip  →  anywhere in src/ e2e/
#   console.log(                                          →  test directories only
#
# Note: console.log in production src/ is tracked separately via code review.
# Existing violations in scope.forbidden files (clawsupport etc.) must be
# cleaned up in a dedicated task before widening this check to all of src/.

ERRORS=0

SEARCH_DIRS="${*:-src/ e2e/}"

if grep -rn -E 'test\.skip\(|test\.only\(|@ts-nocheck|TODO: skip' $SEARCH_DIRS 2>/dev/null; then
  echo "ERROR: forbidden test-control pattern detected (see above)"
  ERRORS=1
fi

# console.log is forbidden in test code
for d in e2e/ tests/ src/__tests__/; do
  [ -d "$d" ] || continue
  if grep -rn 'console\.log(' "$d" 2>/dev/null; then
    echo "ERROR: console.log( detected in test directory $d"
    ERRORS=1
  fi
done

exit $ERRORS
