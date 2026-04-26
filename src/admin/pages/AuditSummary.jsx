import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuditLogs } from '../../services/audit'
import { getStaffMap } from '../../services/readings'
import { aggregateByMetric, aggregateByMonth, aggregateByStaff, aggregateByLocation } from '../../lib/auditAggregations'
import DateRangePicker from '../components/DateRangePicker'
import MetricCard from '../components/MetricCard'
import LogoutButton from '../../components/LogoutButton'
import ErrorDisplay from '../../components/ErrorDisplay'

const TABS = ['月別', '担当者別', '拠点別']

const METRIC_COLS = [
  { key: 'stock_count_adjust', label: '棚卸差分' },
  { key: 'input_fix', label: '入力ミス' },
  { key: 'stock_transfer', label: '移管' },
  { key: 'order_arrived', label: '入荷' },
]

function CssBar({ value, max }) {
  if (!max) return null
  const pct = Math.round((value / max) * 100)
  return (
    <div className="mt-0.5 h-1 bg-surface2 rounded-full overflow-hidden">
      <div className="h-full bg-accent/50 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  )
}

function SummaryTable({ rows, labelKey, labelHeader }) {
  const maxTotal = Math.max(...rows.map(r => METRIC_COLS.reduce((s, c) => s + (r.counts?.[c.key] ?? r[c.key] ?? 0), 0)), 1)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted border-b border-border">
            <th className="text-left py-2 pr-2 font-normal">{labelHeader}</th>
            {METRIC_COLS.map(c => (
              <th key={c.key} className="text-right py-2 px-1 font-normal whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const rowTotal = METRIC_COLS.reduce((s, c) => s + (row.counts?.[c.key] ?? row[c.key] ?? 0), 0)
            return (
              <tr key={i} className="border-b border-border/50">
                <td className="py-2 pr-2">
                  <div>{row[labelKey]}</div>
                  <CssBar value={rowTotal} max={maxTotal} />
                </td>
                {METRIC_COLS.map(c => (
                  <td key={c.key} className="text-right py-2 px-1">
                    {row.counts?.[c.key] ?? row[c.key] ?? 0}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function AuditSummary() {
  const navigate = useNavigate()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [logs, setLogs] = useState(null)      // null=未取得, []以上=取得済み
  const [staffMap, setStaffMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [warn1000, setWarn1000] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  async function handleFetch() {
    setError(null)
    setLoading(true)
    try {
      const [data, smap] = await Promise.all([
        getAuditLogs({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }, 0, 1000),
        getStaffMap(),
      ])
      setLogs(data)
      setStaffMap(smap)
      setWarn1000(data.length >= 1000)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const metrics = useMemo(() => logs ? aggregateByMetric(logs) : null, [logs])
  const byMonth = useMemo(() => {
    if (!logs) return []
    const obj = aggregateByMonth(logs)
    return Object.keys(obj).sort().reverse().map(month => ({ month, counts: obj[month] }))
  }, [logs])
  const byStaff = useMemo(() => logs ? aggregateByStaff(logs, staffMap) : [], [logs, staffMap])
  const byLocation = useMemo(() => logs ? aggregateByLocation(logs) : [], [logs])

  const canFetch = dateFrom && dateTo
  const errorProps = error ? { message: error, onClose: () => setError(null) } : null

  return (
    <div className="h-full flex flex-col max-w-lg md:max-w-3xl mx-auto">
      {/* Header */}
      <div className="shrink-0 bg-bg border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/admin/menu')} className="text-muted text-2xl">←</button>
        <h1 className="flex-1 text-xl font-bold text-accent">監査サマリ</h1>
        <LogoutButton to="/admin/menu" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {errorProps && <ErrorDisplay {...errorProps} />}

        {/* 期間選択 */}
        <div className="bg-surface border border-border rounded-xl p-3 space-y-2">
          <label className="text-xs text-muted block">期間</label>
          <DateRangePicker
            dateFrom={dateFrom} dateTo={dateTo}
            onFromChange={setDateFrom} onToChange={setDateTo}
          />
          <button
            onClick={handleFetch}
            disabled={!canFetch || loading}
            className="w-full py-2 rounded-lg text-sm font-semibold bg-accent text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '集計中...' : '表示する'}
          </button>
        </div>

        {/* 未取得 */}
        {logs === null && (
          <div className="text-center text-muted text-sm py-8">期間を選択してください</div>
        )}

        {/* 1000件警告 */}
        {warn1000 && (
          <div className="bg-yellow-900/30 border border-yellow-600/40 rounded-xl px-3 py-2 text-xs text-yellow-400">
            集計が不完全な可能性があります。期間を短縮してください。
          </div>
        )}

        {/* 集計結果 */}
        {metrics && (
          <>
            {/* 4枚のサマリカード */}
            <div className="grid grid-cols-2 gap-2">
              <MetricCard label="棚卸し差分" count={metrics.stock_count_adjust} color="text-accent" />
              <MetricCard label="入力ミス修正" count={metrics.input_fix} color="text-accent2" />
              <MetricCard label="移管件数" count={metrics.stock_transfer} color="text-accent3" />
              <MetricCard label="入荷件数" count={metrics.order_arrived} color="text-muted" />
            </div>

            {/* タブ */}
            <div className="flex gap-1 border-b border-border">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(i)}
                  className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === i ? 'border-accent text-accent' : 'border-transparent text-muted'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* テーブル */}
            <div className="bg-surface border border-border rounded-xl p-3">
              {activeTab === 0 && (
                byMonth.length === 0
                  ? <div className="text-center text-muted text-sm py-4">データなし</div>
                  : <SummaryTable rows={byMonth} labelKey="month" labelHeader="月" />
              )}
              {activeTab === 1 && (
                byStaff.length === 0
                  ? <div className="text-center text-muted text-sm py-4">データなし</div>
                  : <SummaryTable rows={byStaff} labelKey="name" labelHeader="担当者" />
              )}
              {activeTab === 2 && (
                byLocation.length === 0
                  ? <div className="text-center text-muted text-sm py-4">データなし</div>
                  : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted border-b border-border">
                            <th className="text-left py-2 pr-2 font-normal">拠点</th>
                            <th className="text-right py-2 px-1 font-normal">移管</th>
                          </tr>
                        </thead>
                        <tbody>
                          {byLocation.map((row, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-2 pr-2">{row.name}</td>
                              <td className="text-right py-2 px-1">{row.transfer}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
