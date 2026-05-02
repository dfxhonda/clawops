import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const TILES = [
  {
    id: 'clawsupport',
    icon: '🎯',
    title: 'クレサポ',
    desc: '巡回・集金・補充',
    path: '/patrol/overview',
    roles: ['admin', 'manager', 'patrol', 'staff'],
  },
  {
    id: 'tanasupport',
    icon: '📦',
    title: 'タナサポ',
    desc: '発注・入荷・棚卸し',
    path: '/stock/dashboard',
    roles: ['admin', 'manager'],
  },
  {
    id: 'admin',
    icon: '⚙️',
    title: '管理運営',
    desc: 'スタッフ・マスタ・統計',
    path: '/admin',
    roles: ['admin', 'manager'],
  },
]

function useTodayClawCount() {
  const [count, setCount] = useState(null)
  useEffect(() => {
    async function load() {
      const todayJST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
      const todayStart = `${todayJST}T00:00:00+09:00`
      const { count: c } = await supabase
        .from('meter_readings')
        .select('*', { count: 'exact', head: true })
        .or(`created_at.gte.${todayStart},updated_at.gte.${todayStart}`)
      setCount(c ?? 0)
    }
    load()
  }, [])
  return count
}

export default function Launcher() {
  const { staffName, staffRole } = useAuth()
  const navigate = useNavigate()
  const todayCount = useTodayClawCount()

  const now = new Date()
  const dateLabel = now.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })
  const timeLabel = now.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit',
  })

  const visibleTiles = TILES.filter(t => t.roles.includes(staffRole))

  function statusBadge(tile) {
    if (tile.id === 'clawsupport') {
      if (todayCount === null) return '読み込み中...'
      return `今日 ${todayCount} 件 記録済`
    }
    return null
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="px-4 pt-10 pb-6">
        <p className="text-slate-400 text-sm">{dateLabel}　{timeLabel}</p>
        <h1 className="text-xl font-bold mt-1">
          こんにちは、{staffName || 'ゲスト'}さん
        </h1>
      </div>

      <div className="px-4 space-y-3 pb-10">
        {visibleTiles.map(tile => {
          const badge = statusBadge(tile)
          return (
            <button
              key={tile.id}
              onClick={() => navigate(tile.path)}
              className="w-full text-left bg-slate-800 rounded-2xl p-5 border border-slate-700 active:scale-[0.98] transition-transform"
              style={{ fontSize: 16 }}
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl leading-none">{tile.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base leading-tight">{tile.title}</p>
                  <p className="text-slate-400 text-sm mt-0.5">{tile.desc}</p>
                  {badge && (
                    <p className="text-slate-500 text-xs mt-1.5">{badge}</p>
                  )}
                </div>
                <span className="text-slate-500 text-lg shrink-0">›</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
