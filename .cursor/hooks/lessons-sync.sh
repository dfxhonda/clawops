#!/bin/bash
# L-4: lessons-sync — git commit 前に staged diff × lessons.md パターンを照合
set -euo pipefail

LESSONS="tasks/lessons.md"

# lessons.md がなければスキップ
if [ ! -f "$LESSONS" ]; then
  echo '{"permission": "allow"}'
  exit 0
fi

# staged diff を取得（--cached = インデックス vs HEAD）
staged_diff=$(git diff --cached 2>/dev/null || echo "")

if [ -z "$staged_diff" ]; then
  echo '{"permission": "allow"}'
  exit 0
fi

# staged diff の追加行のみ抽出（+で始まる行、+++ヘッダ除く）
added_lines=$(echo "$staged_diff" | grep '^+' | grep -v '^+++' || true)

hits=()

# ── 具体的な既知危険パターン (lessons.md から抽出) ──────────────────
PATTERN_LABELS=(
  "VITE_ANTHROPIC_API_KEY直叩き"
  "NativeCamera漏洩リスク"
  "organization_idフィルタ(anon禁止)"
  "ask_user_input選択肢提示禁止"
  "getAllMeterReadings全件取得"
  "patrol_date日付規則違反候補"
)
PATTERN_VALUES=(
  "VITE_ANTHROPIC_API_KEY"
  "NativeCamera"
  "organization_id"
  "ask_user_input"
  "getAllMeterReadings"
  "new Date()"
)

for i in "${!PATTERN_LABELS[@]}"; do
  label="${PATTERN_LABELS[$i]}"
  pattern="${PATTERN_VALUES[$i]}"
  if echo "$added_lines" | grep -q "$pattern"; then
    hits+=("$label")
  fi
done

if [ ${#hits[@]} -gt 0 ]; then
  hits_str=$(IFS=', '; echo "${hits[*]}")
  echo "{
    \"permission\": \"ask\",
    \"user_message\": \"⚠️ L-4 lessons-sync: staged diff に過去の先祖返りパターンが含まれています:\\n  ${hits_str}\\n\\ntasks/lessons.md を確認し、意図的な変更か検証してください。\",
    \"agent_message\": \"Hook L-4 detected potential regression patterns in staged diff: ${hits_str}. Cross-check with tasks/lessons.md before committing.\"
  }"
else
  echo '{"permission": "allow"}'
fi

exit 0
