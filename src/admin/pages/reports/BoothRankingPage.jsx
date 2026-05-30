// J-REPORTS-ANALYTICS-01 S1: ブース売上ランキング
// daily_booth_stats GROUP BY booth_code SUM(revenue) JOIN stores
// 期間 (7d/30d/custom) + 店舗 (全店/単店) + ベスト/ワースト切替 (デフォルトN=20)
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { jstDateNDaysAgo, todayJst } from '../../lib/jstDate'
import ReportPageLayout, { EmptyState } from './ReportPageLayout'

export default function BoothRankingPage() {
  const [period, setPeriod] = useState('30d') // '7d' | '30d' | 'custom'
  const [from, setFrom] = useState(jstDateNDaysAgo(30))
  const [to, setTo] = useState(todayJst())
  const [storeCode, setStoreCode] = useState('all')
  const [mode, setMode] = useState('best') // 'best' | 'worst'
  const N = 20

  const [stores, setStores] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('stores').select('store_code, store_name').eq('is_active', true)
      .order('store_name').then(({ data }) => setStores(data ?? []))
  }, [])

  useEffect(() => {
    if (period === '7d') { setFrom(jstDateNDaysAgo(7)); setTo(todayJst()) }
    else if (period === '30d') { setFrom(jstDateNDaysAgo(30)); setTo(todayJst()) }
  }, [period])

  useEffect(() => {
    setLoading(true)
    let q = supabase
      .from('daily_booth_stats')
      .select('booth_code, store_code, revenue, stat_date, stores(store_name)')
      .gte('stat_date', from)
      .lte('stat_date', to)
    if (storeCode !== 'all') q = q.eq('store_code', storeCode)
    q.then(({ data }) => {
      const agg = {}
      for (const r of data ?? []) {
        const key = r.booth_code
        if (!agg[key]) {
          agg[key] = {
            booth_code: r.booth_code,
            store_code: r.store_code,
            store_name: r.stores?.store_name || r.store_code,
            total_revenue: 0,
            days: 0,
          }
        }
        agg[key].total_revenue += Number(r.revenue || 0)
        agg[key].days += 1
      }
      const list = Object.values(agg).map(x => ({
        ...x,
        daily_avg: x.days > 0 ? x.total_revenue / x.days : 0,
      }))
      list.sort((a, b) => mode === 'best'
        ? b.total_revenue - a.total_revenue
        : a.total_revenue - b.total_revenue)
      setRows(list.slice(0, N))
      setLoading(false)
    })
  }, [from, to, storeCode, mode])

  const tint = mode === 'best' ? 'bg-emerald-900/20' : 'bg-rose-900/20'

  return (
    <ReportPageLayout title="ブース売上ランキング" testid="report-booth-ranking">
      {/* フィルタ */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1">
          {['7d', '30d', 'custom'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              data-testid={`period-${p}`}
              className={`px-3 py-1.5 rounded text-xs font-bold ${period === p ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'}`}>
              {p === '7d' ? '7日' : p === '30d' ? '30日' : 'カスタム'}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="bg-surface border border-border rounded px-2 py-1 text-xs" />
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="bg-surface border border-border rounded px-2 py-1 text-xs" />
          </>
        )}
        <select value={storeCode} onChange={e => setStoreCode(e.target.value)}
          data-testid="store-filter"
          className="bg-surface border border-border rounded px-2 py-1 text-xs">
          <option value="all">全店</option>
          {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
        </select>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => setMode('best')} data-testid="mode-best"
            className={`px-3 py-1.5 rounded text-xs font-bold ${mode === 'best' ? 'bg-emerald-600 text-white' : 'bg-surface border border-border text-muted'}`}>
            ベスト20
          </button>
          <button onClick={() => setMode('worst')} data-testid="mode-worst"
            className={`px-3 py-1.5 rounded text-xs font-bold ${mode === 'worst' ? 'bg-rose-600 text-white' : 'bg-surface border border-border text-muted'}`}>
            ワースト20
          </button>
        </div>
      </div>

      {/* テーブル */}
      {loading
        ? <p className="text-center text-muted text-sm py-12">読み込み中…</p>
        : rows.length === 0
          ? <EmptyState />
          : (
            <div className={`rounded-lg overflow-hidden border border-border ${tint}`}>
              <table className="w-full text-xs">
                <thead className="bg-surface/60">
                  <tr className="text-muted">
                    <th className="text-left px-2 py-1.5 font-bold">#</th>
                    <th className="text-left px-2 py-1.5 font-bold">店舗</th>
                    <th className="text-left px-2 py-1.5 font-bold">ブース</th>
                    <th className="text-right px-2 py-1.5 font-bold">合計売上</th>
                    <th className="text-right px-2 py-1.5 font-bold">日平均</th>
                    <th className="text-right px-2 py-1.5 font-bold">日数</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.booth_code} className="border-t border-border/60">
                      <td className="px-2 py-1.5 font-bold">{i + 1}</td>
                      <td className="px-2 py-1.5">{r.store_name}</td>
                      <td className="px-2 py-1.5 font-mono text-[10px]">{r.booth_code}</td>
                      <td className="px-2 py-1.5 text-right">¥{Math.round(r.total_revenue).toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right">¥{Math.round(r.daily_avg).toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right text-muted">{r.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </ReportPageLayout>
  )
}
