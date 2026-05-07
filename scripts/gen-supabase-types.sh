#!/usr/bin/env bash
set -euo pipefail
npx supabase gen types typescript \
  --project-id gedxzunoyzmvbqgwjalx \
  --schema public \
  > src/types/supabase.d.ts
