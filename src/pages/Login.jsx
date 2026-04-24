// ============================================
// Login: PIN認証ログインフォーム (案D: 50音インデックス型)
// verify-pin Edge Function → supabase.auth.setSession → /
// ============================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const LAST_LOGIN_KEY = 'round0_last_login_staff_id'

const ROW_KEYS = ['ア', 'カ', 'サ', 'タ', 'ナ', 'ハ', 'マ', 'ヤ', 'ラ', 'ワ']
const ROW_CHARS = {
  ア: ['ア','イ','ウ','エ','オ'],
  カ: ['カ','キ','ク','ケ','コ','ガ','ギ','グ','ゲ','ゴ'],
  サ: ['サ','シ','ス','セ','ソ','ザ','ジ','ズ','ゼ','ゾ'],
  タ: ['タ','チ','ツ','テ','ト','ダ','ヂ','ヅ','デ','ド'],
  ナ: ['ナ','ニ','ヌ','ネ','ノ'],
  ハ: ['ハ','ヒ','フ','ヘ','ホ','バ','ビ','ブ','ベ','ボ','パ','ピ','プ','ペ','ポ'],
  マ: ['マ','ミ','ム','メ','モ'],
  ヤ: ['ヤ','ユ','ヨ'],
  ラ: ['ラ','リ','ル','レ','ロ'],
  ワ: ['ワ','ヲ','ン'],
}

function getKanaRow(kana) {
  if (!kana) return null
  const first = kana[0]
  for (const [row, chars] of Object.entries(ROW_CHARS)) {
    if (chars.includes(first)) return row
  }
  return null
}

