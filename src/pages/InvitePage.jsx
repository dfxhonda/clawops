// SPEC-STAFF-INVITE-S3+S4: /invite受信 + PIN設定画面 (stage 3-4/5)
// ProtectedRoute外 / 未認証可。token検証→プロフィール確認+PIN設定→launcher遷移。
import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

async function callSetPin(token, pin, name, phone) {
  const body = { token, pin, name, phone }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/set-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return { ok: res.ok, data }
}

const ROLE_LABELS = { admin: '管理者', manager: 'マネージャー', patrol: '巡回', staff: 'スタッフ' }

function Spinner() {
  return (
    <>
      <style>{`@keyframes inv-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 32, height: 32, border: '2px solid #f0c040', borderTopColor: 'transparent', borderRadius: '50%', animation: 'inv-spin 1s linear infinite' }} />
    </>
  )
}

function FieldRow({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#cbd5e1' }}>{value || '—'}</div>
    </div>
  )
}

function EditRow({ label, value, onChange, inputMode = 'text' }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{label}</label>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
          color: '#e8e8f0', fontSize: 15, padding: '10px 12px', outline: 'none',
        }}
      />
    </div>
  )
}

function PinInput({ label, value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{label}</label>
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="••••"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
          color: '#e8e8f0', fontSize: 28, letterSpacing: 10, padding: '10px 12px',
          outline: 'none', textAlign: 'center',
        }}
      />
    </div>
  )
}

const baseStyle = {
  minHeight: '100dvh',
  background: '#0a0a0f',
  color: '#e8e8f0',
  fontFamily: "-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN',sans-serif",
}

const centeredStyle = {
  ...baseStyle,
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', padding: '24px 16px', textAlign: 'center',
}

export default function InvitePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [pageState, setPageState] = useState(token ? 'loading' : 'no_token')
  const [staff, setStaff] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [pinError, setPinError] = useState('')
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!token) return
    callVerifyInvite(token)
      .then(({ ok, data }) => {
        if (ok && data.ok) {
          setStaff(data.staff)
          setEditName(data.staff.name || '')
          setEditPhone(data.staff.phone || '')
          setPageState('setup')
        } else {
          setPageState('invalid')
        }
      })
      .catch(() => setPageState('invalid'))
  }, [token])

  const pinMismatch = pin1.length === 4 && pin2.length > 0 && pin1 !== pin2
  const canSubmit = pin1.length === 4 && pin2.length === 4 && pin1 === pin2 && pageState === 'setup'

  const handleSubmit = async () => {
    if (!canSubmit) return
    setPinError('')
    setSubmitError('')
    setPageState('submitting')
    try {
      const { ok, data } = await callSetPin(token, pin1, editName, editPhone)
      if (!ok || !data.session?.access_token) {
        setSubmitError(
          data.error === 'invalid_or_expired'
            ? 'このリンクは期限切れです。管理者に再発行を依頼してください。'
            : '設定に失敗しました。もう一度お試しください。'
        )
        setPageState('setup')
        return
      }
      // setSession完了待ちしてからnavigate (SPEC-LOGIN-FRONT-BCRYPT-REMOVE-01 race対策踏襲)
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
      navigate('/launcher', { replace: true })
    } catch {
      setSubmitError('通信エラーが発生しました')
      setPageState('setup')
    }
  }

  if (pageState === 'loading') {
    return <div style={centeredStyle}><Spinner /></div>
  }

  if (pageState === 'no_token') {
    return (
      <div style={centeredStyle}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
        <p style={{ fontSize: 16, color: '#f87171' }}>招待リンクが無効です</p>
      </div>
    )
  }

  if (pageState === 'invalid') {
    return (
      <div style={centeredStyle}>
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

  // S4: プロフィール確認 + PIN設定フォーム
  return (
    <div style={baseStyle}>
      {/* ヘッダー */}
      <div style={{ padding: '20px 16px 16px', textAlign: 'center', borderBottom: '1px solid #1e293b' }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>Round 0</div>
        <div style={{ fontSize: 13, color: '#9090a8', marginTop: 4 }}>アカウント設定</div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 48px' }}>
        {/* プロフィール確認セクション */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#f0c040', marginBottom: 10, letterSpacing: 1 }}>
            プロフィール確認
          </div>
          <div style={{ background: '#111827', borderRadius: 12, padding: '16px' }}>
            {/* 編集可: 氏名・電話 */}
            <EditRow label="氏名" value={editName} onChange={setEditName} />
            <EditRow label="電話番号" value={editPhone} onChange={setEditPhone} inputMode="tel" />
            {/* 表示のみ */}
            {staff?.name_kana && <FieldRow label="氏名カナ" value={staff.name_kana} />}
            {staff?.email && <FieldRow label="メール" value={staff.email} />}
            <FieldRow label="ロール" value={ROLE_LABELS[staff?.role] || staff?.role} />
            {staff?.store_code && <FieldRow label="主店舗" value={staff.store_code} />}
            {staff?.joined_at && <FieldRow label="入社日" value={staff.joined_at} />}
            {/* hidden: 備考・車両在庫 */}
          </div>
        </div>

        {/* PIN設定セクション */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#f0c040', marginBottom: 10, letterSpacing: 1 }}>
            PIN設定（4桁）
          </div>
          <div style={{ background: '#111827', borderRadius: 12, padding: '16px' }}>
            <PinInput
              label="新しいPIN"
              value={pin1}
              onChange={v => { setPin1(v); setPinError('') }}
            />
            <PinInput
              label="PINの確認（再入力）"
              value={pin2}
              onChange={v => { setPin2(v); setPinError('') }}
            />
            {(pinMismatch || pinError) && (
              <p style={{ fontSize: 13, color: '#f87171', margin: '4px 0 0' }}>
                {pinError || 'PINが一致しません'}
              </p>
            )}
          </div>
        </div>

        {submitError && (
          <p style={{ fontSize: 13, color: '#f87171', textAlign: 'center', marginBottom: 16 }}>
            {submitError}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: '100%', minHeight: 48, padding: '14px',
            borderRadius: 12, border: 'none',
            background: canSubmit ? '#f0c040' : '#1e293b',
            color: canSubmit ? '#0a0a0f' : '#64748b',
            fontSize: 16, fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {pageState === 'submitting' ? '設定中...' : '設定して始める'}
        </button>
      </div>
    </div>
  )
}
