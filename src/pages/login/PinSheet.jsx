import { useState } from 'react'
import { verifyPin } from './pinVerifier'

const AVATAR_BG = ['#0e7490','#7c3aed','#059669','#d97706','#db2777','#4338ca','#e11d48']
function avatarBg(staffId) {
  let h = 0
  for (let i = 0; i < staffId.length; i++) h = Math.imul(31, h) + staffId.charCodeAt(i) | 0
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length]
}

export default function PinSheet({ staff, onClose, onSuccess }) {
  const [digits, setDigits]               = useState([])
  const [shaking, setShaking]             = useState(false)
  const [submitting, setSubmitting]       = useState(false)
  const [systemError, setSystemError]     = useState(false)
  const [attemptedFail, setAttemptedFail] = useState(false) // 今セッション失敗フラグ (メッセージ表示用)

  // SPEC-AUTH-TIMELOCK-TUNE-AND-SPINNER-01 B: フロントの固定ロック (30秒/localStorage永続) を撤去し
  // サーバー側の指数 throttle に一本化。フロントは「認証中」スピナー + サーバーエラー表示のみ担当
  // (サーバーが待ってから 401 を返すので、その間 submitting スピナーがそのまま "待ち" を表現する)。

  const handleDigit = (n) => {
    if (submitting) return
    setSystemError(false)
    const next = [...digits, n]
    setDigits(next)
    if (next.length === 4) submitPin(next.join(''))
  }

  const handleBackspace = () => {
    if (submitting) return
    setDigits(prev => prev.slice(0, -1))
  }

  const submitPin = async (pin) => {
    setSubmitting(true)
    try {
      const result = await verifyPin(staff, pin)
      if (result.ok) {
        onSuccess(staff, result.session, result.sessionPromise)
        return
      }
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
      setDigits([])
      // 今セッションで失敗 (メッセージ表示用のみ)。失敗カウント永続 / 30秒固定ロックは廃止 —
      // 締め出しはサーバー側の指数 throttle が担う (共有端末で別スタッフに波及しない)。
      setAttemptedFail(true)
    } catch (e) {
      // LOG-SPEC-01: システムエラーは内部ログへ。失敗カウント加算しない(PIN不一致と区別)
      console.error('[PinSheet] submitPin system error:', e?.stack || e)
      setDigits([])
      setSystemError(true)
    } finally {
      setSubmitting(false)
    }
  }

  const subMsg = systemError
    ? '認証処理でエラーが発生しました'
    : attemptedFail
    ? 'PINが違うようです、もう一度'
    : 'PINを入力してください'
  const subColor = (attemptedFail || systemError) ? '#f87171' : '#94a3b8'

  return (
    <>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes pinShake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .pin-shake { animation: pinShake 200ms 2; }
        .pin-spinner {
          width: 32px; height: 32px;
          border: 3px solid #334155;
          border-top-color: #06b6d4;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        .kp-btn {
          display: flex; align-items: center; justify-content: center;
          height: 56px; border-radius: 12px;
          background: #1e293b; color: #e2e8f0;
          font-size: 22px; font-weight: 600;
          border: 1px solid #334155; cursor: pointer;
          touch-action: manipulation;
          user-select: none; -webkit-tap-highlight-color: transparent;
          -webkit-user-select: none;
        }
        .kp-btn:active { background: #334155; }
        .kp-btn:disabled { opacity: 0.35; cursor: not-allowed; }
      `}</style>

      {/* scrimタップ = 閉じる (submitting中は無効: 照合リクエスト宙吊り防止) */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 50 }}
        onClick={submitting ? undefined : onClose}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

        {/* sheet本体 */}
        <div
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            background: '#0f172a',
            borderTop: '2px solid #06b6d4',
            borderRadius: '16px 16px 0 0',
            padding: '12px 16px 32px',
            animation: 'slideUp 200ms ease-out',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* 照合中進捗オーバーレイ: submitting中のみ表示、scrim内側/sheet本体内 z-index:10 */}
          {submitting && (
            <div
              data-testid="pin-verifying-overlay"
              style={{
                position: 'absolute', inset: 0,
                background: 'rgba(15,23,42,0.85)',
                borderRadius: '16px 16px 0 0',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 12, zIndex: 10,
              }}
            >
              <div className="pin-spinner" />
              <div style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 600 }}>認証中…</div>
            </div>
          )}

          {/* grab handle */}
          <div style={{ width: 48, height: 4, background: '#334155', borderRadius: 99, margin: '0 auto 16px' }} />

          {/* ヘッダー: アバター + 名前 + × */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: avatarBg(staff.staff_id), flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: '#fff',
            }}>
              {(staff.name || '?')[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>{staff.name} さん</div>
              <div style={{ fontSize: 14, color: subColor, marginTop: 2 }}>{subMsg}</div>
            </div>
            <button
              onClick={submitting ? undefined : onClose}
              style={{ fontSize: 24, color: '#64748b', padding: '4px 8px', background: 'none', border: 'none', cursor: submitting ? 'default' : 'pointer', flexShrink: 0 }}
            >×</button>
          </div>

          {/* PIN dots */}
          <div
            className={shaking ? 'pin-shake' : ''}
            style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 20 }}
          >
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                width: 16, height: 16, borderRadius: '50%',
                background: shaking
                  ? '#ef4444'
                  : digits.length > i ? '#06b6d4' : '#1e293b',
                border: '2px solid',
                borderColor: shaking
                  ? '#ef4444'
                  : digits.length > i ? '#06b6d4' : '#334155',
                transition: 'background 0.1s',
              }} />
            ))}
          </div>

          {/* Numpad 3x4 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} data-testid={`pin-key-${n}`} className="kp-btn" onPointerDown={() => handleDigit(n)} disabled={submitting}>
                {n}
              </button>
            ))}
            {/* 空セル */}
            <div />
            <button data-testid="pin-key-0" className="kp-btn" onPointerDown={() => handleDigit(0)} disabled={submitting}>0</button>
            <button data-testid="pin-backspace" className="kp-btn" onPointerDown={handleBackspace} disabled={submitting}
              style={{ color: '#94a3b8', fontSize: 20 }}>⌫</button>
          </div>
        </div>
      </div>
    </>
  )
}
