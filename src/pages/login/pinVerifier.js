import * as bcrypt from 'bcryptjs'
import { supabase } from '../../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export async function verifyPin(staff, pin) {
  if (staff.has_pin && staff.pin_hash) {
    const match = await bcrypt.compare(pin, staff.pin_hash)
    if (!match) return { ok: false, bcryptFail: true }

    // SPEC-LOGIN-SESSION-REUSE-01-fix-01: getSession() is pure local read (0ms, no server call).
    // Supabase persists session in localStorage after first signInWithPassword.
    const { data: { session } } = await supabase.auth.getSession()
    if (session && session.user?.user_metadata?.staff_id === staff.staff_id) {
      return { ok: true, session, reused: true }
    }

    const sessionPromise = fetch(`${SUPABASE_URL}/functions/v1/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staff.staff_id, skip_bcrypt: true }),
    }).then(async res => {
      const data = await res.json()
      if (res.ok && data.session) return { ok: true, session: data.session }
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
  if (res.ok && data.session) return { ok: true, session: data.session }
  return { ok: false }
}
