// J-REPORTS-ANALYTICS-01 S5: 景品コスト回収分析
// daily_booth_stats per prize_id + prize_masters JOIN
// 回収率 = (revenue - prize_cost*prize_out_count) / (prize_cost*prize_out_count) * 100
// SPEC-ADMIN-ANALYTICS-RELABEL-GENREFILTER-TABPILL-01 R3: GenreFilter 追加
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { jstDateNDaysAgo, todayJst } from '../../lib/jstDate'
import ReportPageLayout, { EmptyState } from './ReportPageLayout'
import StorePickerSheet from '../../../components/StorePickerSheet'
import GenreFilter from './GenreFilter'

async function fetchBoothCodesByGenre(genre, storeCode) {
  if (genre === 'all') return null
  let q = supabase
    .from('booths')
    .select('booth_code, machines!machine_code(type_id)')
    .eq('is_active', true)
  if (storeCode !== 'all') q = q.eq('store_code', storeCode)
  const { data } = await q
  return (data ?? [])
    .filter(b => {
      const m = Array.isArray(b.machines) ? b.machines[0] : b.machines
      return m?.type_id === genre
    })
    .map(b => b.booth_code)
}

export default function PrizeCostPage() {
  const [period, setPeriod] = useState('30d')
  const [from, setFrom] = useState(jstDateNDaysAgo(30))
  const [to, setTo] = useState(todayJst())
  const [storeCode, setStoreCode] = useState('all')
  const [genre, setGenre] = useState('crane')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (period === '7d') { setFrom(jstDateNDaysAgo(7)); setTo(todayJst()) }
    else if (period === '30d') { setFrom(jstDateNDaysAgo(30)); setTo(todayJst()) }
  }, [period])

  useEffect(() => {
    async function load() {
      setLoading(true)
      let q = supabase
        .from('daily_booth_stats')
        .select('prize_id, prize_cost, prize_out_count, revenue, prize_masters(prize_name), booth_code')
        .gte('stat_date', from)
        .lte('stat_date', to)
        .not('prize_id', 'is', null)
      if (storeCode !== 'all') q = q.eq('store_code', storeCode)
      if (genre !== 'all') {
        const codes = await fetchBoothCodesByGenre(genre, storeCode)
        if (codes.length === 0) { setRows([]); setLoading(false); return }
        q = q.in('booth_code', codes)
      }
      const { data } = await q
      const agg = {}
      for (const r of data ?? []) {
        const k = r.prize_id
        if (!agg[k]) {
          agg[k] = {
            prize_id: k,
            prize_name: r.prize_masters?.prize_name || k,
            prize_cost: Number(r.prize_cost || 0),
            total_out: 0,
            total_cost: 0,
            total_revenue: 0,
          }
        }
        agg[k].total_out += Number(r.prize_out_count || 0)
        agg[k].total_cost += Number((r.prize_cost ?? 0) * (r.prize_out_count ?? 0))
        agg[k].total_revenue += Number(r.revenue || 0)
      }
      const list = Object.values(agg).map(x => ({
        ...x,
        profit: x.total_revenue - x.total_cost,
        recovery_rate: x.total_cost > 0 ? ((x.total_revenue - x.total_cost) / x.total_cost) * 100 : null,
      }))
      list.sort((a, b) => (b.recovery_rate ?? -Infinity) - (a.recovery_rate ?? -Infinity))
      setRows(list)
      setLoading(false)
    }
    load()
  }, [from, to, storeCode, genre])

  return (
    <ReportPageLayout title="景品コスト回収分析" testid="report-prize-cost">
      {/* ジャンルフィルタ */}
      <GenreFilter value={genre} onChange={setGenre} />

      <div className="flex flex-wrap gap-2 mb-3">
        {['7d', '30d', 'custom'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded text-xs font-bold ${period === p ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'}`}>
            {p === '7d' ? '7日' : p === '30d' ? '30日' : 'カスタム'}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="bg-surface border border-border rounded px-2 py-1 text-xs" />
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="bg-surface border border-border rounded px-2 py-1 text-xs" />
          </>
        )}
        {/* J-UI-STORE-PICKER-SHEET-01: dropdown → StorePickerSheet */}
        <StorePickerSheet
          value={storeCode === 'all' ? null : storeCode}
          onChange={v => setStoreCode(v ?? 'all')}
          showAllOption
        />
      </div>

      {loading
        ? <p className="text-center text-muted text-sm py-12">読み込み中…</p>
        : rows.length === 0
          ? <EmptyState message="景品データがありません (prize_id 紐付け済み daily_booth_stats が必要)" />
          : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-surface/60">
                  <tr className="text-muted">
                    <th className="text-left px-2 py-1.5 font-bold">景品名</th>
                    <th className="text-right px-2 py-1.5 font-bold">仕入単価</th>
                    <th className="text-right px-2 py-1.5 font-bold">出庫数</th>
                    <th className="text-right px-2 py-1.5 font-bold">原価合計</th>
                    <th className="text-right px-2 py-1.5 font-bold">売上</th>
                    <th className="text-right px-2 py-1.5 font-bold">利益</th>
                    <th className="text-right px-2 py-1.5 font-bold">回収率</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const rateColor = r.recovery_rate == null ? 'text-muted'
                      : r.recovery_rate < 0 ? 'text-rose-400'
                      : 'text-emerald-400'
                    return (
                      <tr key={r.prize_id} className="border-t border-border/60">
                        <td className="px-2 py-1.5 truncate max-w-[180px]">{r.prize_name}</td>
                        <td className="px-2 py-1.5 text-right">¥{Math.round(r.prize_cost).toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right">{r.total_out}</td>
                        <td className="px-2 py-1.5 text-right">¥{Math.round(r.total_cost).toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right">¥{Math.round(r.total_revenue).toLocaleString()}</td>
                        <td className={`px-2 py-1.5 text-right font-bold ${rateColor}`}>¥{Math.round(r.profit).toLocaleString()}</td>
                        <td className={`px-2 py-1.5 text-right font-bold ${rateColor}`}>
                          {r.recovery_rate != null ? `${r.recovery_rate.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
    </ReportPageLayout>
  )
}
