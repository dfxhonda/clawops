// J-INFRA-DUAL-TRACK-LOGIN-01 — ログイン直後に安定版/テスト版を選ぶ画面
// OPS-DUAL-TRACK-CHARTER-V1 R1/R2 準拠。テスト版は VITE_TEST_TRACK_URL の別デプロイ。
// 安定版コードにテスト版は乗らない。tokenを URL params で引き継ぎ再ログイン不要。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TEST_TRACK_URL = import.meta.env.VITE_TEST_TRACK_URL

export default function DualTrackSelectPage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  // 防御: テスト版URL未設定なら選択画面を出さず安定版へ直行
  useEffect(() => {
    if (!TEST_TRACK_URL) navigate('/launcher', { replace: true })
  }, [navigate])

  function goStable() {
    navigate('/launcher', { replace: true })
  }

  async function goTest() {
    if (busy) return
    setBusy(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      // セッションが無ければテスト版に渡せないので安定版へ
      navigate('/launcher', { replace: true })
      return
    }
    const url = new URL(TEST_TRACK_URL)
    url.searchParams.set('access_token', session.access_token)
    url.searchParams.set('refresh_token', session.refresh_token)
    window.location.href = url.toString()
  }

  if (!TEST_TRACK_URL) return null

  const btnBase = {
    width: '100%',
    minHeight: 56,
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0f', color: '#e8e8f0', fontFamily: "-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN',sans-serif" }}>
      <div style={{ flexShrink: 0, padding: '24px 16px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, lineHeight: 1 }}>🎮</div>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, marginTop: 4 }}>Round 0</div>
        <div style={{ fontSize: 13, color: '#9090a8', marginTop: 6 }}>どちらを使いますか</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, padding: '0 20px', maxWidth: 480, width: '100%', margin: '0 auto' }}>
        <button
          type="button"
          onClick={goStable}
          disabled={busy}
          style={{
            ...btnBase,
            background: '#f0c040',
            color: '#1a1a1a',
            border: 'none',
            opacity: busy ? 0.6 : 1,
          }}
        >
          安定版で続ける
        </button>

        <button
          type="button"
          onClick={goTest}
          disabled={busy}
          style={{
            ...btnBase,
            background: 'transparent',
            color: '#e8e8f0',
            border: '2px solid #3a3a4a',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? '移動中...' : 'テスト版を使う'}
        </button>

        <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 4, lineHeight: 1.6 }}>
          テスト版はお試し用です<br />
          メニューに戻れば安定版に切り替えできます
        </div>
      </div>
    </div>
  )
}
