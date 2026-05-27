import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/ui/PageHeader'
import { getWarehouseLocations, getStocktakeStaff } from './api'

// J-STOCKTAKE-MVP-fix-01: 棚卸し個数入力の対象選択 (倉庫 / 担当者)
// 機械(booth)は READ ONLY スナップショットのため既存セッション画面に据え置き、本フロー対象外。
const TABS = [
  { key: 'warehouse', label: '倉庫', ownerType: 'location' },
  { key: 'staff',     label: '担当者', ownerType: 'staff' },
]

export default function StocktakeCountHub() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('warehouse')
  const [warehouses, setWarehouses] = useState([])
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [wh, st] = await Promise.all([getWarehouseLocations(), getStocktakeStaff()])
        if (cancelled) return
        setWarehouses(wh.filter(l => l.location_type === 'warehouse'))
        setStaffList(st)
      } catch (e) {
        if (!cancelled) setError(e.message ?? String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const rows = tab === 'warehouse'
    ? warehouses.map(l => ({ ownerType: 'location', ownerCode: l.location_id, label: l.location_name }))
    : staffList.map(s => ({ ownerType: 'staff', ownerCode: s.staff_id, label: s.name }))

  function openTarget(row) {
    navigate(
      `/tanasupport/stocktake/count/${row.ownerType}/${encodeURIComponent(row.ownerCode)}`,
      { state: { label: row.label } },
    )
  }

  return (
    <div className="h-dvh flex flex-col bg-bg text-text" data-testid="stocktake-count-hub">
      <PageHeader
        module="tanasupport"
        title="棚卸し 個数入力"
        subtitle="対象を選んでください"
        onBack={() => navigate('/tanasupport/stocktake')}
      />

      <div className="flex border-b border-border shrink-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`stocktake-tab-${t.key}`}
            className={`flex-1 py-3 text-base font-bold transition-colors ${
              tab === t.key ? 'text-accent border-b-2 border-accent' : 'text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading && <p className="text-center text-muted text-base py-12">読み込み中...</p>}
        {error && <p className="text-center text-rose-400 text-base py-12">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="text-center text-muted text-base py-12">対象がありません</p>
        )}
        {rows.map(row => (
          <button
            key={`${row.ownerType}:${row.ownerCode}`}
            onClick={() => openTarget(row)}
            data-testid={`stocktake-target-${row.ownerCode}`}
            className="w-full min-h-[56px] flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-surface text-left active:scale-[0.98] transition-all"
          >
            <span className="flex-1 text-base font-semibold">{row.label}</span>
            <span className="text-muted text-xl">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
