#!/usr/bin/env bash
# PostToolUse, matcher: Bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
RESPONSE=$(echo "$INPUT" | jq -r '.tool_response // empty')
if echo "$COMMAND" | grep -qE 'git push'; then
  CB=$(cd "$CLAUDE_PROJECT_DIR" && git branch --show-current)
  PT=$(echo "$COMMAND" | grep -oE 'git push [^ ]+ [^ ]+' | awk '{print $4}')
  if [ -n "$PT" ] && [ "$PT" != "$CB" ]; then
    curl -s -d "🚨 ブランチ不一致push: 現在=$CB push先=$PT (refspec違いでno-opの可能性)" https://ntfy.sh/clawops-hiro-0328
  fi
  if echo "$RESPONSE" | grep -q "Everything up-to-date"; then
    curl -s -d "⚠️ Everything up-to-date 何も送られてない可能性" https://ntfy.sh/clawops-hiro-0328
  fi
  cd "$CLAUDE_PROJECT_DIR" && git fetch origin --quiet 2>/dev/null
  L=$(git rev-parse HEAD 2>/dev/null)
  R=$(git rev-parse "origin/$CB" 2>/dev/null)
  if [ -n "$L" ] && [ -n "$R" ] && [ "$L" != "$R" ]; then
    curl -s -d "🚨 push後SHA不一致 local=${L:0:8} remote=${R:0:8} push失敗の疑い" https://ntfy.sh/clawops-hiro-0328
  fi
fi
exit 0
