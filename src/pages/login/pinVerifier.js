import * as bcrypt from 'bcryptjs'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export async function verifyPin(staff, pin) {
  if (staff.has_pin && staff.pin_hash) {
    const match = await bcrypt.compare(pin, staff.pin_hash)
    if (!match) return { ok: false, bcryptFail: true }

    // SPEC-LOGIN-HONDA-NG-INVESTIGATION-01: removed reused-session path.
    // Stale localStorage session (from deleted auth.user) caused silent auth failure —
    // setSession succeeded locally but getUser() at launcher rejected the deleted user.
    // Always issue fresh session from server after bcrypt success.
    const sessionPromise = fetch(`${SUPABASE_URL}/functions/v1/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staff.staff_id, skip_bcrypt: true }),
    }).then(async res => {
      const data = await res.json()
      if (res.ok && data.session?.access_token) return { ok: true, session: data.session }
      return { ok: false }
    }).catch(() => ({ ok: false }))
    return { ok: true, optimistic: true, sessionPromise }
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staff_id: staff.staff_id, pin }),
  })
  const data = await res.json()
  if (res.ok && data.session?.access_token) return { ok: true, session: data.session }
  return { ok: false }
}
