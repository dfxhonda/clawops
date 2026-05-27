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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0f', color: '#e8e8f0', fontFamily: "-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN',sans-serif" }}>
      <div style={{ flexShrink: 0, padding: '28px 16px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, lineHeight: 1 }}>🎮</div>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, marginTop: 4 }}>Round 0</div>
        <div style={{ fontSize: 13, color: '#9090a8', marginTop: 6 }}>どちらを使いますか</div>
      </div>

      {/* 主要アクション: 安定版 — 大きく画面中央 primary。バイトは基本これだけ押す */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px', maxWidth: 480, width: '100%', margin: '0 auto' }}>
        <button
          type="button"
          onClick={goStable}
          disabled={busy}
          data-testid="select-stable"
          style={{
            width: '100%', minHeight: 72, borderRadius: 18,
            fontSize: 19, fontWeight: 800,
            background: '#f0c040', color: '#1a1a1a', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: busy ? 0.6 : 1,
          }}
        >
          安定版で続ける
        </button>
        <div style={{ fontSize: 12, color: '#9090a8', textAlign: 'center', marginTop: 10 }}>
          通常はこちら
        </div>
      </div>

      {/* 副次アクション: テスト版 — 画面下部に離して小さく ghost。誤操作しにくい配置 */}
      <div style={{ flexShrink: 0, padding: '12px 20px calc(18px + env(safe-area-inset-bottom))', textAlign: 'center' }}>
        <button
          type="button"
          onClick={goTest}
          disabled={busy}
          data-testid="select-test"
          style={{
            minHeight: 36, padding: '0 18px', borderRadius: 9,
            fontSize: 13, fontWeight: 600,
            background: 'transparent', color: '#7a7a90',
            border: '1px solid #2a2a3a', cursor: 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? '移動中...' : 'テスト版を使う'}
        </button>
        <div style={{ fontSize: 10, color: '#54546a', marginTop: 8, lineHeight: 1.6 }}>
          テスト版はお試し用 / メニューに戻れば安定版に切替できます
        </div>
      </div>
    </div>
  )
}
