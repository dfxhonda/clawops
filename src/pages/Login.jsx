import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { setSession } from '../lib/auth/session'

export default function Login() {
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [authenticating, setAuthenticating] = useState(false)

  useEffect(() => {
    // Supabase Auth セッションチェック
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // セッション有効 → session層へ集約
        const meta = session.user?.user_metadata || {}
        setSession({
          staffId:     meta.staff_id || '',
          staffName:   meta.name || '',
          staffRole:   meta.role || '',
          accessToken: session.access_token,
        })
        navigate('/')
        return
      }
      // 未ログイン → スタッフ一覧取得（staff_publicビュー経由、PINは含まない）
      loadStaffList()
    })
  }, [])

  async function loadStaffList() {
    try {
      const { data, error: err } = await supabase
        .from('staff_public')
        .select('staff_id, name, has_pin')
        .eq('is_active', true)
        .order('name')
      if (err) throw err
      setStaff(data || [])
    } catch {
      setError('サーバーに接続できません。通信状態を確認してください。')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    if (!selected) { setError('スタッフを選んでください'); return }
    setAuthenticating(true)
    setError('')

    try {
      // Edge Function でサーバー側PIN照合 + JWT発行
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-pin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ staff_id: selected, pin: pin || '' }),
        }
      )

      const result = await res.json()

      if (!res.ok || !result.session) {
        setError(result.error || '認証に失敗しました')
        setAuthenticating(false)
        return
      }

      // Supabase Auth セッションをセット
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      })

      if (sessionError) {
        console.error('Session set error:', sessionError)
        setError('セッション設定に失敗しました')
        setAuthenticating(false)
        return
      }

      // session層へ集約
      setSession({
        staffId:     result.staff.staff_id,
        staffName:   result.staff.name,
        staffRole:   result.staff.role || '',
        accessToken: result.session.access_token,
      })

      navigate('/')
    } catch (err) {
      console.error('Login error:', err)
      setError('通信エラーが発生しました。再試行してください。')
      setAuthenticating(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-surface2 rounded-2xl flex items-center justify-center text-5xl">
            🎮
          </div>
          <h1 className="text-3xl font-bold text-accent tracking-wider">ClawOps</h1>
          <p className="text-muted text-sm mt-2">巡回・棚卸し管理</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="text-left text-sm font-bold text-muted mb-2">スタッフ選択</div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {staff.map(s => (
              <button key={s.staff_id} onClick={() => { setSelected(s.staff_id); setError(''); setPin('') }}
                className={`py-3 px-2 rounded-xl text-sm font-bold transition-all border
                  ${selected === s.staff_id
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-surface2 border-border text-text hover:border-blue-500'}`}>
                {s.name}
              </button>
            ))}
          </div>

          {selected && staff.find(x => x.staff_id === selected)?.has_pin && (
            <div className="mb-4">
              <input type="password" inputMode="numeric" maxLength={6} placeholder="暗証番号"
                value={pin} onChange={e => { setPin(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-center text-lg tracking-[0.5em] text-text outline-none focus:border-blue-500" />
            </div>
          )}

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <button onClick={handleLogin} disabled={authenticating}
            className={`w-full font-bold py-4 px-6 rounded-xl transition-colors text-base
              ${authenticating ? 'bg-blue-800 text-blue-300 cursor-wait'
                : selected ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-surface2 text-muted cursor-not-allowed'}`}>
            {authenticating ? '認証中...' : 'ログイン'}
          </button>
        </div>
      </div>
    </div>
  )
}
