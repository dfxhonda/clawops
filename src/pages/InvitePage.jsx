// SPEC-STAFF-INVITE-S3-TOKEN-RECEIVE-01: /invite受信画面 (stage 3/5)
// ProtectedRoute外 / 未認証可。token検証→S4プレースホルダ表示。
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

async function callVerifyInvite(token) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  const data = await res.json()
  return { ok: res.ok, data }
}

export default function InvitePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [state, setState] = useState(token ? 'loading' : 'no_token')
  const [staff, setStaff] = useState(null)

  useEffect(() => {
    if (!token) return
    callVerifyInvite(token)
      .then(({ ok, data }) => {
        if (ok && data.ok) {
          setStaff(data.staff)
          setState('verified')
        } else {
          setState('invalid')
        }
      })
      .catch(() => setState('invalid'))
  }, [token])

  const containerStyle = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0f',
    color: '#e8e8f0',
    fontFamily: "-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN',sans-serif",
    padding: '24px 16px',
    textAlign: 'center',
  }

  if (state === 'loading') {
    return (
      <div style={containerStyle}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ width: 32, height: 32, border: '2px solid #f0c040', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (state === 'no_token') {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
        <p style={{ fontSize: 16, color: '#f87171' }}>招待リンクが無効です</p>
      </div>
    )
  }

  if (state === 'invalid') {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⛔</div>
        <p style={{ fontSize: 16, color: '#f87171', maxWidth: 300 }}>
          この招待リンクは期限切れか無効です。
        </p>
        <p style={{ fontSize: 13, color: '#9090a8', marginTop: 8, maxWidth: 300 }}>
          管理者に再発行を依頼してください。
        </p>
      </div>
    )
  }

  // verified → S4プレースホルダ
  return (
    <div style={containerStyle}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>✅</div>
      <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        招待リンクの確認が完了しました
      </p>
      {staff && (
        <p style={{ fontSize: 14, color: '#9090a8', marginBottom: 16 }}>
          {staff.name} さん、ようこそ
        </p>
      )}
      <p style={{ fontSize: 13, color: '#64748b', maxWidth: 300 }}>
        PIN設定画面は次段(S4)で実装予定です。
      </p>
    </div>
  )
}
