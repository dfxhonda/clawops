#!/usr/bin/env bash
# J-INFRA-08: install agentic-poll as macOS LaunchAgent
set -euo pipefail

PLIST_LABEL="com.dfx.clawops.agentic-poll"
PLIST_SRC="$(cd "$(dirname "$0")/.." && pwd)/launchd/$PLIST_LABEL.plist.template"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"
LOG_DIR="$HOME/clawops/logs"
UID_VAL="$(id -u)"

echo "[install] J-INFRA-08 agentic-poll install start"

# E: pre_install_cleanup — 旧インスタンス/cron/lock を完全削除
echo "[install] pre-install cleanup..."
pkill -f 'agentic-poll' 2>/dev/null || true
crontab -l 2>/dev/null | grep -v 'agentic-poll' | crontab - 2>/dev/null || true
rm -rf /tmp/agentic-poll.lockdir /tmp/agentic-poll.lock
launchctl bootout "gui/$UID_VAL/$PLIST_LABEL" 2>/dev/null || true
launchctl unload "$PLIST_DST" 2>/dev/null || true
rm -f "$PLIST_DST"

# logs dir 作成
mkdir -p "$LOG_DIR"

# plist 配置
cp "$PLIST_SRC" "$PLIST_DST"
echo "[install] plist -> $PLIST_DST"

# launchd に登録 (modern bootstrap API, macOS 12+)
launchctl bootstrap "gui/$UID_VAL" "$PLIST_DST"
echo "[install] launchctl bootstrap done"

# 登録確認 (print でサービス定義の存在を確認)
if launchctl print "gui/$UID_VAL/$PLIST_LABEL" 2>/dev/null | grep -q "path ="; then
  echo "[install] ✅ $PLIST_LABEL loaded"
elif launchctl list 2>/dev/null | grep -q "$PLIST_LABEL"; then
  echo "[install] ✅ $PLIST_LABEL loaded (via list)"
else
  echo "[install] ❌ load failed" >&2
  exit 1
fi

echo "[install] logs: $LOG_DIR/agentic-poll.stdout.log"
echo "[install] done"
