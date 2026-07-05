// SPEC-ADMIN-FORECAST-CYCLE-S2-UI-01: 集金サイクル売上着地予測 店舗一覧
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/ui/PageHeader'
import ErrorDisplay from '../../components/ErrorDisplay'
import { getForecastStoreList } from '../../services/forecast'
import { getAllStores } from '../../services/masters'
import { fmtYen } from '../../utils/format'
import { formatJstDate } from '../../admin/lib/jstDate'

export default function ForecastList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [storeNames, setStoreNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const [list, stores] = await Promise.all([getForecastStoreList(), getAllStores()])
      setRows(list)
      setStoreNames(Object.fromEntries(stores.map(s => [s.store_code, s.store_name])))
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.projected_landing ?? -Infinity) - (a.projected_landing ?? -Infinity)),
    [rows]
  )

  const totals = useMemo(() => {
    const withData = rows.filter(r => r.ctd_revenue != null)
    return {
      ctd: withData.reduce((s, r) => s + Number(r.ctd_revenue), 0),
      projected: withData.reduce((s, r) => s + Number(r.projected_landing ?? 0), 0),
      count: withData.length,
    }
  }, [rows])

  return (
    <div className="h-svh flex flex-col max-w-lg md:max-w-3xl mx-auto">
      <PageHeader module="admin" hideHome={true} title="売上予測" onBack={() => navigate('/admin')} />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {error && <ErrorDisplay error={error} onRetry={load} onDismiss={() => setError(null)} />}

        {/* 全店合計 */}
        <div className="bg-surface border border-border rounded-xl px-3 py-2.5" data-testid="forecast-totals-header">
          <p className="text-xs text-muted mb-1">全店合計 ({totals.count}店舗)</p>
          <div className="flex items-center justify-between font-mono">
            <div>
              <span className="text-muted text-xs mr-1">着地累計</span>
              <span className="text-base font-bold">{fmtYen(totals.ctd)}</span>
            </div>
            <div>
              <span className="text-muted text-xs mr-1">着地予測</span>
              <span className="text-base font-bold text-accent">{fmtYen(totals.projected)}</span>
            </div>
          </div>
        </div>

        {loading && <p className="text-center text-muted text-sm py-8">読み込み中...</p>}

        {!loading && sorted.length === 0 && (
          <p className="text-center text-muted text-sm py-8">店舗データがありません</p>
        )}

        {!loading && sorted.map(row => {
          const noOrigin = row.origin_source === 'none'
          return (
            <button
              key={row.store_code}
              type="button"
              data-testid={`forecast-store-row-${row.store_code}`}
              onClick={() => navigate(`/admin/forecast/${row.store_code}`)}
              className={`w-full text-left border rounded-xl p-3 transition-all active:scale-[0.98] ${
                noOrigin ? 'border-border bg-surface/40 opacity-60' : 'border-border bg-surface hover:border-accent/40'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <p className="font-bold text-sm truncate">{storeNames[row.store_code] ?? row.store_code}</p>
                <span className="text-[10px] font-mono text-muted">{row.store_code}</span>
              </div>

              {noOrigin ? (
                <p className="text-xs text-accent">集金記録・開始日ともに未設定 — タップして開始日を設定</p>
              ) : (
                <>
                  <p className="text-xs text-muted mb-1.5">
                    {formatJstDate(row.cycle_start)} 〜 {formatJstDate(row.next_collection)}
                    <span className="ml-2">残り{row.days_remaining ?? '—'}日</span>
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                    <span className="text-muted">着地累計</span>
                    <span className="text-right">{fmtYen(row.ctd_revenue)}</span>
                    <span className="text-muted">着地予測</span>
                    <span className="text-right text-accent font-bold">{fmtYen(row.projected_landing)}</span>
                  </div>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
