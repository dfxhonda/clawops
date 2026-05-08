#!/usr/bin/env bash
# J-INFRA-08: uninstall agentic-poll launchd job
set -euo pipefail

PLIST_LABEL="com.dfx.clawops.agentic-poll"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"
UID_VAL="$(id -u)"

echo "[uninstall] stopping $PLIST_LABEL..."
pkill -f 'agentic-poll' 2>/dev/null || true
launchctl bootout "gui/$UID_VAL/$PLIST_LABEL" 2>/dev/null || true
launchctl unload "$PLIST_DST" 2>/dev/null || true
rm -f "$PLIST_DST"
rm -rf /tmp/agentic-poll.lockdir /tmp/agentic-poll.lock

if launchctl list | grep -q "$PLIST_LABEL"; then
  echo "[uninstall] ❌ job still listed" >&2
  exit 1
fi

echo "[uninstall] ✅ $PLIST_LABEL removed"
