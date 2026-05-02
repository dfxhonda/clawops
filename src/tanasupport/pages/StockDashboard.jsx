import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getPrizeStocksExtended } from '../../services/inventory'

const MIN_THRESHOLD = 3 // min_threshold は DB 未定義のためローカル定数で代替

const TABS = [
  { key: 'warehouse', label: '倉庫' },
  { key: 'store',     label: '店舗' },
  { key: 'staff',     label: 'スタッフ' },
]

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

export default function StockDashboard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('warehouse')
  const [stocks, setStocks] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      getPrizeStocksExtended(true),
      supabase.from('locations').select('location_id, location_name, location_type').eq('is_active', true),
    ]).then(([stockData, { data: locData }]) => {
      setStocks(stockData)
      setLocations(locData ?? [])
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  function getOwnerLabel(ownerType, ownerId) {
    if (ownerType === 'location') {
      return locations.find(l => l.location_id === ownerId)?.location_name ?? ownerId
    }
    return `スタッフ: ${ownerId}`
  }

  function filteredStocks() {
    if (tab === 'warehouse') {
      const warehouseIds = new Set(locations.filter(l => l.location_type === 'warehouse').map(l => l.location_id))
      return stocks.filter(s => s.owner_type === 'location' && warehouseIds.has(s.owner_id))
    }
    if (tab === 'store') {
      const storeIds = new Set(locations.filter(l => l.location_type === 'store').map(l => l.location_id))
      return stocks.filter(s => s.owner_type === 'location' && storeIds.has(s.owner_id))
    }
    return stocks.filter(s => s.owner_type === 'staff')
  }

  const rows = filteredStocks()
  const alertCount = rows.filter(s => s.quantity < MIN_THRESHOLD).length

  return (
    <div className="h-dvh flex flex-col bg-bg text-text">

      {/* ヘッダー */}
      <div className="shrink-0 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-muted text-xl leading-none">‹</button>
        <div className="flex-1 font-bold text-base">在庫管理</div>
        {alertCount > 0 && (
          <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">
            要補充 {alertCount}
          </span>
        )}
        <button
          onClick={() => navigate('/stock/move')}
          className="h-8 px-3 rounded-xl bg-surface border border-border text-[11px] font-bold text-muted active:bg-surface2"
        >
          移動
        </button>
        <button
          onClick={() => navigate('/stock/count')}
          className="h-8 px-3 rounded-xl bg-surface border border-border text-[11px] font-bold text-muted active:bg-surface2"
        >
          棚卸し
        </button>
      </div>

      {/* タブ */}
      <div className="shrink-0 flex rounded-none border-b border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors
              ${tab === t.key ? 'border-b-2 border-accent text-text' : 'text-muted'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-32 text-muted text-sm">読み込み中...</div>
        )}
        {error && (
          <div className="m-4 px-3 py-2 rounded-lg bg-red-900/30 border border-red-700/50 text-red-400 text-xs">{error}</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted text-sm">在庫データなし</div>
        )}
        {!loading && rows.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-[10px]">
                <th className="px-3 py-2 text-left font-normal">景品</th>
                <th className="px-3 py-2 text-left font-normal">場所</th>
                <th className="px-3 py-2 text-right font-normal">数量</th>
                <th className="px-3 py-2 text-right font-normal">最終確認</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => {
                const alert = s.quantity < MIN_THRESHOLD
                return (
                  <tr key={s.stock_id} className={`border-b border-border/50 ${alert ? 'bg-red-900/10' : ''}`}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {alert && <span className="text-red-400 text-[10px] font-bold">!</span>}
                        <span className={alert ? 'text-red-300' : ''}>{s.prize_name || s.prize_id}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted text-xs">{getOwnerLabel(s.owner_type, s.owner_id)}</td>
                    <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${alert ? 'text-red-400' : ''}`}>
                      {s.quantity}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted text-xs">{formatDate(s.last_counted_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
