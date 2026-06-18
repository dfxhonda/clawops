// J-REPORTS-S1-REDESIGN-01 2026-05-31 司令塔Opus spec
// S1 ブース売上ランキング 再設計版
// - 単位タブ: 日平均(default) / 7DMA / 月間 / 期間合計
// - 列: rank/店舗/機械名/ブース/売上(単位切替)/プレイ数日平均/1プレイ単価/払出率avg/面積効率/データ日数
// - 全列ヘッダクリックでソート (▲▼)
// - 面積効率 = 機械の全ブース日次売上 / (width*depth/1000000)、NULL機種は '-' 末尾ソート
// - ランク色: 1=金, 2=銀, 3=銅 (best モード時のみ)
// - モバイル 390px 横スクロール
// SPEC-ADMIN-ANALYTICS-RELABEL-GENREFILTER-TABPILL-01 R3: GenreFilter 追加

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { jstDateNDaysAgo, todayJst } from '../../lib/jstDate'
import { calc7dmaSeries, periodDays } from '../../lib/play7dma'
import ReportPageLayout, { EmptyState, ReferenceBadge } from './ReportPageLayout'
import StorePickerSheet from '../../../components/StorePickerSheet'
import GenreFilter from './GenreFilter'

const UNITS = [
  { key: 'daily_avg', label: '日平均' },
  { key: '7dma',      label: '7DMA'  },
  { key: 'monthly',   label: '月間'  },
  { key: 'total',     label: '期間合計' },
]

const COUNTS = [20, 50, 0] // 0 = 全件

function rankBg(rank, mode) {
  if (mode !== 'best') return ''
  if (rank === 1) return 'bg-yellow-500/30 font-bold'
  if (rank === 2) return 'bg-slate-300/30 font-bold'
  if (rank === 3) return 'bg-orange-700/30 font-bold'
  return ''
}

