#!/usr/bin/env bash
# J-INFRA-08: agentic poll bridge
# A) mkdir-based atomic lock (macOS native, POSIX mkdir)
# C) CLAUDE_CONFIG_DIR 経由でキーチェーン認証 (launchd 環境対応)
# D) claude -p specs/M1 pickup → 実装 → push → status done
# F) Observability: stdout/stderr log + daily rotating log + ntfy
set -euo pipefail

NTFY="https://ntfy.sh/clawops-hiro-0328"
LOCKDIR="${AGENTIC_LOCKDIR:-/tmp/agentic-poll.lockdir}"
CLAWOPS_DIR="${CLAWOPS_DIR:-$HOME/clawops}"
LOGDIR="$CLAWOPS_DIR/logs"
LOG_DAILY="$LOGDIR/agentic-poll-$(date +%Y%m%d).log"

# A: mkdir-based atomic lock — macOS native POSIX atomic mkdir
mkdir "$LOCKDIR" 2>/dev/null || exit 0
trap 'rm -rf "$LOCKDIR"' EXIT INT TERM

mkdir -p "$LOGDIR"

ts()      { date '+%Y-%m-%dT%H:%M:%S'; }
log()     { printf '[%s] %s\n' "$(ts)" "$*" | tee -a "$LOG_DAILY"; }
log_err() { printf '[%s] ERROR: %s\n' "$(ts)" "$*" | tee -a "$LOG_DAILY" >&2; }

log "start pid=$$"

cd "$CLAWOPS_DIR"

# HEAD before — pickup detection by HEAD change after claude
HEAD_BEFORE=$(git rev-parse HEAD 2>/dev/null || echo "none")

PICKUP_PROMPT='specs/M1 https://www.notion.so/3586440a374b81a6a7d4e8ef8daade60 を mcp__notion fetch、status:ready_for_implementation の最初の spec を pickup、spec 通り実装、push origin main、status を done に更新、status_log.entries に各 phase YAML 追記。pickup なし or 全 done なら exit 0 silently。'

EXIT_CODE=0
OUTPUT=$(claude -p "$PICKUP_PROMPT" --model sonnet --dangerously-skip-permissions 2>&1) || EXIT_CODE=$?

printf '%s\n' "$OUTPUT" | tee -a "$LOG_DAILY"

if [ "$EXIT_CODE" -ne 0 ]; then
  log_err "claude exit=$EXIT_CODE"
  # F: ntfy on_failure
  curl -s -d "agentic-poll failure exit=$EXIT_CODE" "$NTFY" || true
  exit "$EXIT_CODE"
fi

# F: ntfy on_done (pickup 検出: HEAD 変化) / silent on no_pickup
HEAD_AFTER=$(git rev-parse HEAD 2>/dev/null || echo "none")
if [ "$HEAD_AFTER" != "$HEAD_BEFORE" ]; then
  COMMIT=$(git rev-parse --short HEAD)
  log "pickup done commit=$COMMIT"
  curl -s -d "agentic-poll done commit=$COMMIT" "$NTFY" || true
else
  log "no_pickup"
fi
