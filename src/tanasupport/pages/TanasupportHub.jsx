import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MODULE_COLOR = '#10b981'

function StatCard({ label, count, sub, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 bg-surface rounded-2xl p-4 border border-border text-left active:scale-[0.97] transition-transform"
      style={{ fontSize: 16 }}
    >
      <p className={`text-2xl font-bold ${color}`}>{count ?? '…'}</p>
      <p className="text-text text-sm font-medium mt-0.5">{label}</p>
      {sub && <p className="text-muted text-xs mt-0.5">{sub}</p>}
    </button>
  )
}

export default function TanasupportHub() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function load() {
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
      const [{ count: shipped }, { count: ordered }, { count: overdue }, { count: arrived }] =
        await Promise.all([
          supabase.from('prize_orders').select('*', { count: 'exact', head: true }).eq('status', 'shipped'),
          supabase.from('prize_orders').select('*', { count: 'exact', head: true }).eq('status', 'ordered'),
          supabase.from('prize_orders').select('*', { count: 'exact', head: true }).eq('status', 'ordered').lt('expected_date', today),
          supabase.from('prize_orders').select('*', { count: 'exact', head: true }).eq('status', 'arrived'),
        ])
      setStats({ shipped: shipped ?? 0, ordered: ordered ?? 0, overdue: overdue ?? 0, arrived: arrived ?? 0 })
    }
    load()
  }, [])

  const dateLabel = new Date().toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })

  return (
    <div className="min-h-screen bg-bg text-text">

      {/* Header */}
      <div
        className="px-5 pt-10 pb-4"
        style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: MODULE_COLOR }}
      >
        <button onClick={() => navigate('/')} className="text-muted text-sm mb-4">← ランチャー</button>
        <p className="text-muted text-sm">{dateLabel}</p>
        <h1 className="text-xl font-bold mt-0.5 text-text">📦 タナサポ</h1>
      </div>

      {/* Stats */}
      <div className="px-5 flex gap-3 mb-4">
        <StatCard
          label="入荷待ち"
          count={stats?.shipped}
          color="text-rose-400"
          onClick={() => navigate('/tanasupport/orders?tab=shipped')}
        />
        <StatCard
          label="発注中"
          count={stats?.ordered}
          sub={stats?.overdue ? `遅延 ${stats.overdue}件` : undefined}
          color="text-amber-400"
          onClick={() => navigate('/tanasupport/orders?tab=ordered')}
        />
        <StatCard
          label="入荷済み"
          count={stats?.arrived}
          color="text-emerald-400"
          onClick={() => navigate('/tanasupport/orders?tab=arrived')}
        />
      </div>

      {/* Quick actions */}
      <div className="px-5 space-y-3 pb-10">
        <button
          onClick={() => navigate('/tanasupport/orders?tab=shipped')}
          className="w-full bg-surface border border-border rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
          style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#f43f5e', fontSize: 16 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-rose-300 font-bold">入荷チェック</p>
              <p className="text-muted text-sm mt-0.5">届いた荷物を受取済みにする</p>
            </div>
            <span className="text-muted/50 text-lg">›</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/tanasupport/orders?tab=ordered')}
          className="w-full bg-surface border border-border rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
          style={{ fontSize: 16 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text font-bold">発注一覧</p>
              <p className="text-muted text-sm mt-0.5">発注中・到着待ちを確認する</p>
            </div>
            <span className="text-muted/50 text-lg">›</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/stock/dashboard')}
          className="w-full bg-surface border border-border rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
          style={{ fontSize: 16 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text font-bold">棚卸し・在庫管理</p>
              <p className="text-muted text-sm mt-0.5">在庫確認・棚卸しカウント</p>
            </div>
            <span className="text-muted/50 text-lg">›</span>
          </div>
        </button>
      </div>
    </div>
  )
}
