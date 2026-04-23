// ============================================
// Login: PIN認証ログインフォーム
// verify-pin Edge Function → supabase.auth.setSession → /
// ============================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function Login() {
  const navigate = useNavigate()
  const [staffList, setStaffList] = useState([])
  const [staffId,   setStaffId]   = useState('')
  const [pin,       setPin]       = useState('')
  const [hasPin,    setHasPin]    = useState(false)
  const [msg,       setMsg]       = useState({ text: '', err: false })
  const [initDone,  setInitDone]  = useState(false)
  const [busy,      setBusy]      = useState(false)

  useEffect(() => {
    async function init() {
      // 既存セッションがあればそのままホームへ
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { navigate('/', { replace: true }); return }

      // スタッフ一覧取得
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/staff_public?select=staff_id,name,has_pin&is_active=eq.true&order=staff_id`,
          { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
        )
        if (res.ok) setStaffList(await res.json())
        else setMsg({ text: 'スタッフ一覧の取得に失敗しました', err: true })
      } catch (e) {
        setMsg({ text: '通信エラー: ' + e.message, err: true })
      }
      setInitDone(true)
    }
    init()
  }, [navigate])

  function onStaffChange(id) {
    setStaffId(id)
    setPin('')
    setMsg({ text: '', err: false })
    const s = staffList.find(s => s.staff_id === id)
    setHasPin(!!s?.has_pin)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!staffId) { setMsg({ text: 'スタッフを選択してください', err: true }); return }
    if (pin.length < 4) { setMsg({ text: '暗証番号は4桁以上で入力してください', err: true }); return }

    setBusy(true)
    setMsg({ text: '認証中...', err: false })
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId, pin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ text: data.error || '認証に失敗しました', err: true })
        setBusy(false)
        return
      }

      // React SDK にセッションを設定（localStorage も SDK が書き込む）
      await supabase.auth.setSession({
        access_token:  data.session.access_token,
        refresh_token: data.session.refresh_token,
      })

      navigate('/', { replace: true })
    } catch (e) {
      setMsg({ text: '通信エラー: ' + e.message, err: true })
      setBusy(false)
    }
  }

  // セッション確認中スピナー
  if (!initDone) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  const S = {
    page:  { minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#0f0f13', color: '#e8e8f0', fontFamily: "-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif" },
    box:   { width: '100%', maxWidth: 320, background: '#1a1a23', border: '1px solid #2e2e3e', borderRadius: 8, padding: 24, marginBottom: 20 },
    label: { display: 'block', fontSize: 12, color: '#9090a8', fontWeight: 700, marginBottom: 5 },
    input: { width: '100%', background: '#22222e', border: '1px solid #2e2e3e', borderRadius: 8, padding: '10px 12px', color: '#e8e8f0', fontSize: 15, outline: 'none', fontFamily: 'inherit' },
    btn:   { width: '100%', padding: 11, borderRadius: 8, background: '#7c6aff', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44, marginTop: 4 },
  }

  return (
    <div style={S.page}>
      <div style={{ fontSize: 48, marginBottom: 6 }}>🎮</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>Round 0</h1>
      <p style={{ fontSize: 13, color: '#9090a8', marginBottom: 32 }}>クレーンゲーム運営管理システム</p>

      <form onSubmit={handleSubmit} style={S.box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>ログイン</h2>

        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>スタッフ</label>
          <select
            value={staffId}
            onChange={e => onStaffChange(e.target.value)}
            style={{ ...S.input, colorScheme: 'dark' }}
          >
            <option value="">-- 選択してください --</option>
            {staffList.map(s => (
              <option key={s.staff_id} value={s.staff_id}>{s.name}</option>
            ))}
          </select>
        </div>

        {staffId && (
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>
              {hasPin ? '暗証番号' : '暗証番号を設定（4桁以上）'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder={hasPin ? '暗証番号を入力' : '好きな番号を決めてください'}
              autoFocus
              style={S.input}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={!staffId || busy}
          style={{ ...S.btn, opacity: (!staffId || busy) ? 0.5 : 1 }}
        >
          {busy ? '認証中...' : 'ログイン'}
        </button>

        {msg.text && (
          <p style={{ fontSize: 12, textAlign: 'center', marginTop: 10, minHeight: 18, color: msg.err ? '#e74c3c' : '#2ecc71' }}>
            {msg.text}
          </p>
        )}
      </form>
    </div>
  )
}
