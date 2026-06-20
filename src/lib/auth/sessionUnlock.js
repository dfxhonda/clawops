// SPEC-AUTH-LOCK-S5-FIX: ロック解除処理 (session-unlock begin/finish サーバー発行challenge)
import { supabase } from '../supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

async function postUnlock(body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/session-unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'session-unlock failed')
    err.status = res.status
    throw err
  }
  return data
}

async function applySession(data) {
  await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
}

export async function unlockWithPin(staffId, accessToken, pin) {
  const data = await postUnlock({
    staff_id: staffId,
    current_access_token: accessToken,
    auth_method: 'pin',
    pin,
  })
  await applySession(data)
}

export async function unlockWithWebAuthn(staffId, accessToken) {
  if (typeof window.PublicKeyCredential === 'undefined' || typeof navigator?.credentials?.get !== 'function') {
    const err = new Error('WebAuthn not supported')
    err.code = 'NOT_SUPPORTED'
    throw err
  }

  const { startAuthentication } = await import('@simplewebauthn/browser')

  // Step 1: サーバーから challenge_token + options を取得
  const beginRes = await fetch(`${SUPABASE_URL}/functions/v1/session-unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'begin', staff_id: staffId, current_access_token: accessToken }),
  })
  const beginData = await beginRes.json().catch(() => ({}))
  if (!beginRes.ok) {
    const err = new Error(beginData.error || 'begin failed')
    err.status = beginRes.status
    throw err
  }
  const { challenge_token, options } = beginData

  // Step 2: WebAuthn assertion
  const assertion = await startAuthentication({ optionsJSON: options })

  // Step 3: finish — challenge_token をサーバーに送付、HMAC検証はサーバー側
  const data = await postUnlock({
    staff_id: staffId,
    current_access_token: accessToken,
    auth_method: 'webauthn',
    webauthn_assertion: assertion,
    challenge_token,
  })
  await applySession(data)
}
