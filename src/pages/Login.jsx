// ============================================
// Login: ポータル→React SPA のセッションブリッジ
// ログインUIはなし。ポータルの localStorage トークンを
// supabase.auth.setSession() で引き継ぎ、/ へ遷移する。
// ============================================
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ポータル (public/docs/config.js の AUTH_STORAGE_KEY) と同じキー
const PORTAL_STORAGE_KEY = 'sb-gedxzunoyzmvbqgwjalx-auth-token'

export default function Login() {
  const navigate = useNavigate()

  useEffect(() => {
    async function init() {
      // まず既存セッションを確認（SDK ネイティブ読み込み）
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        navigate('/patrol/overview', { replace: true })
        return
      }

      // ポータルの localStorage トークンで setSession を試みる
      try {
        const stored = JSON.parse(localStorage.getItem(PORTAL_STORAGE_KEY) || 'null')
        if (stored?.access_token && stored?.refresh_token) {
          const { data, error } = await supabase.auth.setSession({
            access_token: stored.access_token,
            refresh_token: stored.refresh_token,
          })
          if (!error && data.session) {
            navigate('/patrol/overview', { replace: true })
            return
          }
        }
      } catch (e) {
        console.warn('[Login] session bridge failed:', e)
      }

      // すべて失敗 → ポータルへ戻す
      window.location.href = '/docs/'
    }
    init()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  )
}
