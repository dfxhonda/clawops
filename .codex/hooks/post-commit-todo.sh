#!/bin/bash
# git commit直後にTODO/FIXME/HACKコメント残り検知、push前に警告
# 警告のみ、ブロックしない (exit 1で警告表示、exit 0以外でhook失敗扱いだがcommit自体は成立)

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Bash以外は通過
if [[ "$TOOL_NAME" != "Bash" ]]; then
  exit 0
fi

# git commit を含む実行のみ対象
if echo "$COMMAND" | grep -qE 'git[[:space:]]+commit'; then
  # src/ 配下のTODOコメント数を数える
  TODO_COUNT=$(grep -rE '(TODO|FIXME|HACK|XXX)' src/ \
    --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
    --include='*.css' --include='*.html' 2>/dev/null | wc -l | tr -d ' ')

  # supabase/functions/ もチェック
  if [ -d "supabase/functions" ]; then
    EDGE_TODO=$(grep -rE '(TODO|FIXME|HACK|XXX)' supabase/functions/ \
      --include='*.ts' --include='*.js' 2>/dev/null | wc -l | tr -d ' ')
    TODO_COUNT=$((TODO_COUNT + EDGE_TODO))
  fi

  if [ "$TODO_COUNT" -gt 0 ]; then
    echo "" >&2
    echo "═══════════════════════════════════════════════════" >&2
    echo "[警告] TODO/FIXME/HACK コメントが ${TODO_COUNT} 件残っています" >&2
    echo "  push する前に内容を確認してください" >&2
    echo "  確認コマンド: grep -rnE '(TODO|FIXME|HACK|XXX)' src/ supabase/functions/" >&2
    echo "═══════════════════════════════════════════════════" >&2
    echo "" >&2
    # 警告のみ、commit自体は成立済 (PostToolUseは結果に影響しない)
    exit 0
  fi
fi

exit 0
