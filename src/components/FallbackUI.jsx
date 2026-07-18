import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const ERROR_CODE = 'ERR-UNKNOWN-001'

export default function FallbackUI({ error, resetErrorBoundary }) {
  const navigate = useNavigate()
  const [showDetail, setShowDetail] = useState(false)
  const isDev = import.meta.env.DEV
  const timestamp = new Date().toISOString()

  return (
    <div style={{
      minHeight: '100svh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8f9fa',
      padding: '24px',
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
        padding: '32px 28px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>&#9888;</div>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 700,
          color: '#1a1a1a',
          marginBottom: '8px',
          margin: '0 0 8px 0',
        }}>
          画面を表示できませんでした
        </h2>
        <p style={{
          fontSize: '14px',
          color: '#555',
          marginBottom: '16px',
          margin: '0 0 16px 0',
        }}>
          一時的な問題が発生した可能性があります
        </p>
        <p style={{
          fontSize: '12px',
          color: '#999',
          marginBottom: '24px',
          fontFamily: 'monospace',
          margin: '0 0 24px 0',
        }}>
          {ERROR_CODE}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* SPEC-DEBUG-LOGS-WIRING-AND-CRASH-RESEARCH-01 (D-092) A1: 黒画面でも確実に復旧できる強制再読み込み。
              旧 chunk / 壊れた状態を hard reload で最新に置き換える。 */}
          <button
            data-testid="fallback-reload"
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#2563eb',
              color: '#fff',
              fontWeight: 700,
              fontSize: '15px',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 0',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            再読み込み
          </button>
          <button
            onClick={() => navigate('/')}
            style={{
              backgroundColor: '#fff',
              color: '#2563eb',
              fontWeight: 600,
              fontSize: '15px',
              border: '2px solid #2563eb',
              borderRadius: '8px',
              padding: '12px 0',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            ホームに戻る
          </button>
          <button
            onClick={resetErrorBoundary}
            style={{
              backgroundColor: '#fff',
              color: '#2563eb',
              fontWeight: 600,
              fontSize: '15px',
              border: '2px solid #2563eb',
              borderRadius: '8px',
              padding: '12px 0',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            もう一度試す
          </button>
          <button
            onClick={() => {}}
            style={{
              backgroundColor: 'transparent',
              color: '#888',
              fontWeight: 500,
              fontSize: '14px',
              border: 'none',
              padding: '8px 0',
              cursor: 'default',
              width: '100%',
            }}
          >
            エラーを送る
          </button>
        </div>

        {isDev ? (
          <div style={{ marginTop: '20px', textAlign: 'left' }}>
            <button
              onClick={() => setShowDetail((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '12px',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              {showDetail ? '詳細を隠す' : '詳細を表示'}
            </button>
            {showDetail && (
              <pre style={{
                marginTop: '8px',
                backgroundColor: '#f1f5f9',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '11px',
                color: '#333',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {error?.stack || error?.message || String(error)}
              </pre>
            )}
          </div>
        ) : (
          <p style={{
            marginTop: '20px',
            fontSize: '11px',
            color: '#bbb',
            fontFamily: 'monospace',
          }}>
            {ERROR_CODE} &mdash; {timestamp}
          </p>
        )}
      </div>
    </div>
  )
}
