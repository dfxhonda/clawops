#!/usr/bin/env bash
# PreToolUse, matcher: Write|Edit|MultiEdit
TOOL=$(jq -r '.tool_name // empty' < /dev/stdin)
case "$TOOL" in Write|Edit|MultiEdit) ;; *) exit 0 ;; esac
STATE_FILE="$HOME/.claude/round0-v40-read.flag"
if [ ! -f "$STATE_FILE" ]; then
  jq -n '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"NOW(34c6440a-374b-8199-bea1-c855405a5ab7)が未読。先にmcp__notion fetchで読了してから再試行。"}}'
fi
exit 0
