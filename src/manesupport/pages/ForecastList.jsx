// SPEC-ADMIN-FORECAST-CYCLE-S2-UI-01: 集金サイクル売上着地予測 店舗一覧
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrackPageUsage } from '../../hooks/useTrackPageUsage'
import { PAGE_KEY } from '../../constants/pageKeys'
import LandscapeSideHeader from '../../components/LandscapeSideHeader'
import ErrorDisplay from '../../components/ErrorDisplay'
import { getForecastStoreList } from '../../services/forecast'
import { s1gBadge } from '../lib/s1gStatus'
import { getAllStores } from '../../services/masters'
import { fmtYen } from '../../utils/format'
import { formatJstDate } from '../../admin/lib/jstDate'

export default function ForecastList() {
  useTrackPageUsage(PAGE_KEY.FORECAST) // SPEC-ANALYTICS-USAGE-SORT-W1-01 (D-068)
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
    <div className="h-svh flex flex-col landscape-short:flex-row max-w-lg md:max-w-3xl mx-auto">
      <LandscapeSideHeader module="admin" hideHome={true} title="売上予測" onBack={() => navigate('/admin')} />

      <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-3 list-scroll">
        {error && <ErrorDisplay error={error} onRetry={load} onDismiss={() => setError(null)} />}

        {/* 全店合計 */}
        <div className="bg-surface border border-border rounded-xl px-3 py-2.5" data-testid="forecast-totals-header">
          <p className="text-xs text-muted mb-1">全店合計 ({totals.count}店舗)</p>
          {/* SPEC-S2C2: 現在累計 を 着地予測 の上に縦積み (右寄せ値ブロック) */}
          <div className="font-mono text-right">
            <div className="flex items-baseline justify-end gap-2">
              <span className="text-muted text-xs">現在累計</span>
              <span className="text-base font-bold">{fmtYen(totals.ctd)}</span>
            </div>
            <div className="flex items-baseline justify-end gap-2">
              <span className="text-muted text-xs">着地予測</span>
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
              {noOrigin ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-sm truncate">{storeNames[row.store_code] ?? row.store_code}</p>
                    <span className="text-[10px] font-mono text-muted">{row.store_code}</span>
                  </div>
                  <p className="text-xs text-accent">集金記録・開始日ともに未設定 — タップして開始日を設定</p>
                </>
              ) : (
                // SPEC-S2C2: 左=店名/コード/期間/残り, 右=現在累計を着地予測の上に縦積み(右寄せ)
                <div className="flex items-start justify-between gap-3">
                  {/* 左ブロック: 店名 + コード + サイクル期間 + 残り日数 */}
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="font-bold text-sm truncate">{storeNames[row.store_code] ?? row.store_code}</p>
                      <span className="text-[10px] font-mono text-muted shrink-0">{row.store_code}</span>
                      {/* SPEC-S1G-DONKI-DEADLINE-ALERT-01: 締日アラート badge (unplanned/overdue のみ) */}
                      {(() => {
                        const badge = s1gBadge(row.s1g_status)
                        return badge ? (
                          <span className={`shrink-0 inline-block rounded px-1.5 py-0.5 text-xs font-bold ${badge.cls}`}>
                            {badge.text}
                          </span>
                        ) : null
                      })()}
                    </div>
                    <p className="text-[10px] text-muted mt-0.5">
                      {formatJstDate(row.cycle_start)}〜{formatJstDate(row.next_collection)} 残り{row.days_remaining ?? '—'}日
                    </p>
                  </div>
                  {/* 右ブロック: 現在累計 の上に 着地予測 を縦積み(予測を強調) */}
                  <div className="font-mono text-right shrink-0">
                    <div className="flex items-baseline justify-end gap-1.5">
                      <span className="text-muted text-[10px]">現在累計</span>
                      <span className="text-sm">{fmtYen(row.ctd_revenue)}</span>
                    </div>
                    <div className="flex items-baseline justify-end gap-1.5">
                      <span className="text-muted text-[10px]">着地予測</span>
                      <span className="text-base font-bold text-accent">{fmtYen(row.projected_landing)}</span>
                    </div>
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
