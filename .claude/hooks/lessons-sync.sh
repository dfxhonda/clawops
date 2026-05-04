#!/bin/bash
# git commit前にdiffを取得し、tasks/lessons.mdの既知パターンが再出現してないか検知
# Anthropic Hooks仕様: PreToolUse hook で git commit を引っ掛けて警告

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Bash & git commit のみ対象
if [[ "$TOOL_NAME" != "Bash" ]]; then exit 0; fi
if ! echo "$COMMAND" | grep -qE 'git[[:space:]]+commit'; then exit 0; fi

# lessons.md がなければ通過
LESSONS_FILE="tasks/lessons.md"
if [ ! -f "$LESSONS_FILE" ]; then exit 0; fi

# staged diff を取得
DIFF=$(git diff --cached 2>/dev/null)
if [ -z "$DIFF" ]; then exit 0; fi

# 既知の禁止パターンを抽出 (lessons.md のキーワード)
WARNINGS=""

# A系: 推測実装の典型シグネチャ
if echo "$DIFF" | grep -qE 'VITE_[A-Z_]*(API_KEY|SECRET|TOKEN)'; then
  WARNINGS+="\n- [A推測/E既存資産無視] VITE_*APIキー パターン検出 — 5/1 OCR事故と同パターン、サーバーサイド (Edge Function) に移すべき"
fi

# E系: NativeCamera直叩きの再発検知 (ocr-meter Edge Function無視)
if echo "$DIFF" | grep -qE 'fetch.*api\.anthropic\.com'; then
  if ! echo "$DIFF" | grep -qE 'supabase.*functions.*invoke'; then
    WARNINGS+="\n- [E既存資産無視] Anthropic API クライアント直叩き検出 — supabase/functions/ocr-meter 経由を確認"
  fi
fi

# JST系: toISOString().split/slice 禁止
if echo "$DIFF" | grep -qE '\.toISOString\(\)\.(split|slice)'; then
  WARNINGS+="\n- [JST] toISOString().split/slice 禁止 — toLocaleDateString('sv-SE', {timeZone:'Asia/Tokyo'}) 使用"
fi

# anon クエリで organization_id フィルタ
if echo "$DIFF" | grep -qE '\.eq\(.organization_id'; then
  WARNINGS+="\n- [Auth] anonクエリでorganization_idフィルタ禁止 — RLS担保で対応"
fi

# input[type=file] の display:none 親div配置 (iOS Safari change未発火)
if echo "$DIFF" | grep -qE '<div[^>]*display:.*none[^>]*>[[:space:]]*<input[^>]*type=.file'; then
  WARNINGS+="\n- [iOS] input[type=file]のdisplay:none親div配置検出 — 5/4 iOS Safariイベント未発火事故と同パターン、input自身に直接付ける"
fi

# patrol_date を toISOString で計算
if echo "$DIFF" | grep -qE 'patrol_date.*toISOString' ; then
  WARNINGS+="\n- [業務ルール] patrol_date は前日付け(patrol)/当日付け(replace)、JSTで分岐必要"
fi

# console.log 残し (デバッグ漏れ)
DEBUG_LOG_COUNT=$(echo "$DIFF" | grep -cE '^\+.*console\.log\(')
if [ "$DEBUG_LOG_COUNT" -gt 3 ]; then
  WARNINGS+="\n- [G中途半端] console.log が ${DEBUG_LOG_COUNT}件追加 — デバッグ残し疑い"
fi

if [ -n "$WARNINGS" ]; then
  echo "" >&2
  echo "═══════════════════════════════════════════════════" >&2
  echo "[lessons-sync] 既知パターンの再出現検知 (先祖返り警告):" >&2
  echo -e "$WARNINGS" >&2
  echo "" >&2
  echo "  対応: tasks/lessons.md 参照、必要なら commit を見直し" >&2
  echo "  ブロックはしない、警告のみ" >&2
  echo "═══════════════════════════════════════════════════" >&2
  echo "" >&2
fi

exit 0
