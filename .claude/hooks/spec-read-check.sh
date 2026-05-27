#!/usr/bin/env bash
# PreToolUse, matcher: Write|Edit|MultiEdit
TOOL=$(jq -r '.tool_name // empty' < /dev/stdin)
case "$TOOL" in Write|Edit|MultiEdit) ;; *) exit 0 ;; esac
STATE_FILE="$HOME/.claude/round0-v6-read.flag"
if [ ! -f "$STATE_FILE" ]; then
  jq -n '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"NOW(360c15b9-a458-817f-9a87-eb91b8b262e4)が未読。先にmcp__notion fetchで読了してから再試行。"}}'
fi
exit 0