export default function BoothRankingPage() {
  const [unit, setUnit]         = useState('daily_avg')
  const [period, setPeriod]     = useState('30d')
  const [from, setFrom]         = useState(jstDateNDaysAgo(30))
  const [to, setTo]             = useState(todayJst())
  const [storeCode, setStoreCode] = useState('all')
  const [mode, setMode]         = useState('best')
  const [count, setCount]       = useState(20)
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [sortBy, setSortBy]     = useState('selected_unit_value')
  const [sortDir, setSortDir]   = useState('desc')
  const [genre, setGenre]       = useState('crane')

  useEffect(() => {
    if (period === '7d') { setFrom(jstDateNDaysAgo(7)); setTo(todayJst()) }
    else if (period === '30d') { setFrom(jstDateNDaysAgo(30)); setTo(todayJst()) }
  }, [period])

  useEffect(() => {
    async function load() {
      setLoading(true)
      // 単位ごとに期間を上書き
      let qFrom = from, qTo = to
      if (unit === '7dma') { qFrom = jstDateNDaysAgo(7); qTo = todayJst() }
      else if (unit === 'monthly') {
        const todayParts = todayJst().split('-')
        qFrom = `${todayParts[0]}-${todayParts[1]}-01`
        qTo = todayJst()
      }
      // J-REPORTS-S1S2S3-FIX-02: daily_booth_stats に machine_code 列なし、FK は booths のみ。
      // booths→machines→machine_models の正しい nested join に修正、machine_code は booths.machine_code から取る。
      let q = supabase
        .from('daily_booth_stats')
        .select(`
          booth_code, store_code, stat_date, revenue, play_count, payout_rate,
          stores(store_name),
          booths!booth_code(machine_code, machines!machine_code(machine_name, machine_models!model_id(width_mm, depth_mm, type_id)))
        `)
        .gte('stat_date', qFrom)
        .lte('stat_date', qTo)
      if (storeCode !== 'all') q = q.eq('store_code', storeCode)
      const { data } = await q
      // 機械単位の合算 (area_efficiency 用) + ブース単位の集計
      const byMachine = {}
      const byBooth = {}
      for (const r of data ?? []) {
        const boothObj = Array.isArray(r.booths) ? r.booths[0] : r.booths
        const machineObj = Array.isArray(boothObj?.machines) ? boothObj.machines[0] : boothObj?.machines
        const mm = Array.isArray(machineObj?.machine_models) ? machineObj.machine_models[0] : machineObj?.machine_models
        const mc = boothObj?.machine_code ?? null
        const typeId = mm?.type_id ?? null
        const bc = r.booth_code
        if (mc) {
          if (!byMachine[mc]) byMachine[mc] = { totalRev: 0, days: new Set(), width: mm?.width_mm ?? null, depth: mm?.depth_mm ?? null }
          byMachine[mc].totalRev += Number(r.revenue || 0)
          byMachine[mc].days.add(r.stat_date)
        }

        if (!byBooth[bc]) byBooth[bc] = {
          booth_code: bc,
          store_code: r.store_code,
          machine_code: mc,
          store_name: r.stores?.store_name || r.store_code,
          machine_name: machineObj?.machine_name || mc || bc,
          type_id: typeId,
          revenue_sum: 0,
          play_sum: 0,
          payout_sum: 0,
          payout_n: 0,
          days: new Set(),
          raw_points: [],  // 7DMA 用 raw 点
        }
        byBooth[bc].revenue_sum += Number(r.revenue || 0)
        byBooth[bc].play_sum += Number(r.play_count || 0)
        if (r.payout_rate != null) {
          byBooth[bc].payout_sum += Number(r.payout_rate)
          byBooth[bc].payout_n += 1
        }
        byBooth[bc].days.add(r.stat_date)
        byBooth[bc].raw_points.push({ stat_date: r.stat_date, revenue: Number(r.revenue || 0) })
      }
      // 期間 calendar 日数 (selected period 全体)
      const calendarDays = periodDays(qFrom, qTo)
      const list = Object.values(byBooth).map(b => {
        const daysN = b.days.size
        const machineAgg = byMachine[b.machine_code]
        const widthM = machineAgg?.width ? machineAgg.width / 1000 : null
        const depthM = machineAgg?.depth ? machineAgg.depth / 1000 : null
        const areaM2 = (widthM != null && depthM != null) ? widthM * depthM : null
        // 面積効率: 機械日平均 (calendar 日数で割る、record 数ではなく)
        const machineDailyAvg = (machineAgg && calendarDays > 0)
          ? machineAgg.totalRev / calendarDays
          : null
        const area_efficiency = (areaM2 != null && areaM2 > 0 && machineDailyAvg != null)
          ? machineDailyAvg / areaM2 : null
        // play_count 日平均は calendar 日数で割る (record 数ではなく)
        const play_count_avg = calendarDays > 0 ? b.play_sum / calendarDays : 0
        const price_per_play = b.play_sum > 0 ? b.revenue_sum / b.play_sum : null
        const payout_avg = b.payout_n > 0 ? (b.payout_sum / b.payout_n) * 100 : null

        // J-REPORTS-7DMA-FIX-01: 7DMA は interpolate + sliding (分母固定 7) で計算、
        // 最後 (今日に近い) の 7DMA 値を採用
        let dma7 = 0
        if (unit === '7dma') {
          const sortedRaw = [...b.raw_points].sort((a, b) => a.stat_date.localeCompare(b.stat_date))
          const dmaSeries = calc7dmaSeries(sortedRaw, 'revenue')
          dma7 = dmaSeries.length > 0 ? dmaSeries[dmaSeries.length - 1].value : 0
        }

        let selected_unit_value = 0
        if (unit === 'daily_avg') {
          // FIX-01: calendar 日数で割る (record 数ではない)
          selected_unit_value = calendarDays > 0 ? b.revenue_sum / calendarDays : 0
        } else if (unit === 'total') selected_unit_value = b.revenue_sum
        else if (unit === '7dma') selected_unit_value = dma7
        else if (unit === 'monthly') selected_unit_value = b.revenue_sum

        return {
          ...b,
          data_days: daysN,
          play_count_avg, price_per_play, payout_avg, area_efficiency, selected_unit_value,
          is_reference: unit === '7dma' && daysN < 7,
        }
      })
      // ジャンルフィルタ (client-side, type_id 一致)
      const genreFiltered = genre === 'all' ? list : list.filter(b => b.type_id === genre)
      // ソート (null は末尾)
      genreFiltered.sort((a, b) => {
        const va = a[sortBy]
        const vb = b[sortBy]
        const aNull = va == null
        const bNull = vb == null
        if (aNull && bNull) return 0
        if (aNull) return 1
        if (bNull) return -1
        if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
        return sortDir === 'asc' ? va - vb : vb - va
      })
      // best/worst モードと件数制限
      let final = genreFiltered
      if (mode === 'worst') final = [...genreFiltered].reverse()
      if (count > 0) final = final.slice(0, count)
      setRows(final.map((r, i) => ({ ...r, rank: i + 1 })))
      setLoading(false)
    }
    load()
  }, [from, to, storeCode, unit, sortBy, sortDir, mode, count, genre])

  function clickHeader(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const unitLabel = UNITS.find(u => u.key === unit)?.label || ''
  const tint = mode === 'best' ? 'bg-emerald-900/10' : 'bg-rose-900/10'

  const HEADERS = useMemo(() => [
    { key: 'rank',                  label: '#'    },
    { key: 'store_name',            label: '店舗' },
    { key: 'machine_name',          label: '機械名' },
    { key: 'booth_code',            label: 'ブース' },
    { key: 'selected_unit_value',   label: `売上(${unitLabel})` },
    { key: 'play_count_avg',        label: '日平均プレイ' },
    { key: 'price_per_play',        label: '1プレイ単価' },
    { key: 'payout_avg',            label: '払出率avg' },
    { key: 'area_efficiency',       label: '面積効率(円/m²/日)' },
    { key: 'data_days',             label: '日数' },
  ], [unitLabel])

  return (
    <ReportPageLayout title="ブース売上ランキング" testid="report-booth-ranking">
      {/* 単位タブ */}
      <div className="flex flex-wrap gap-1 mb-3">
        {UNITS.map(u => (
          <button key={u.key} onClick={() => setUnit(u.key)}
            data-testid={`unit-${u.key}`}
            className={`px-3 py-1.5 rounded text-xs font-bold ${unit === u.key ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'}`}>
            {u.label}
          </button>
        ))}
      </div>

      {/* ジャンルフィルタ */}
      <GenreFilter value={genre} onChange={setGenre} />

      {/* フィルタ行 */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
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
        {/* J-UI-STORE-PICKER-SHEET-01: dropdown → StorePickerSheet */}
        <StorePickerSheet
          value={storeCode === 'all' ? null : storeCode}
          onChange={v => setStoreCode(v ?? 'all')}
          showAllOption
        />
        <div className="flex gap-1">
          <button onClick={() => setMode('best')} data-testid="mode-best"
            className={`px-3 py-1.5 rounded text-xs font-bold ${mode === 'best' ? 'bg-emerald-600 text-white' : 'bg-surface border border-border text-muted'}`}>
            ベスト
          </button>
          <button onClick={() => setMode('worst')} data-testid="mode-worst"
            className={`px-3 py-1.5 rounded text-xs font-bold ${mode === 'worst' ? 'bg-rose-600 text-white' : 'bg-surface border border-border text-muted'}`}>
            ワースト
          </button>
        </div>
        <select value={count} onChange={e => setCount(Number(e.target.value))}
          className="bg-surface border border-border rounded px-2 py-1 text-xs ml-auto">
          {COUNTS.map(c => <option key={c} value={c}>{c === 0 ? '全件' : `${c}件`}</option>)}
        </select>
      </div>

      {loading
        ? <p className="text-center text-muted text-sm py-12">読み込み中…</p>
        : rows.length === 0
          ? <EmptyState />
          : (
            <div className={`overflow-x-auto rounded-lg border border-border ${tint}`}>
              <table className="w-full text-xs min-w-[640px]">
                <thead className="bg-surface/60">
                  <tr className="text-muted">
                    {HEADERS.map(h => (
                      <th key={h.key} onClick={() => clickHeader(h.key)}
                        className="text-left px-2 py-1.5 font-bold cursor-pointer hover:bg-surface/80 whitespace-nowrap select-none">
                        {h.label}
                        {sortBy === h.key && <span className="ml-1 text-accent">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.booth_code} className={`border-t border-border/60 ${rankBg(r.rank, mode)}`}>
                      <td className="px-2 py-1.5 font-bold">{r.rank}</td>
                      <td className="px-2 py-1.5 truncate max-w-[120px]">{r.store_name}</td>
                      <td className="px-2 py-1.5 truncate max-w-[120px]">{r.machine_name}</td>
                      <td className="px-2 py-1.5 font-mono text-[10px]">{r.booth_code}</td>
                      <td className="px-2 py-1.5 text-right">
                        ¥{Math.round(r.selected_unit_value).toLocaleString()}
                        {r.is_reference && <ReferenceBadge days={r.data_days} />}
                      </td>
                      <td className="px-2 py-1.5 text-right">{r.play_count_avg ? r.play_count_avg.toFixed(1) : '0'}</td>
                      <td className="px-2 py-1.5 text-right">
                        {r.price_per_play != null ? `¥${Math.round(r.price_per_play).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {r.payout_avg != null ? `${r.payout_avg.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {r.area_efficiency != null ? `¥${Math.round(r.area_efficiency).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted">{r.data_days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </ReportPageLayout>
  )
}
