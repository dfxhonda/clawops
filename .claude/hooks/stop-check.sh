#!/bin/bash
# Claude Code が応答終了 (Stop) する前に、ヒロさんへの作業要求や選択肢提示を検知
# Claude Code Hooks仕様: stdin から transcript_path 含むJSON、最終アシスタント発言を読む

INPUT=$(cat)
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  exit 0
fi

# transcript JSONLの最終 assistant メッセージを取得
LAST_ASSISTANT=$(tac "$TRANSCRIPT_PATH" 2>/dev/null | head -200 | \
  jq -r 'select(.message.role == "assistant") | .message.content[]? | select(.type == "text") | .text' 2>/dev/null | \
  head -50)

if [ -z "$LAST_ASSISTANT" ]; then
  exit 0
fi

VIOLATIONS=""

# C系: ヒロさん作業要求パターン
if echo "$LAST_ASSISTANT" | grep -qE '(スクリーンショット|スクショ).*(貼っ|投げ|送っ)'; then
  VIOLATIONS+="\n- [C作業要求] スクリーンショット貼り付け要求"
fi
if echo "$LAST_ASSISTANT" | grep -qE '(コピペ|コピー).*(してください|お願い|もらえ)'; then
  VIOLATIONS+="\n- [C作業要求] コピペ要求"
fi
if echo "$LAST_ASSISTANT" | grep -qE 'ターミナル.*(出力|結果).*(貼|送|教え)'; then
  VIOLATIONS+="\n- [C作業要求] ターミナル出力貼付要求"
fi
if echo "$LAST_ASSISTANT" | grep -qE 'ファイル.*(中身|内容).*(貼|送|教え)'; then
  VIOLATIONS+="\n- [C作業要求] ファイル内容貼付要求"
fi

# D系: 選択肢提示パターン
if echo "$LAST_ASSISTANT" | grep -qE '(AとB|どちら).*(良い|選び|します)'; then
  VIOLATIONS+="\n- [D選択肢提示] どちら聞き"
fi
if echo "$LAST_ASSISTANT" | grep -qE '案[1-3].*案[1-3]'; then
  VIOLATIONS+="\n- [D選択肢提示] 複数案並列"
fi

# B系: 太鼓持ち・前置き
if echo "$LAST_ASSISTANT" | grep -qE '(承知しました|素晴らしい|ご指摘ありがとう|お疲れ様)'; then
  VIOLATIONS+="\n- [B前置き] 太鼓持ち禁止語句検出"
fi

# G系: 中途半端な確証なし表現
if echo "$LAST_ASSISTANT" | grep -qE '(おそらく|たぶん|〜と思われ|〜のはず)'; then
  VIOLATIONS+="\n- [G推測] 確証なし表現検出"
fi

if [ -n "$VIOLATIONS" ]; then
  echo "" >&2
  echo "═══════════════════════════════════════════════════" >&2
  echo "[Stop Hook] Claude応答に禁止パターン検出:" >&2
  echo -e "$VIOLATIONS" >&2
  echo "" >&2
  echo "  → tasks/lessons.md 該当カテゴリ参照" >&2
  echo "  → 次回応答で改善" >&2
  echo "═══════════════════════════════════════════════════" >&2
  echo "" >&2
fi

exit 0
