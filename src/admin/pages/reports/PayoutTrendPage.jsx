// J-REPORTS-ANALYTICS-01 S2 + J-REPORTS-S2S3-FIX-01/02: 払い出し率トレンド
// 2モード:
//   single  = 3段ドリルダウン (店舗→機械→ブース) で 1 ブースの 2軸折れ線 + phase_at 縦線
//   compare = 店舗選択後、その店舗の全ブースを payout_rate で重ね描き (多系列)
// FIX-02: 右軸は play_count → play_7dma (フロント rolling 7day) に変更 (spec)、DB の play_7dma 列は全 NULL
// SPEC-ADMIN-ANALYTICS-RELABEL-GENREFILTER-TABPILL-01 R3: GenreFilter 追加
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { supabase } from '../../../lib/supabase'
import { jstDateNDaysAgo } from '../../lib/jstDate'
import { calc7dmaSeries } from '../../lib/play7dma'
import ReportPageLayout, { EmptyState } from './ReportPageLayout'
import StorePickerSheet from '../../../components/StorePickerSheet'
import GenreFilter from './GenreFilter'

const COLORS = ['#fbbf24', '#60a5fa', '#10b981', '#f472b6', '#a78bfa', '#22d3ee', '#fb923c', '#34d399', '#e879f9', '#facc15']

function resolveTypeId(machineModels) {
  const mm = Array.isArray(machineModels) ? machineModels[0] : machineModels
  return mm?.type_id ?? null
}

