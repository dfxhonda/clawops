// SPEC-LOGIN-FRONT-BCRYPT-REMOVE-01: bcryptjs($2b$非互換でsilent false)廃止。
// 全員 verify-pin に {staff_id, pin} POST → pgcrypto照合 → session直返し。
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

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
