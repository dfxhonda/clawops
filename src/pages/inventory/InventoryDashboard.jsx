import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLocations, getPrizeStocksExtended, getStockMovements } from '../../services/sheets'

const MENU_ITEMS = [
  { path: '/inventory/receive',  icon: '📦', label: '入庫チェック',     desc: '発注品の入荷確認' },
  { path: '/inventory/transfer', icon: '🚚', label: '在庫移管',        desc: '拠点間・担当者間の移管' },
  { path: '/inventory/count',    icon: '📋', label: '実在庫カウント',   desc: '棚卸し（実数チェック）' },
  { path: '/inventory/match',    icon: '🔍', label: '景品マッチング',   desc: 'Excelデータ照合＆仮登録' },
]

export default function InventoryDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [locations, stocks, movements] = await Promise.all([
          getLocations(), getPrizeStocksExtended(), getStockMovements()
        ])
        const staffStocks = stocks.filter(s => s.owner_type === 'staff')
        const locStocks = stocks.filter(s => s.owner_type === 'location')
        const todayMovements = movements.filter(m => m.created_at?.startsWith(new Date().toISOString().slice(0, 10)))
        setStats({
          locationCount: locations.filter(l => !l.parent_location_id).length,
          subLocationCount: locations.filter(l => l.parent_location_id).length,
          staffStockItems: staffStocks.length,
          staffStockTotal: staffStocks.reduce((s, x) => s + x.quantity, 0),
          locStockItems: locStocks.length,
          locStockTotal: locStocks.reduce((s, x) => s + x.quantity, 0),
          todayMovements: todayMovements.length,
          totalMovements: movements.length,
        })
      } catch {
        setStats(null)
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="h-screen flex flex-col bg-bg text-text max-w-lg mx-auto">
      <div className="shrink-0 p-4 pb-0">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/')} className="text-muted text-2xl">←</button>
          <h1 className="flex-1 text-xl font-bold text-accent">📦 棚卸し管理</h1>
          <button onClick={() => { sessionStorage.clear(); window.location.href = '/docs/' }}
            className="text-[10px] text-muted hover:text-accent2">ログアウト</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pt-0 pb-24">

      {/* サマリーカード */}
      {!loading && stats && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-surface border border-border rounded-xl p-3">
            <div className="text-xs text-muted mb-1">拠点在庫</div>
            <div className="text-2xl font-bold text-accent3">{stats.locStockTotal}<span className="text-xs text-muted ml-1">個</span></div>
            <div className="text-xs text-muted">{stats.locStockItems}アイテム / {stats.locationCount}拠点</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-3">
            <div className="text-xs text-muted mb-1">担当車在庫</div>
            <div className="text-2xl font-bold text-accent4">{stats.staffStockTotal}<span className="text-xs text-muted ml-1">個</span></div>
            <div className="text-xs text-muted">{stats.staffStockItems}アイテム</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-3 col-span-2">
            <div className="text-xs text-muted mb-1">在庫移動</div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-accent">{stats.todayMovements}<span className="text-xs text-muted ml-1">件/今日</span></span>
              <span className="text-sm text-muted">累計 {stats.totalMovements}件</span>
            </div>
          </div>
        </div>
      )}
      {loading && (
        <div className="text-center text-muted py-8 text-sm">読み込み中...</div>
      )}

      {/* メニュー */}
      <div className="space-y-3">
        {MENU_ITEMS.map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="w-full bg-surface border border-border rounded-xl p-4 flex items-center gap-4 text-left active:bg-surface2 transition-colors">
            <span className="text-3xl">{item.icon}</span>
            <div>
              <div className="font-bold text-text">{item.label}</div>
              <div className="text-xs text-muted">{item.desc}</div>
            </div>
            <span className="ml-auto text-muted">→</span>
          </button>
        ))}
      </div>
      </div>{/* スクロール領域終了 */}
    </div>
  )
}
