// J-REPORTS-S2S3-FIX-01 2026-05-31 司令塔Opus spec
// S3 7日移動平均分析 — DB の play_7dma が全 NULL のため、play_count から フロントエンド rolling 7day window で計算。
// 系列選択は店舗フィルタ確定後に booth/machine 候補を masters から提示 (daily_booth_stats 由来でなく)。
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../../../lib/supabase'
import { jstDateNDaysAgo, rangePresetDays } from '../../lib/jstDate'
import ReportPageLayout, { EmptyState, ReferenceBadge } from './ReportPageLayout'

const COLORS = ['#fbbf24', '#60a5fa', '#10b981', '#f472b6', '#a78bfa']
const MAX_SERIES = 5

// rolling 7day window 平均 (data 配列は stat_date 順)
function rolling7dma(rawPoints) {
  const out = []
  for (let i = 0; i < rawPoints.length; i++) {
    const start = Math.max(0, i - 6)
    const slice = rawPoints.slice(start, i + 1)
    const validValues = slice.map(p => p.value).filter(v => v != null)
    const avg = validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : null
    out.push({ stat_date: rawPoints[i].stat_date, value: avg })
  }
  return out
}

export default function SevenDmaPage() {
  const [granularity, setGranularity] = useState('booth')
  const [period, setPeriod]           = useState('30d')
  const [storeFilter, setStoreFilter] = useState('all')
  const [stores, setStores]           = useState([])
  const [allEntities, setAllEntities] = useState([])
  const [selected, setSelected]       = useState([])
  const [series, setSeries]           = useState({}) // { entityKey: [{stat_date, value}] }
  const [dataDays, setDataDays]       = useState({})
  const [loading, setLoading]         = useState(false)
  const [loadingEntities, setLoadingEntities] = useState(false)

  useEffect(() => {
    supabase.from('stores').select('store_code, store_name').eq('is_active', true)
      .order('store_name').then(({ data }) => setStores(data ?? []))
  }, [])

  // エンティティ候補を masters (booths/machines/stores) からフェッチ — 系列選択用
  useEffect(() => {
    setSelected([])
    setSeries({})
    setLoadingEntities(true)
    async function loadEntities() {
      if (granularity === 'store') {
        const { data } = await supabase
          .from('stores').select('store_code, store_name').eq('is_active', true).order('store_name')
        setAllEntities((data ?? []).map(s => ({ key: s.store_code, label: s.store_name })))
        setLoadingEntities(false)
        return
      }
      if (granularity === 'machine') {
        if (storeFilter === 'all') { setAllEntities([]); setLoadingEntities(false); return }
        const { data } = await supabase
          .from('machines').select('machine_code, machine_name').eq('store_code', storeFilter).eq('is_active', true).order('machine_code')
        setAllEntities((data ?? []).map(m => ({ key: m.machine_code, label: m.machine_name || m.machine_code })))
        setLoadingEntities(false)
        return
      }
      // booth granularity
      if (storeFilter === 'all') { setAllEntities([]); setLoadingEntities(false); return }
      const { data } = await supabase
        .from('booths').select('booth_code, booth_number, machine_code').eq('store_code', storeFilter).eq('is_active', true).order('booth_code')
      setAllEntities((data ?? []).map(b => ({ key: b.booth_code, label: b.booth_code })))
      setLoadingEntities(false)
    }
    loadEntities()
  }, [granularity, storeFilter])

  // 選択エンティティの play_count 時系列を取得 → 7DMA をフロントエンドで計算
  useEffect(() => {
    if (selected.length === 0) { setSeries({}); setDataDays({}); return }
    setLoading(true)
    const from = jstDateNDaysAgo(rangePresetDays(period))
    async function loadSeries() {
      const ser = {}
      const days = {}
      for (const key of selected) {
        let q = supabase.from('daily_booth_stats')
          .select('stat_date, play_count, booth_code, machine_code, store_code')
          .gte('stat_date', from)
          .order('stat_date')
        if (granularity === 'booth') q = q.eq('booth_code', key)
        else if (granularity === 'machine') q = q.eq('machine_code', key)
        else q = q.eq('store_code', key)
        const { data } = await q
        // 日付ごとに play_count を集約 (machine/store では複数 booth 行があるので SUM)
        const byDate = {}
        for (const r of data ?? []) {
          if (!byDate[r.stat_date]) byDate[r.stat_date] = 0
          byDate[r.stat_date] += Number(r.play_count || 0)
        }
        const sortedRaw = Object.entries(byDate)
          .map(([d, v]) => ({ stat_date: d, value: v }))
          .sort((a, b) => a.stat_date.localeCompare(b.stat_date))
        ser[key] = rolling7dma(sortedRaw) // フロント側 rolling 7DMA
        days[key] = sortedRaw.length
      }
      setSeries(ser); setDataDays(days); setLoading(false)
    }
    loadSeries()
  }, [selected, period, granularity])

  const mergedDates = Array.from(new Set(Object.values(series).flat().map(p => p.stat_date))).sort()
  const chartData = mergedDates.map(d => {
    const row = { stat_date: d }
    for (const ent of selected) {
      const pt = series[ent]?.find(p => p.stat_date === d)
      row[ent] = pt?.value ?? null
    }
    return row
  })

  function toggleEntity(key) {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : prev.length < MAX_SERIES ? [...prev, key] : prev)
  }

  return (
    <ReportPageLayout title="7日移動平均分析" testid="report-7dma">
      <div className="flex flex-wrap gap-2 mb-3">
        {['booth', 'machine', 'store'].map(g => (
          <button key={g} onClick={() => setGranularity(g)}
            data-testid={`granularity-${g}`}
            className={`px-3 py-1.5 rounded text-xs font-bold ${granularity === g ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'}`}>
            {g === 'booth' ? 'ブース' : g === 'machine' ? '機械' : '店舗'}
          </button>
        ))}
        <div className="flex gap-1 ml-auto">
          {['14d', '30d', '60d'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-xs font-bold ${period === p ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'}`}>
              {p === '14d' ? '14日' : p === '30d' ? '30日' : '60日'}
            </button>
          ))}
        </div>
      </div>

      {granularity !== 'store' && (
        <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)}
          data-testid="store-filter"
          className="bg-surface border border-border rounded px-2 py-1 text-xs mb-3">
          <option value="all">店舗を選択してください</option>
          {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
        </select>
      )}

      <div className="mb-3">
        <p className="text-[10px] text-muted mb-1">系列選択 ({selected.length}/{MAX_SERIES})</p>
        {granularity !== 'store' && storeFilter === 'all' ? (
          <p className="text-xs text-muted py-3">← 上で店舗を選択すると候補が表示されます</p>
        ) : loadingEntities ? (
          <p className="text-xs text-muted py-3">候補ロード中…</p>
        ) : allEntities.length === 0 ? (
          <p className="text-xs text-muted py-3">候補がありません</p>
        ) : (
          <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
            {allEntities.map(e => {
              const isOn = selected.includes(e.key)
              const days = dataDays[e.key]
              return (
                <button key={e.key} onClick={() => toggleEntity(e.key)}
                  data-testid={`entity-${e.key}`}
                  className={`px-2 py-1 rounded text-[10px] font-mono ${isOn ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'}`}>
                  {e.label}
                  {isOn && days != null && days < 7 && <ReferenceBadge days={days} />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selected.length === 0
        ? <p className="text-center text-muted text-sm py-12">系列を選択してください</p>
        : loading
          ? <p className="text-center text-muted text-sm py-12">読み込み中…</p>
          : chartData.length === 0
            ? <EmptyState />
            : (
              <div className="bg-surface rounded-lg p-3 border border-border">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="stat_date" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} />
                    <Legend />
                    {selected.map((ent, i) => (
                      <Line key={ent} type="monotone" dataKey={ent} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted mt-2">フロント側 rolling 7日 window で計算 (play_7dma 列が DB で全 NULL のため)</p>
              </div>
            )}
    </ReportPageLayout>
  )
}
