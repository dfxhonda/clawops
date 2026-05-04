#!/usr/bin/env bash
NTFY="https://ntfy.sh/clawops-hiro-0328"
MAX_RETRY=10
COUNT=0
while true; do
  OUTPUT=$(claude "$@" 2>&1)
  EXIT=$?
  if [ $EXIT -eq 0 ]; then
    curl -d "✅ Claude Code 完走" $NTFY
    break
  fi
  if echo "$OUTPUT" | grep -q "Not logged in"; then
    curl -d "🚨 未ログイン停止" $NTFY
    exit 1
  fi
  COUNT=$((COUNT+1))
  if [ $COUNT -ge $MAX_RETRY ]; then
    curl -d "🚨 ${MAX_RETRY}回リトライ失敗、停止" $NTFY
    exit 1
  fi
  curl -d "⏸ 上限到達 ($COUNT/$MAX_RETRY) 5分後リトライ" $NTFY
  sleep 300
done
