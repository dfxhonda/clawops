// SPEC-AUTH-LOCK-S5: ロック解除overlay (S2土台 → S5 session-unlock 実結線)
import { useState } from 'react'
import { isWebAuthnSupported } from '../lib/webauthn'

const LockIcon = () => (
  <div className="flex flex-col items-center gap-2 text-center">
    <div className="w-16 h-16 rounded-full bg-surface2 border-2 border-border flex items-center justify-center mb-2">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-text-dim"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </div>
    <p className="text-text-dim text-sm">ロック中</p>
  </div>
)

export function LockScreen({ staffName, onUnlock }) {
  const [mode, setMode] = useState('buttons') // 'buttons' | 'pin'
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleWebAuthn = async () => {
    if (!isWebAuthnSupported()) {
      setMode('pin')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onUnlock?.('webauthn')
    } catch {
      // WebAuthn失敗 (未登録 / キャンセル含む) → PINフォールバック
      setMode('pin')
    } finally {
      setLoading(false)
    }
  }

  const handlePinSubmit = async () => {
    if (pin.length !== 4 || loading) return
    setLoading(true)
    setError('')
    try {
      await onUnlock?.('pin', pin)
    } catch (e) {
      setError(e?.status === 401 ? 'PINが正しくありません' : 'エラーが発生しました。再試行してください。')
      setPin('')
      setLoading(false)
    }
  }

  if (mode === 'pin') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="PIN入力"
        className="fixed inset-0 z-[200] bg-bg flex flex-col items-center justify-center gap-8 select-none"
      >
        <LockIcon />
        {staffName && <p className="text-text font-bold text-lg -mt-4">{staffName}</p>}

        <div className="flex flex-col gap-3 w-72 px-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
            placeholder="••••"
            autoFocus
            disabled={loading}
            className="w-full min-h-[52px] rounded-xl bg-surface2 border border-border text-text text-center text-2xl tracking-widest font-bold py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-40"
          />
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
          <button
            type="button"
            onClick={handlePinSubmit}
            disabled={pin.length !== 4 || loading}
            className="min-h-[44px] w-full rounded-xl bg-accent text-bg font-bold py-3 px-6 flex items-center justify-center active:opacity-70 transition-opacity disabled:opacity-40"
          >
            {loading ? '確認中...' : '解除'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('buttons'); setPin(''); setError('') }}
            disabled={loading}
            className="min-h-[44px] w-full rounded-xl bg-surface2 border border-border text-text-dim text-sm py-2 px-4 flex items-center justify-center active:opacity-70 transition-opacity"
          >
            ← 戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="画面ロック中"
      className="fixed inset-0 z-[200] bg-bg flex flex-col items-center justify-center gap-10 select-none"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <LockIcon />
        {staffName && (
          <p className="text-text font-bold text-lg">{staffName}</p>
        )}
      </div>

      <div className="flex flex-col gap-4 w-72 px-4">
        <button
          type="button"
          onClick={handleWebAuthn}
          disabled={loading}
          className="min-h-[44px] w-full rounded-xl bg-surface2 border border-border text-text font-bold py-3 px-6 flex items-center justify-center active:opacity-70 transition-opacity disabled:opacity-40"
        >
          {loading ? '認証中...' : '顔認証 / 生体認証'}
        </button>
        <button
          type="button"
          onClick={() => setMode('pin')}
          disabled={loading}
          className="min-h-[44px] w-full rounded-xl bg-accent text-bg font-bold py-3 px-6 flex items-center justify-center active:opacity-70 transition-opacity"
        >
          PIN入力
        </button>
      </div>
    </div>
  )
}
