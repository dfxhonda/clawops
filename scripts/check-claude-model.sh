#!/usr/bin/env bash
set -uo pipefail

CURRENT="${CLAUDE_MODEL:-claude-sonnet-4-6}"
OUT="${GITHUB_OUTPUT:-/dev/null}"

echo "model=$CURRENT" >> "$OUT"

curl -sf https://api.anthropic.com/v1/models \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" > /tmp/models.json || {
  echo "::error::Failed to fetch models from Anthropic API"
  echo "reason=api_error" >> "$OUT"
  exit 1
}

if ! jq -e '.data' /tmp/models.json > /dev/null 2>&1; then
  echo "::error::Unexpected API response format"
  echo "reason=api_error" >> "$OUT"
  exit 1
fi

MATCH=$(jq -r ".data[] | select(.id == \"$CURRENT\") | .id" /tmp/models.json)

if [ -z "$MATCH" ]; then
  echo "::error::Model $CURRENT not found in Anthropic API response (may be deprecated)"
  echo "reason=not_found" >> "$OUT"
  echo "retired_at=unknown" >> "$OUT"
  exit 1
fi

RETIRED=$(jq -r ".data[] | select(.id == \"$CURRENT\") | .retired_at // empty" /tmp/models.json)
echo "retired_at=${RETIRED:-none}" >> "$OUT"

if [ -n "$RETIRED" ]; then
  SIX_MONTHS=$(date -d "+6 months" -u +%s)
  RETIRED_TS=$(date -d "$RETIRED" -u +%s)
  if [ "$RETIRED_TS" -lt "$SIX_MONTHS" ]; then
    echo "::warning::Model $CURRENT retires at $RETIRED — update soon"
    echo "reason=retiring_soon" >> "$OUT"
    exit 1
  fi
fi

echo "Model $CURRENT is active."
echo "reason=ok" >> "$OUT"
