#!/usr/bin/env bash
# J-INFRA-10: Notion MCP re-auth helper
# Usage: bash scripts/notion-mcp-reauth.sh [ntfy-topic]
#
# Root cause: claude.ai OAuth token lacks user:mcp_servers scope.
# Fix: reconnect Notion integration from claude.ai Settings → Integrations.

REAUTH_URL="https://claude.ai/settings/integrations"
NTFY_TOPIC="${1:-${NTFY_TOPIC:-}}"

echo "=== J-INFRA-10: Notion MCP re-auth ==="
echo ""
echo "Root cause: OAuth token missing user:mcp_servers scope"
echo "Error:      permission_error — OAuth token does not meet scope requirement user:mcp_servers"
echo ""
echo "Re-auth URL:"
echo "  ${REAUTH_URL}"
echo ""
echo "Steps:"
echo "  1. Open the URL above on the device where claude.ai is logged in"
echo "  2. Find 'Notion' in the Integrations list"
echo "  3. Disconnect and reconnect (or click Re-authorize)"
echo "  4. Approve all requested scopes including user:mcp_servers"
echo "  5. Run: bash scripts/notion-mcp-verify.sh"

if [[ -n "${NTFY_TOPIC}" ]]; then
  MSG="J-INFRA-10 Notion再認証: ${REAUTH_URL} — Integrations画面でNotionを再接続してください"
  curl -s -d "${MSG}" "https://ntfy.sh/${NTFY_TOPIC}" > /dev/null
  echo ""
  echo "ntfy sent → ${NTFY_TOPIC}"
fi
