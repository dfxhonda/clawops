// SPEC-AUTH-LOCK-S5: ロック解除処理 (session-unlock Edge 結線)
import { supabase } from '../supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

function base64urlRandom32() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

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

  // クライアントでchallenge生成 → session-unlock の webauthn_challenge 引数に渡す
  const challenge = base64urlRandom32()

  const assertion = await startAuthentication({
    optionsJSON: {
      challenge,
      timeout: 60000,
      userVerification: 'required',
      rpId: window.location.hostname,
      allowCredentials: [],
    },
  })

  const data = await postUnlock({
    staff_id: staffId,
    current_access_token: accessToken,
    auth_method: 'webauthn',
    webauthn_assertion: assertion,
    webauthn_challenge: challenge,
  })
  await applySession(data)
}
