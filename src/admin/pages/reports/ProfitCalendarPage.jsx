// J-REPORTS-ANALYTICS-01 S7 (addendum): 利益率カレンダー (CSS grid heatmap)
// 粗利率 = (revenue - prize_cost*prize_out_count) / revenue * 100
// 色: 緑>=70% / 黄 50-70% / 赤<50% / グレー=データなし、prize_cost*prize_out_count=0 は除外
// SPEC-ADMIN-ANALYTICS-RELABEL-GENREFILTER-TABPILL-01 R3: GenreFilter 追加
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTrackPageUsage } from '../../../hooks/useTrackPageUsage'
import { PAGE_KEY } from '../../../constants/pageKeys'
import { jstDateNDaysAgo, todayJst } from '../../lib/jstDate'
import ReportPageLayout, { EmptyState } from './ReportPageLayout'
import StorePickerSheet from '../../../components/StorePickerSheet'
import GenreFilter from './GenreFilter'

function colorFor(margin, target) {
  if (margin == null) return 'bg-slate-700'
  if (margin >= target) return 'bg-emerald-600'
  if (margin >= target - 20) return 'bg-amber-500'
  return 'bg-rose-600'
}

function weekStart(dateStr) {
  // 週開始 (月曜) を返す JST
  const d = new Date(dateStr + 'T00:00:00+09:00')
  const dow = d.getDay() // 0=日
  const offset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

function monthStart(dateStr) {
  return dateStr.slice(0, 7) // YYYY-MM
}

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

export default function ProfitCalendarPage() {
  useTrackPageUsage(PAGE_KEY.PROFIT_CALENDAR) // SPEC-ANALYTICS-USAGE-SORT-W1-01 (D-068)
  const [granularity, setGranularity] = useState('daily') // 'daily' | 'weekly' | 'monthly'
  const [target, setTarget] = useState(70)
  const [days, setDays] = useState(30)
  const [storeCode, setStoreCode] = useState('all')
  const [genre, setGenre] = useState('crane')
  const [grid, setGrid] = useState({ stores: [], dates: [], cells: {} })
  const [loading, setLoading] = useState(true)
  const [popup, setPopup] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const from = jstDateNDaysAgo(days)
      let q = supabase
        .from('daily_booth_stats')
        .select('store_code, stat_date, revenue, prize_cost, prize_out_count, stores(store_name)')
        .gte('stat_date', from)
        .lte('stat_date', todayJst())
      if (storeCode !== 'all') q = q.eq('store_code', storeCode)
      if (genre !== 'all') {
        const codes = await fetchBoothCodesByGenre(genre, storeCode)
        if (codes.length === 0) {
          setGrid({ stores: [], dates: [], cells: {} })
          setLoading(false)
          return
        }
        q = q.in('booth_code', codes)
      }
      const { data } = await q
      // 粒度に応じてバケット化
      const bucketize = (d) => granularity === 'weekly' ? weekStart(d)
        : granularity === 'monthly' ? monthStart(d) : d
      const cells = {} // {storeKey: {bucket: {rev, cost, margin}}}
      const storeMap = {}
      const bucketSet = new Set()
      for (const r of data ?? []) {
        const sName = r.stores?.store_name || r.store_code
        storeMap[r.store_code] = sName
        const b = bucketize(r.stat_date)
        bucketSet.add(b)
        if (!cells[r.store_code]) cells[r.store_code] = {}
        if (!cells[r.store_code][b]) cells[r.store_code][b] = { rev: 0, cost: 0 }
        cells[r.store_code][b].rev += Number(r.revenue || 0)
        cells[r.store_code][b].cost += Number((r.prize_cost ?? 0) * (r.prize_out_count ?? 0))
      }
      // 粗利率を計算、cost=0は除外 (gray化)
      for (const sc of Object.keys(cells)) {
        for (const b of Object.keys(cells[sc])) {
          const c = cells[sc][b]
          if (c.rev > 0 && c.cost > 0) {
            c.margin = ((c.rev - c.cost) / c.rev) * 100
          } else {
            c.margin = null
          }
        }
      }
      const storeList = Object.entries(storeMap)
        .map(([k, name]) => ({ store_code: k, store_name: name }))
        .sort((a, b) => a.store_name.localeCompare(b.store_name))
      const dateList = Array.from(bucketSet).sort()
      setGrid({ stores: storeList, dates: dateList, cells })
      setLoading(false)
    }
    load()
  }, [granularity, days, storeCode, genre])

  return (
    <ReportPageLayout title="利益率カレンダー" testid="report-profit-calendar">
      {/* ジャンルフィルタ */}
      <GenreFilter value={genre} onChange={setGenre} />

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <div className="flex gap-1">
          {['daily', 'weekly', 'monthly'].map(g => (
            <button key={g} onClick={() => setGranularity(g)}
              className={`px-3 py-1.5 rounded text-xs font-bold ${granularity === g ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'}`}>
              {g === 'daily' ? '日次' : g === 'weekly' ? '週次' : '月次'}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {[14, 30, 60].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded text-xs font-bold ${days === d ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'}`}>
              {d}日
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-xs">
          目標<input type="number" inputMode="numeric" value={target} onChange={e => setTarget(Number(e.target.value))}
            className="w-14 bg-surface border border-border rounded px-2 py-0.5" />%
        </label>
        {/* J-UI-STORE-PICKER-SHEET-01: dropdown → StorePickerSheet */}
        <StorePickerSheet
          value={storeCode === 'all' ? null : storeCode}
          onChange={v => setStoreCode(v ?? 'all')}
          showAllOption
        />
      </div>

      <div className="flex gap-3 text-[10px] text-muted mb-2">
        <span><span className="inline-block w-3 h-3 rounded bg-emerald-600 mr-1" />目標達成</span>
        <span><span className="inline-block w-3 h-3 rounded bg-amber-500 mr-1" />警告ライン</span>
        <span><span className="inline-block w-3 h-3 rounded bg-rose-600 mr-1" />未達</span>
        <span><span className="inline-block w-3 h-3 rounded bg-slate-700 mr-1" />データなし</span>
      </div>

      {loading
        ? <p className="text-center text-muted text-sm py-12">読み込み中…</p>
        : grid.dates.length === 0
          ? <EmptyState />
          : (
            <div className="overflow-x-auto">
              <table className="border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-bg text-left text-[10px] text-muted font-bold px-2 py-1 min-w-[100px]">店舗</th>
                    {grid.dates.map(d => (
                      <th key={d} className="text-[9px] text-muted font-mono px-1 py-1 whitespace-nowrap" style={{ minWidth: 28 }}>
                        {granularity === 'monthly' ? d : d.slice(5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.stores.map(s => (
                    <tr key={s.store_code}>
                      <td className="sticky left-0 z-10 bg-bg text-[10px] px-2 py-1 truncate">{s.store_name}</td>
                      {grid.dates.map(d => {
                        const c = grid.cells[s.store_code]?.[d]
                        const margin = c?.margin
                        return (
                          <td key={d} className="p-0.5">
                            <button
                              onClick={() => setPopup({ store: s.store_name, date: d, ...c })}
                              className={`w-6 h-6 rounded ${colorFor(margin, target)} hover:ring-2 hover:ring-white/40`}
                              title={margin != null ? `${margin.toFixed(1)}%` : 'データなし'}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setPopup(null)}>
          <div className="bg-surface border border-border rounded-lg p-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <p className="font-bold mb-2">{popup.store} / {popup.date}</p>
            {popup.rev == null ? (
              <p className="text-xs text-muted">データなし</p>
            ) : (
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-muted">売上</span><span>¥{Math.round(popup.rev).toLocaleString()}</span>
                <span className="text-muted">原価</span><span>¥{Math.round(popup.cost).toLocaleString()}</span>
                <span className="text-muted">粗利</span><span className="font-bold">¥{Math.round(popup.rev - popup.cost).toLocaleString()}</span>
                <span className="text-muted">粗利率</span><span className="font-bold">{popup.margin != null ? `${popup.margin.toFixed(1)}%` : '—'}</span>
              </div>
            )}
            <button onClick={() => setPopup(null)} className="mt-3 w-full bg-accent text-white py-1.5 rounded text-xs font-bold">閉じる</button>
          </div>
        </div>
      )}
    </ReportPageLayout>
  )
}