export default function Login() {
  const navigate = useNavigate()
  const [staffList,    setStaffList]    = useState([])
  const [selectedRow,  setSelectedRow]  = useState('ハ')
  const [selectedStaff, setSelectedStaff] = useState(null) // { staff_id, name, has_pin }
  const [pin,          setPin]          = useState('')
  const [msg,          setMsg]          = useState({ text: '', err: false })
  const [initDone,     setInitDone]     = useState(false)
  const [busy,         setBusy]         = useState(false)
  const [view,         setView]         = useState('select') // 'select' | 'pin'
  const [lastStaffId,  setLastStaffId]  = useState(null)
  const [showShortcut, setShowShortcut] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem(LAST_LOGIN_KEY)
    if (saved) setLastStaffId(saved)

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { navigate('/', { replace: true }); return }

      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/staff_public?select=staff_id,name,name_kana,has_pin&is_active=eq.true&name_kana=not.is.null&order=name_kana`,
          { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
        )
        if (res.ok) {
          const list = await res.json()
          setStaffList(list)
          // 前回ログインのスタッフが属する行を初期選択
          if (saved) {
            const prev = list.find(s => s.staff_id === saved)
            if (prev?.name_kana) {
              const row = getKanaRow(prev.name_kana)
              if (row) setSelectedRow(row)
            }
          } else if (list.length > 0) {
            // 最初に人がいる行を選択
            for (const row of ROW_KEYS) {
              const hasMembers = list.some(s => getKanaRow(s.name_kana) === row)
              if (hasMembers) { setSelectedRow(row); break }
            }
          }
        } else {
          setMsg({ text: 'スタッフ一覧の取得に失敗しました', err: true })
        }
      } catch (e) {
        setMsg({ text: '通信エラー: ' + e.message, err: true })
      }
      setInitDone(true)
    }
    init()
  }, [navigate])

  function onSelectStaff(staff) {
    setSelectedStaff(staff)
    setPin('')
    setMsg({ text: '', err: false })
    setView('pin')
  }

  function onBack() {
    setView('select')
    setSelectedStaff(null)
    setPin('')
    setMsg({ text: '', err: false })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedStaff) return
    if (pin.length < 4) { setMsg({ text: '暗証番号は4桁以上で入力してください', err: true }); return }

    setBusy(true)
    setMsg({ text: '認証中...', err: false })
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: selectedStaff.staff_id, pin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ text: data.error || '認証に失敗しました', err: true })
        setBusy(false)
        return
      }

      localStorage.setItem(LAST_LOGIN_KEY, selectedStaff.staff_id)
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

  if (!initDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const rowCounts = Object.fromEntries(
    ROW_KEYS.map(row => [row, staffList.filter(s => getKanaRow(s.name_kana) === row).length])
  )
  const rowStaff = staffList.filter(s => getKanaRow(s.name_kana) === selectedRow)
  const lastStaff = showShortcut && lastStaffId ? staffList.find(s => s.staff_id === lastStaffId) : null

  if (view === 'pin' && selectedStaff) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif" }}>
        <div className="w-full max-w-xs">
          <div className="text-center mb-8">
            <div className="text-4xl mb-2">🎮</div>
            <div className="text-lg font-bold text-gray-100">{selectedStaff.name}</div>
            <div className="text-xs text-gray-400 mt-1">暗証番号を入力してください</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder={selectedStaff.has_pin ? '暗証番号を入力' : '好きな番号を決めてください（4桁以上）'}
              autoFocus
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white text-base outline-none focus:border-cyan-500 text-center tracking-widest"
            />
            <button
              type="submit"
              disabled={pin.length < 4 || busy}
              className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-sm transition-colors"
            >
              {busy ? '認証中...' : 'ログイン'}
            </button>
          </form>

          {msg.text && (
            <p className={`text-xs text-center mt-3 ${msg.err ? 'text-red-400' : 'text-green-400'}`}>
              {msg.text}
            </p>
          )}

          <button onClick={onBack} className="w-full mt-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-gray-300 text-sm hover:border-slate-500 transition-colors">
            ← 選択に戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif" }}>
      {/* ヘッダー */}
      <div className="px-4 pt-8 pb-4 text-center">
        <div className="text-3xl mb-1">🎮</div>
        <h1 className="text-xl font-bold tracking-wide">Round 0</h1>
        <p className="text-xs text-gray-400 mt-1">自分の名前を選んでください</p>
      </div>

      <div className="flex-1 px-4 pb-8 max-w-sm mx-auto w-full">
        {/* 前回ショートカット */}
        {lastStaff && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">前回このスマホを使った人</span>
              <button onClick={() => setShowShortcut(false)} className="text-[10px] text-gray-500 hover:text-gray-300">
                違う人
              </button>
            </div>
            <button
              onClick={() => onSelectStaff(lastStaff)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-cyan-950 border border-cyan-700 hover:border-cyan-500 transition-colors text-left"
            >
              <span className="text-2xl">👤</span>
              <div>
                <div className="text-sm font-bold text-cyan-200">{lastStaff.name}</div>
                <div className="text-[10px] text-cyan-600 mt-0.5">タップでPIN入力へ</div>
              </div>
            </button>
          </div>
        )}

        {/* 50音タブ */}
        <div className="flex gap-1 mb-3 overflow-x-auto pb-0.5">
          {ROW_KEYS.map(row => {
            const count = rowCounts[row] ?? 0
            const isActive = row === selectedRow
            const isEmpty = count === 0
            return (
              <button
                key={row}
                onClick={() => !isEmpty && setSelectedRow(row)}
                disabled={isEmpty}
                className={[
                  'flex-shrink-0 w-9 rounded-lg flex flex-col items-center py-1.5 transition-colors text-[10px] font-bold',
                  isActive
                    ? 'bg-cyan-600 text-white border border-cyan-500'
                    : isEmpty
                    ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                    : 'bg-slate-800 text-gray-300 border border-slate-600 hover:border-slate-400',
                ].join(' ')}
              >
                <span className="text-sm leading-none">{row}</span>
                {!isEmpty && (
                  <span className={`text-[9px] mt-0.5 ${isActive ? 'text-cyan-200' : 'text-gray-400'}`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* スタッフリスト */}
        <div className="space-y-1.5">
          {rowStaff.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-xs">この行にスタッフはいません</div>
          ) : (
            rowStaff.map(staff => (
              <button
                key={staff.staff_id}
                onClick={() => onSelectStaff(staff)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 hover:border-slate-400 active:scale-[0.98] transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">👤</span>
                  <span className="text-sm font-semibold text-gray-100">{staff.name}</span>
                </div>
                <span className="text-gray-400 text-lg">›</span>
              </button>
            ))
          )}
        </div>

        {msg.text && (
          <p className={`text-xs text-center mt-4 ${msg.err ? 'text-red-400' : 'text-green-400'}`}>
            {msg.text}
          </p>
        )}

        {/* フッター */}
        <div className="mt-8 text-center">
          <p className="text-[11px] text-gray-500">
            自分の名前がない場合は{' '}
            <span className="text-cyan-500">管理者に連絡してください</span>
          </p>
        </div>
      </div>
    </div>
  )
}
