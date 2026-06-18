// J-REPORTS-ANALYTICS-01 S6: 店舗間パフォーマンス比較
// 棒グラフ (revenue / booth_count 正規化) + テーブルビュー切替
// SPEC-ADMIN-ANALYTICS-RELABEL-GENREFILTER-TABPILL-01 R3: GenreFilter 追加
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../../../lib/supabase'
import { jstDateNDaysAgo } from '../../lib/jstDate'
import ReportPageLayout, { EmptyState } from './ReportPageLayout'
import GenreFilter from './GenreFilter'

async function fetchBoothCodesByGenre(genre) {
  if (genre === 'all') return null
  const { data } = await supabase
    .from('booths')
    .select('booth_code, machines!machine_code(type_id)')
    .eq('is_active', true)
  return (data ?? [])
    .filter(b => {
      const m = Array.isArray(b.machines) ? b.machines[0] : b.machines
      return m?.type_id === genre
    })
    .map(b => b.booth_code)
}

export default function StoreComparisonPage() {
  const [period, setPeriod] = useState('30d')
  const [view, setView] = useState('chart') // 'chart' | 'table'
  const [brandGroup, setBrandGroup] = useState(false)
  const [genre, setGenre] = useState('crane')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const days = period === '7d' ? 7 : 30
      const from = jstDateNDaysAgo(days)
      const prevFrom = jstDateNDaysAgo(days * 2)
      const prevTo = jstDateNDaysAgo(days)

      let boothCodes = null
      if (genre !== 'all') {
        boothCodes = await fetchBoothCodesByGenre(genre)
        if (boothCodes.length === 0) { setRows([]); setLoading(false); return }
      }

      let currQ = supabase.from('daily_booth_stats').select('store_code, booth_code, revenue, stat_date').gte('stat_date', from)
      let prevQ = supabase.from('daily_booth_stats').select('store_code, revenue, stat_date').gte('stat_date', prevFrom).lt('stat_date', prevTo)
      if (boothCodes) {
        currQ = currQ.in('booth_code', boothCodes)
        prevQ = prevQ.in('booth_code', boothCodes)
      }

      const [{ data: stores }, { data: curr }, { data: prev }] = await Promise.all([
        supabase.from('stores').select('store_code, store_name').eq('is_active', true),
        currQ,
        prevQ,
      ])
      const agg = {}
      for (const s of stores ?? []) {
        agg[s.store_code] = { store_code: s.store_code, store_name: s.store_name, total_revenue: 0, booths: new Set(), prev_revenue: 0 }
      }
      for (const r of curr ?? []) {
        if (!agg[r.store_code]) continue
        agg[r.store_code].total_revenue += Number(r.revenue || 0)
        if (r.booth_code) agg[r.store_code].booths.add(r.booth_code)
      }
      for (const r of prev ?? []) {
        if (!agg[r.store_code]) continue
        agg[r.store_code].prev_revenue += Number(r.revenue || 0)
      }
      const list = Object.values(agg)
        .map(x => ({
          store_code: x.store_code,
          store_name: x.store_name,
          booth_count: x.booths.size,
          total_revenue: x.total_revenue,
          revenue_per_booth: x.booths.size > 0 ? x.total_revenue / x.booths.size : 0,
          prev_diff: x.prev_revenue > 0 ? ((x.total_revenue - x.prev_revenue) / x.prev_revenue) * 100 : null,
        }))
        .filter(x => x.booth_count > 0 || x.total_revenue > 0)
        .sort((a, b) => b.revenue_per_booth - a.revenue_per_booth)
      setRows(list)
      setLoading(false)
    }
    load()
  }, [period, genre])

  return (
    <ReportPageLayout title="店舗間パフォーマンス比較" testid="report-store-comparison">
      {/* ジャンルフィルタ */}
      <GenreFilter value={genre} onChange={setGenre} />

      <div className="flex flex-wrap gap-2 mb-3">
        {['7d', '30d'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded text-xs font-bold ${period === p ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'}`}>
            {p === '7d' ? '7日' : '30日'}
          </button>
        ))}
        <label className="flex items-center gap-1 text-xs ml-auto">
          <input type="checkbox" checked={brandGroup} onChange={e => setBrandGroup(e.target.checked)} />
          ブランド別グループ (今後対応、現状は店舗別)
        </label>
        <div className="flex gap-1">
          <button onClick={() => setView('chart')} className={`px-3 py-1.5 rounded text-xs font-bold ${view === 'chart' ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'}`}>グラフ</button>
          <button onClick={() => setView('table')} className={`px-3 py-1.5 rounded text-xs font-bold ${view === 'table' ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'}`}>表</button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted text-sm py-12">読み込み中…</p>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : view === 'chart' ? (
        <div className="bg-surface rounded-lg p-3 border border-border">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={rows} margin={{ left: 0, right: 16, top: 8, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="store_name" stroke="#94a3b8" fontSize={10} angle={-30} textAnchor="end" interval={0} height={70} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }}
                formatter={v => `¥${Math.round(v).toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="revenue_per_booth" name="ブース単価" fill="#fbbf24" />
              <Bar dataKey="total_revenue" name="合計売上" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-surface/60">
              <tr className="text-muted">
                <th className="text-left px-2 py-1.5 font-bold">店舗</th>
                <th className="text-right px-2 py-1.5 font-bold">ブース数</th>
                <th className="text-right px-2 py-1.5 font-bold">合計売上</th>
                <th className="text-right px-2 py-1.5 font-bold">ブース単価</th>
                <th className="text-right px-2 py-1.5 font-bold">前期比</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.store_code} className="border-t border-border/60">
                  <td className="px-2 py-1.5 truncate">{r.store_name}</td>
                  <td className="px-2 py-1.5 text-right">{r.booth_count}</td>
                  <td className="px-2 py-1.5 text-right">¥{Math.round(r.total_revenue).toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right font-bold">¥{Math.round(r.revenue_per_booth).toLocaleString()}</td>
                  <td className={`px-2 py-1.5 text-right font-bold ${r.prev_diff == null ? 'text-muted' : r.prev_diff < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {r.prev_diff != null ? `${r.prev_diff >= 0 ? '+' : ''}${r.prev_diff.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportPageLayout>
  )
}
