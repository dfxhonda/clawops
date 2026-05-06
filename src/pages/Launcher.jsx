import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getVisibleTiles } from '../shared/auth/roles'
import { useRole } from '../shared/auth/useRole'
import { supabase } from '../lib/supabase'
import { logout } from '../lib/auth/session'
import DateTime from '../shared/ui/DateTime'

function useTodayCount() {
  const [count, setCount] = useState(null)
  useEffect(() => {
    const todayJST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
    const todayStart = `${todayJST}T00:00:00+09:00`
    supabase
      .from('meter_readings')
      .select('*', { count: 'exact', head: true })
      .or(`created_at.gte.${todayStart},updated_at.gte.${todayStart}`)
      .then(({ count: c }) => setCount(c ?? 0))
  }, [])
  return count
}

export default function Launcher() {
  const navigate = useNavigate()
  const { role, staffName, loading } = useRole()
  const todayCount = useTodayCount()

  async function handleLogout() {
    await logout()
    sessionStorage.removeItem('clawops_staff')
    window.location.replace('/login')
  }

  const now = new Date()

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-slate-400">読み込み中...</div>
  )
  if (!role) {
    navigate('/login')
    return null
  }

  const tiles = getVisibleTiles(role)

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="px-4 pt-10 pb-6">
        <p className="text-slate-400 text-sm"><DateTime value={now} format="date" />　<DateTime value={now} format="time" /></p>
        <h1 className="text-xl font-bold mt-1">
          こんにちは、{staffName || 'ゲスト'}さん
        </h1>
      </div>

      <div className="px-4 pb-10">
        {/* クレサポ2タイルは横並び */}
        {tiles.some(t => t.key === 'clawsupport_stable') && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {tiles.filter(t => t.key === 'clawsupport_stable' || t.key === 'clawsupport').map(tile => (
              <button
                key={tile.key}
                onClick={() => navigate(tile.path)}
                className="text-left bg-slate-800 rounded-2xl p-4 border border-slate-700 active:scale-[0.98] transition-transform"
                style={{ fontSize: 16 }}
              >
                <span className="text-2xl leading-none">{tile.emoji}</span>
                <div className="mt-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-bold text-sm leading-tight">{tile.label}</p>
                    {tile.badge && (
                      <span className="text-xs text-emerald-400 font-bold">{tile.badge}</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5 leading-snug">{tile.desc}</p>
                  {tile.key === 'clawsupport_stable' && (
                    <p className="text-slate-500 text-xs mt-1">
                      {todayCount === null ? '...' : `今日 ${todayCount} 件`}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* その他タイル */}
        <div className="space-y-3">
          {tiles.filter(t => t.key !== 'clawsupport_stable' && t.key !== 'clawsupport').map(tile => (
            <button
              key={tile.key}
              onClick={() => navigate(tile.path)}
              className="w-full text-left bg-slate-800 rounded-2xl p-5 border border-slate-700 active:scale-[0.98] transition-transform"
              style={{ fontSize: 16 }}
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl leading-none">{tile.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base leading-tight">{tile.label}</p>
                  <p className="text-slate-400 text-sm mt-0.5">{tile.desc}</p>
                </div>
                <span className="text-slate-500 text-lg shrink-0">›</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-8 flex justify-center">
        <button
          onClick={handleLogout}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors px-4 py-2"
        >
          ログアウト
        </button>
      </div>
    </div>
  )
}
