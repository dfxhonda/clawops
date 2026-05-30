// J-REPORTS-ANALYTICS-01 S3: 7日移動平均分析 (ブース/機械/店舗 粒度切替、最大5系列オーバーレイ)
// 7日未満データは「参考値(Nd)」バッジ
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../../../lib/supabase'
import { jstDateNDaysAgo, rangePresetDays } from '../../lib/jstDate'
import ReportPageLayout, { EmptyState, ReferenceBadge } from './ReportPageLayout'

const COLORS = ['#fbbf24', '#60a5fa', '#10b981', '#f472b6', '#a78bfa']
const MAX_SERIES = 5

export default function SevenDmaPage() {
  const [granularity, setGranularity] = useState('booth') // 'booth' | 'machine' | 'store'
  const [period, setPeriod] = useState('30d')
  const [storeFilter, setStoreFilter] = useState('all')
  const [stores, setStores] = useState([])
  const [allEntities, setAllEntities] = useState([])
  const [selected, setSelected] = useState([])
  const [series, setSeries] = useState({}) // { entityKey: [{stat_date, play_7dma}] }
  const [dataDays, setDataDays] = useState({}) // { entityKey: number }
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('stores').select('store_code, store_name').eq('is_active', true)
      .order('store_name').then(({ data }) => setStores(data ?? []))
  }, [])

  // 粒度変更時、エンティティ候補をフェッチ
  useEffect(() => {
    setSelected([])
    const from = jstDateNDaysAgo(rangePresetDays(period))
    let q = supabase.from('daily_booth_stats')
      .select('booth_code, machine_code, store_code, stat_date, play_7dma, stores(store_name)')
      .gte('stat_date', from)
    if (storeFilter !== 'all') q = q.eq('store_code', storeFilter)
    q.then(({ data }) => {
      const entityMap = {}
      for (const r of data ?? []) {
        const key = granularity === 'booth' ? r.booth_code : granularity === 'machine' ? r.machine_code : r.store_code
        if (!key) continue
        if (!entityMap[key]) {
          entityMap[key] = {
            key,
            label: granularity === 'booth' ? r.booth_code
              : granularity === 'machine' ? r.machine_code
              : (r.stores?.store_name || r.store_code),
            store_code: r.store_code,
          }
        }
      }
      setAllEntities(Object.values(entityMap).sort((a, b) => a.label.localeCompare(b.label)))
    })
  }, [granularity, period, storeFilter])

  // selected エンティティの 7DMA 時系列を取得
  useEffect(() => {
    if (selected.length === 0) { setSeries({}); setDataDays({}); return }
    setLoading(true)
    const from = jstDateNDaysAgo(rangePresetDays(period))
    const baseQ = supabase.from('daily_booth_stats')
      .select('booth_code, machine_code, store_code, stat_date, play_7dma, play_count')
      .gte('stat_date', from)
    baseQ.then(({ data }) => {
      const ser = {}
      const days = {}
      for (const ent of selected) {
        const rows = (data ?? []).filter(r => {
          if (granularity === 'booth') return r.booth_code === ent
          if (granularity === 'machine') return r.machine_code === ent
          return r.store_code === ent
        })
        if (granularity === 'booth') {
          ser[ent] = rows.map(r => ({ stat_date: r.stat_date, value: r.play_7dma != null ? Number(r.play_7dma) : null }))
        } else {
          // 機械/店舗粒度: stat_date 別に play_7dma の平均
          const byDate = {}
          for (const r of rows) {
            if (r.play_7dma == null) continue
            if (!byDate[r.stat_date]) byDate[r.stat_date] = { sum: 0, n: 0 }
            byDate[r.stat_date].sum += Number(r.play_7dma)
            byDate[r.stat_date].n += 1
          }
          ser[ent] = Object.entries(byDate).map(([d, { sum, n }]) => ({ stat_date: d, value: sum / n }))
            .sort((a, b) => a.stat_date.localeCompare(b.stat_date))
        }
        days[ent] = new Set(rows.map(r => r.stat_date)).size
      }
      setSeries(ser); setDataDays(days); setLoading(false)
    })
  }, [selected, period, granularity])

  // 全 stat_date でマージしたチャート用データ
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
          className="bg-surface border border-border rounded px-2 py-1 text-xs mb-3">
          <option value="all">全店</option>
          {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
        </select>
      )}

      {/* エンティティ選択 (最大5) */}
      <div className="mb-3">
        <p className="text-[10px] text-muted mb-1">系列選択 ({selected.length}/{MAX_SERIES})</p>
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
              </div>
            )}
    </ReportPageLayout>
  )
}
