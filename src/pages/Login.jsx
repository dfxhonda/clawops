import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 既にログイン済みならトップへ（gapi_tokenも確認してループ防止）
    const staffId = sessionStorage.getItem('clawops_staff_id')
    if (staffId) {
      // gapi_tokenがなければ補完（ポータル経由でstaffIdだけある場合）
      if (!sessionStorage.getItem('gapi_token')) {
        sessionStorage.setItem('gapi_token', 'supabase_auth_' + staffId)
      }
      navigate('/'); return
    }
    // スタッフ一覧取得
    supabase.from('staff').select('staff_id, name, pin').eq('is_active', true).order('name')
      .then(({ data, error: err }) => {
        if (err) setError('サーバーに接続できません。通信状態を確認してください。')
        setStaff(data || []); setLoading(false)
      })
      .catch(() => { setError('サーバーに接続できません'); setLoading(false) })
  }, [])

  function handleLogin() {
    if (!selected) { setError('スタッフを選んでください'); return }
    const s = staff.find(x => x.staff_id === selected)
    // PINが設定されていればチェック、未設定ならスキップ
    if (s.pin && s.pin !== pin) { setError('暗証番号が違います'); return }
    // ログイン成功: sessionStorageにスタッフ情報を保存
    sessionStorage.setItem('clawops_staff_id', s.staff_id)
    sessionStorage.setItem('clawops_staff_name', s.name)
    // sheets.jsのgetToken()互換: ダミートークンをセット（OAuth不要だが既存コードの認証チェック用）
    sessionStorage.setItem('gapi_token', 'supabase_auth_' + s.staff_id)
    navigate('/')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" />
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

          {selected && staff.find(x => x.staff_id === selected)?.pin && (
            <div className="mb-4">
              <input type="password" inputMode="numeric" maxLength={6} placeholder="暗証番号"
                value={pin} onChange={e => { setPin(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-center text-lg tracking-[0.5em] text-text outline-none focus:border-blue-500" />
            </div>
          )}

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <button onClick={handleLogin}
            className={`w-full font-bold py-4 px-6 rounded-xl transition-colors text-base
              ${selected ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-surface2 text-muted cursor-not-allowed'}`}>
            ログイン
          </button>
        </div>
      </div>
    </div>
  )
}
