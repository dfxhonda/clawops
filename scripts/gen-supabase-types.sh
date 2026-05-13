#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "::warning::SUPABASE_ACCESS_TOKEN not set — skipping type generation."
  echo "To activate: GitHub repo → Settings → Secrets → Actions → New secret"
  echo "  Name:  SUPABASE_ACCESS_TOKEN"
  echo "  Value: <personal access token from https://app.supabase.com/account/tokens>"
  exit 0
fi

npx supabase gen types typescript \
  --project-id gedxzunoyzmvbqgwjalx \
  --schema public \
  > src/types/supabase.d.ts

echo "Types generated."
