// SPEC-AUTH-LOCK-S4: WebAuthn client helpers (@simplewebauthn/browser ラッパー)

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

// WKWebView / 未対応端末検出: navigator.credentials.create が存在しなければ false
export function isWebAuthnSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator?.credentials?.create === 'function'
  )
}

// userAgent から端末ラベルを推定 (ユーザー入力なし)
function guessDeviceLabel() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  return 'このデバイス'
}

// passkey 登録: begin → startRegistration → finish → staff_credentials INSERT
export async function registerPasskey(accessToken) {
  // @simplewebauthn/browser は使用時のみロード (コード分割)
  const { startRegistration } = await import('@simplewebauthn/browser')

  // Step 1: begin - challenge + options 取得
  const beginRes = await fetch(`${SUPABASE_URL}/functions/v1/register-passkey`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action: 'begin' }),
  })
  if (!beginRes.ok) {
    const err = await beginRes.json().catch(() => ({}))
    throw new Error(err.error || 'begin failed')
  }
  const { challenge_token, options } = await beginRes.json()

  // Step 2: navigator.credentials.create (Face ID / Touch ID ダイアログ)
  const registrationResponse = await startRegistration({ optionsJSON: options })

  // Step 3: finish - 検証 + INSERT
  const finishRes = await fetch(`${SUPABASE_URL}/functions/v1/register-passkey`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'finish',
      registration_response: registrationResponse,
      challenge_token,
      device_label: guessDeviceLabel(),
    }),
  })
  if (!finishRes.ok) {
    const err = await finishRes.json().catch(() => ({}))
    throw new Error(err.error || 'finish failed')
  }
  return await finishRes.json()
}
