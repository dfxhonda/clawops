import bcrypt from 'bcryptjs'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export async function verifyPin(staff, pin) {
  if (staff.has_pin && staff.pin_hash) {
    // DIAG-LOGIN-BCRYPT-COMPARE-01: temporary diagnostic — revert after
    console.warn('[DIAG-01]', {
      pin_type: typeof pin,
      pin_value: pin,
      hash_prefix: staff.pin_hash?.slice(0, 10),
      hash_length: staff.pin_hash?.length,
      compare_fn: typeof bcrypt.compare,
      bcrypt_keys: Object.keys(bcrypt),
    })
    const match = await bcrypt.compare(pin, staff.pin_hash)
    console.warn('[DIAG-01] match:', match)
    // eslint-disable-next-line no-alert
    globalThis.alert?.(`DIAG\npin="${pin}"(${typeof pin})\nhash="${staff.pin_hash?.slice(0,10)}...(len=${staff.pin_hash?.length})"\nmatch=${match}`)
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
