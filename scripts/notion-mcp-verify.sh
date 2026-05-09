#!/usr/bin/env bash
# J-INFRA-10: Notion MCP write-access verification
# Usage: NOTION_API_KEY=secret_xxx bash scripts/notion-mcp-verify.sh [page-id]
#
# Requires a Notion Internal Integration token with write access.
# Default page: clawops specs/M1 root (adjust PAGE_ID as needed).

set -euo pipefail

PAGE_ID="${1:-${NOTION_VERIFY_PAGE_ID:-3586440a374b815db98dff8b8e0a4493}}"

if [[ -z "${NOTION_API_KEY:-}" ]]; then
  echo "ERROR: NOTION_API_KEY is not set" >&2
  echo "Usage: NOTION_API_KEY=secret_xxx bash scripts/notion-mcp-verify.sh" >&2
  exit 1
fi

echo "=== J-INFRA-10: Notion write-access verify ==="
echo "Page: ${PAGE_ID}"
echo ""

# Step 1: Read test
HTTP=$(curl -s -o /tmp/notion-verify-read.json -w "%{http_code}" \
  -H "Authorization: Bearer ${NOTION_API_KEY}" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/pages/${PAGE_ID}")

if [[ "${HTTP}" != "200" ]]; then
  echo "FAIL: read returned HTTP ${HTTP}" >&2
  cat /tmp/notion-verify-read.json >&2
  exit 1
fi
echo "READ: OK (HTTP 200)"

# Step 2: Write test (append a verification block then delete it)
APPEND_RESP=$(curl -s -o /tmp/notion-verify-append.json -w "%{http_code}" \
  -X PATCH \
  -H "Authorization: Bearer ${NOTION_API_KEY}" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  --data '{
    "children": [{
      "object": "block",
      "type": "paragraph",
      "paragraph": {
        "rich_text": [{"type": "text", "text": {"content": "[J-INFRA-10 verify] write-access OK — delete me"}}]
      }
    }]
  }' \
  "https://api.notion.com/v1/blocks/${PAGE_ID}/children")

if [[ "${APPEND_RESP}" != "200" ]]; then
  echo "FAIL: write returned HTTP ${APPEND_RESP}" >&2
  cat /tmp/notion-verify-append.json >&2
  exit 1
fi
echo "WRITE: OK (HTTP 200)"

BLOCK_ID=$(python3 -c "import json,sys; r=json.load(open('/tmp/notion-verify-append.json')); print(r['results'][0]['id'])" 2>/dev/null || true)
if [[ -n "${BLOCK_ID}" ]]; then
  curl -s -o /dev/null -X DELETE \
    -H "Authorization: Bearer ${NOTION_API_KEY}" \
    -H "Notion-Version: 2022-06-28" \
    "https://api.notion.com/v1/blocks/${BLOCK_ID}"
  echo "CLEANUP: verify block deleted"
fi

echo ""
echo "=== PASS: Notion read+write access confirmed ==="
