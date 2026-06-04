import bcrypt from 'bcryptjs'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export async function verifyPin(staff, pin) {
  if (staff.has_pin && staff.pin_hash) {
    const match = await bcrypt.compare(pin, staff.pin_hash)
    if (!match) return { ok: false, bcryptFail: true }
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staff.staff_id, skip_bcrypt: true }),
    })
    const data = await res.json()
    if (res.ok && data.session) return { ok: true, session: data.session }
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
