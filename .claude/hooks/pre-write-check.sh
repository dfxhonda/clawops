#!/bin/bash
# Write/Edit前に .env 保護 + ど安定ver5点ファイル警告
# Anthropic Claude Code Hooks仕様: stdin から JSON、stdout/stderr/exitコードで判定

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

# Write/Edit/MultiEdit以外は通過
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "MultiEdit" ]]; then
  exit 0
fi

if [ -z "$FILE_PATH" ]; then exit 0; fi

# .env系ファイルへの書き込み禁止 (settings.local.jsonでも防御してるが二重ガード)
if echo "$FILE_PATH" | grep -qE '\.env(\.local|\.production|\.development)?$'; then
  jq -n '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": ".envファイルへの書き込みをブロック (APIキー漏洩防止)。環境変数追加が必要ならヒロさんがVercel/Supabaseダッシュボードで実施"
    }
  }'
  exit 0
fi

# VITE_*=sk-* パターンのAPIキー値書き込み検知 (Edit時の new_string)
NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty')
if echo "$NEW_CONTENT" | grep -qE 'VITE_[A-Z_]*(API_KEY|SECRET|TOKEN).*=.*sk-'; then
  jq -n '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": "VITE_プレフィックス付き環境変数にAPIキーらしき値の書き込みを検知。VITE_*はブラウザに露出するためAPIキー保管禁止。サーバーサイド (Edge Function/Vercel Function) に移動すること"
    }
  }'
  exit 0
fi

# ど安定ver5点ファイルへの編集警告 (ブロックではなく警告)
if echo "$FILE_PATH" | grep -qE '(usePatrolForm|patrolV2|MeterInputRow|stocktake_(sessions|items)|AuthProvider|useAuth|RoleGuard|roles\.js)'; then
  echo "[警告] ど安定ver5点関連ファイル: $FILE_PATH" >&2
  echo "[警告] 変更前にヒロさんに打診済みか確認、tasks/lessons.md と .claude/rules/safe-ops.md 参照" >&2
fi

exit 0
