import bcrypt from 'bcryptjs'
import { saveSession, loadSession } from '../../lib/sessionStore'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export async function verifyPin(staff, pin) {
  if (staff.has_pin && staff.pin_hash) {
    const match = await bcrypt.compare(pin, staff.pin_hash)
    if (!match) return { ok: false, bcryptFail: true }

    // SPEC-LOGIN-SESSION-REUSE-01: try cached session before server roundtrip
    const cached = await loadSession(staff.staff_id)
    if (cached) return { ok: true, session: cached }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staff.staff_id, skip_bcrypt: true }),
    })
    const data = await res.json()
    if (res.ok && data.session) {
      await saveSession(staff.staff_id, data.session)
      return { ok: true, session: data.session }
    }
    return { ok: false }
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staff_id: staff.staff_id, pin }),
  })
  const data = await res.json()
  if (res.ok && data.session) return { ok: true, session: data.session }
  return { ok: false }
}