export default function PayoutTrendPage() {
  const [mode, setMode] = useState('single') // 'single' | 'compare'
  const [genre, setGenre] = useState('crane')

  // single mode state
  const [storeCode, setStoreCode] = useState(null)
  const [machineCode, setMachineCode] = useState(null)
  const [boothCode, setBoothCode] = useState(null)
  const [machines, setMachines] = useState([])
  const [booths, setBooths] = useState([])
  const [series, setSeries] = useState([])
  const [phaseChanges, setPhaseChanges] = useState([])

  // compare mode state
  const [compareStore, setCompareStore] = useState(null)
  const [compareSeries, setCompareSeries] = useState([]) // chart data row[stat_date, booth_code_X: value, ...]
  const [compareBooths, setCompareBooths] = useState([]) // [booth_code, ...]
  const [boothTypeMap, setBoothTypeMap] = useState({})   // { booth_code: type_id }

  const [upper, setUpper] = useState(60)
  const [lower, setLower] = useState(30)
  const [loading, setLoading] = useState(false)

  // single mode: store + genre -> machines (type_id filter)
  useEffect(() => {
    setMachineCode(null); setBoothCode(null); setMachines([]); setBooths([]); setSeries([])
    if (mode !== 'single' || !storeCode) return
    supabase.from('machines')
      .select('machine_code, machine_name, machine_models!model_id(type_id)')
      .eq('store_code', storeCode).eq('is_active', true)
      .order('machine_code')
      .then(({ data }) => {
        const filtered = (data ?? []).filter(m => {
          if (genre === 'all') return true
          return resolveTypeId(m.machine_models) === genre
        })
        setMachines(filtered)
      })
  }, [storeCode, mode, genre])

  // single mode: machine -> booths
  useEffect(() => {
    setBoothCode(null); setBooths([]); setSeries([])
    if (mode !== 'single' || !machineCode) return
    supabase.from('booths').select('booth_code, booth_number').eq('machine_code', machineCode).eq('is_active', true)
      .order('booth_number').then(({ data }) => setBooths(data ?? []))
  }, [machineCode, mode])

  // single mode: booth → 時系列
  useEffect(() => {
    if (mode !== 'single' || !boothCode) { setSeries([]); setPhaseChanges([]); return }
    setLoading(true)
    const from = jstDateNDaysAgo(60)
    supabase.from('daily_booth_stats')
      .select('stat_date, payout_rate, play_count, phase_at, prize_id')
      .eq('booth_code', boothCode)
      .gte('stat_date', from)
      .order('stat_date')
      .then(({ data }) => {
        const base = (data ?? []).map(r => ({
          stat_date: r.stat_date,
          payout_rate: r.payout_rate != null ? Number(r.payout_rate) * 100 : null,
          play_count: r.play_count != null ? Number(r.play_count) : 0,
        }))
        const dmaSeries = calc7dmaSeries(base, 'play_count')
        const dmaMap = Object.fromEntries(dmaSeries.map(d => [d.stat_date, d.value]))
        const merged = dmaSeries.map(d => {
          const orig = base.find(p => p.stat_date === d.stat_date)
          return {
            stat_date: d.stat_date,
            payout_rate: orig?.payout_rate ?? null,
            play_7dma: d.value,
          }
        })
        for (const b of base) {
          if (!dmaMap[b.stat_date] && !merged.some(m => m.stat_date === b.stat_date)) {
            merged.push({ stat_date: b.stat_date, payout_rate: b.payout_rate, play_7dma: null })
          }
        }
        merged.sort((a, b) => a.stat_date.localeCompare(b.stat_date))
        setSeries(merged)
        const changes = []
        let prev = null
        for (const r of data ?? []) {
          if (r.phase_at && r.phase_at !== prev) { changes.push(r.stat_date); prev = r.phase_at }
        }
        setPhaseChanges(changes)
        setLoading(false)
      })
  }, [boothCode, mode])

  // compare mode: store → 全ブースの payout_rate 時系列 + booth type_id map
  useEffect(() => {
    if (mode !== 'compare' || !compareStore) {
      setCompareSeries([]); setCompareBooths([]); setBoothTypeMap({})
      return
    }
    setLoading(true)
    const from = jstDateNDaysAgo(60)
    Promise.all([
      supabase.from('daily_booth_stats')
        .select('stat_date, payout_rate, booth_code')
        .eq('store_code', compareStore)
        .gte('stat_date', from)
        .order('stat_date'),
      supabase.from('booths')
        .select('booth_code, machines!machine_code(machine_models!model_id(type_id))')
        .eq('store_code', compareStore),
    ]).then(([{ data }, { data: boothTypeData }]) => {
      const boothSet = new Set()
      const byDate = {}
      for (const r of data ?? []) {
        if (!r.booth_code) continue
        boothSet.add(r.booth_code)
        if (!byDate[r.stat_date]) byDate[r.stat_date] = { stat_date: r.stat_date }
        byDate[r.stat_date][r.booth_code] = r.payout_rate != null ? Number(r.payout_rate) * 100 : null
      }
      setCompareBooths(Array.from(boothSet).sort())
      setCompareSeries(Object.values(byDate).sort((a, b) => a.stat_date.localeCompare(b.stat_date)))
      const typeMap = {}
      for (const b of boothTypeData ?? []) {
        const m = Array.isArray(b.machines) ? b.machines[0] : b.machines
        typeMap[b.booth_code] = resolveTypeId(m?.machine_models)
      }
      setBoothTypeMap(typeMap)
      setLoading(false)
    })
  }, [compareStore, mode])

  const filteredCompareBooths = genre === 'all'
    ? compareBooths
    : compareBooths.filter(bc => boothTypeMap[bc] === genre)

  return (
    <ReportPageLayout title="払い出し率トレンド" testid="report-payout-trend">
      {/* モード切替 */}
      <div className="flex gap-1 mb-3">
        <button onClick={() => setMode('single')}
          data-testid="mode-single"
          className={`px-3 py-1.5 rounded text-xs font-bold ${mode === 'single' ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'}`}>
          1ブース詳細
        </button>
        <button onClick={() => setMode('compare')}
          data-testid="mode-compare"
          className={`px-3 py-1.5 rounded text-xs font-bold ${mode === 'compare' ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'}`}>
          店舗内ブース比較
        </button>
      </div>

      {/* ジャンルフィルタ */}
      <GenreFilter value={genre} onChange={setGenre} />

      {/* single 用ドリルダウン */}
      {mode === 'single' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {/* J-UI-STORE-PICKER-SHEET-01: dropdown → StorePickerSheet (single mode、全店 option なし) */}
          <StorePickerSheet
            value={storeCode}
            onChange={v => setStoreCode(v)}
            showAllOption={false}
          />
          <select value={machineCode ?? ''} onChange={e => setMachineCode(e.target.value || null)}
            disabled={!storeCode} data-testid="select-machine"
            className="bg-surface border border-border rounded px-2 py-1 text-xs disabled:opacity-40">
            <option value="">機械を選択</option>
            {machines.map(m => <option key={m.machine_code} value={m.machine_code}>{m.machine_name || m.machine_code}</option>)}
          </select>
          <select value={boothCode ?? ''} onChange={e => setBoothCode(e.target.value || null)}
            disabled={!machineCode} data-testid="select-booth"
            className="bg-surface border border-border rounded px-2 py-1 text-xs disabled:opacity-40">
            <option value="">ブースを選択</option>
            {booths.map(b => <option key={b.booth_code} value={b.booth_code}>B{String(b.booth_number).padStart(2, '0')}</option>)}
          </select>
        </div>
      )}

      {/* compare 用 店舗選択 */}
      {mode === 'compare' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {/* J-UI-STORE-PICKER-SHEET-01: dropdown → StorePickerSheet (compare mode) */}
          <StorePickerSheet
            value={compareStore}
            onChange={v => setCompareStore(v)}
            showAllOption={false}
          />
          <span className="text-xs text-muted self-center">選択店舗の全ブースを重ね描き ({filteredCompareBooths.length}ブース)</span>
        </div>
      )}

      {/* アラート閾値 */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs items-center">
        <label className="flex items-center gap-1">
          上限<input type="number" value={upper} onChange={e => setUpper(Number(e.target.value))}
            className="w-16 bg-surface border border-border rounded px-2 py-0.5" />%
        </label>
        <label className="flex items-center gap-1">
          下限<input type="number" value={lower} onChange={e => setLower(Number(e.target.value))}
            className="w-16 bg-surface border border-border rounded px-2 py-0.5" />%
        </label>
      </div>

      {/* チャート: single モード */}
      {mode === 'single' && (
        !boothCode
          ? <p className="text-center text-muted text-sm py-12">店舗→機械→ブースを選択</p>
          : loading
            ? <p className="text-center text-muted text-sm py-12">読み込み中…</p>
            : series.length === 0
              ? <EmptyState />
              : (
                <div className="bg-surface rounded-lg p-3 border border-border">
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="stat_date" stroke="#94a3b8" fontSize={10} />
                      <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} label={{ value: '払出率%', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={10} label={{ value: 'play_7dma', angle: 90, position: 'insideRight', fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} />
                      <ReferenceLine yAxisId="left" y={upper} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `上限${upper}%`, fill: '#ef4444', fontSize: 10 }} />
                      <ReferenceLine yAxisId="left" y={lower} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: `下限${lower}%`, fill: '#3b82f6', fontSize: 10 }} />
                      {phaseChanges.map(d => (
                        <ReferenceLine key={d} yAxisId="left" x={d} stroke="#10b981" strokeDasharray="2 2" />
                      ))}
                      <Line yAxisId="left" type="monotone" dataKey="payout_rate" stroke="#fbbf24" strokeWidth={2} dot={false} name="払出率%" />
                      <Line yAxisId="right" type="monotone" dataKey="play_7dma" stroke="#60a5fa" strokeWidth={2} dot={false} name="play_7DMA" />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="text-[10px] text-muted mt-2">緑線=景品phase変更点 ({phaseChanges.length}件)</p>
                </div>
              )
      )}

      {/* チャート: compare モード */}
      {mode === 'compare' && (
        !compareStore
          ? <p className="text-center text-muted text-sm py-12">店舗を選択してください</p>
          : loading
            ? <p className="text-center text-muted text-sm py-12">読み込み中…</p>
            : compareSeries.length === 0
              ? <EmptyState />
              : (
                <div className="bg-surface rounded-lg p-3 border border-border">
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart data={compareSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="stat_date" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} label={{ value: '払出率%', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} />
                      <ReferenceLine y={upper} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `上限${upper}%`, fill: '#ef4444', fontSize: 10 }} />
                      <ReferenceLine y={lower} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: `下限${lower}%`, fill: '#3b82f6', fontSize: 10 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {filteredCompareBooths.map((b, i) => (
                        <Line key={b} type="monotone" dataKey={b} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="text-[10px] text-muted mt-2">店舗内 {filteredCompareBooths.length} ブースの払出率 (60日)</p>
                </div>
              )
      )}
    </ReportPageLayout>
  )
}
