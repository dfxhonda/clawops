// SPEC-LOGIN-FRONT-BCRYPT-REMOVE-01: bcryptjs($2b$非互換でsilent false)廃止。
// 全員 verify-pin に {staff_id, pin} POST → pgcrypto照合 → session直返し。
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

// SPEC-LOGIN-VERIFYPIN-WARMUP-IMPL-01: verify-pin Edge Function cold start対策。
// SPEC-LOGIN-UPDATE-PREFETCH-01: warmup を GET→POST に変更。GET は別インスタンスを温める可能性があり
//   POST cold start を防げない(H2仮説)。POST warmup は同一コードパスを起動するため確実。
//   Edge Function 側で staff_id='__warmup__' を検出して即200返し(auth_logs汚染防止)。
// 10秒cooldown + offline skip で二重発火を防ぐ。
let _lastWarmupTs = 0
const WARMUP_COOLDOWN_MS = 10_000

export function warmupVerifyPin() {
  if (!navigator.onLine) return
  const now = Date.now()
  if (now - _lastWarmupTs < WARMUP_COOLDOWN_MS) return
  _lastWarmupTs = now
  fetch(`${SUPABASE_URL}/functions/v1/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staff_id: '__warmup__' }),
  }).catch(e => console.warn('[WARMUP-VERIFY-PIN]', e))
}

export async function verifyPin(staff, pin) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staff_id: staff.staff_id, pin }),
  })
  const data = await res.json()
  if (res.ok && data.session?.access_token) return { ok: true, session: data.session }
  return { ok: false }
}
