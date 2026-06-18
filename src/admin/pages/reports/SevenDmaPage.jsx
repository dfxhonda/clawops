// J-REPORTS-S2S3-FIX-01 2026-05-31 司令塔Opus spec
// S3 7日移動平均分析 — DB の play_7dma が全 NULL のため、play_count から フロントエンド rolling 7day window で計算。
// 系列選択は店舗フィルタ確定後に booth/machine 候補を masters から提示 (daily_booth_stats 由来でなく)。
// SPEC-ADMIN-ANALYTICS-RELABEL-GENREFILTER-TABPILL-01 R3: GenreFilter 追加
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../../../lib/supabase'
import { jstDateNDaysAgo, rangePresetDays } from '../../lib/jstDate'
import { calc7dmaSeries } from '../../lib/play7dma'
import ReportPageLayout, { EmptyState, ReferenceBadge } from './ReportPageLayout'
import StorePickerSheet from '../../../components/StorePickerSheet'
import GenreFilter from './GenreFilter'

const COLORS = ['#fbbf24', '#60a5fa', '#10b981', '#f472b6', '#a78bfa']
const MAX_SERIES = 5


export default function SevenDmaPage() {
  const [granularity, setGranularity] = useState('booth')
  const [period, setPeriod]           = useState('30d')
  const [storeFilter, setStoreFilter] = useState('all')
  const [genre, setGenre]             = useState('crane')
  const [allEntities, setAllEntities] = useState([])
  const [selected, setSelected]       = useState([])
  const [series, setSeries]           = useState({}) // { entityKey: [{stat_date, value}] }
  const [dataDays, setDataDays]       = useState({})
  const [loading, setLoading]         = useState(false)
  const [loadingEntities, setLoadingEntities] = useState(false)

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
          .from('machines')
          .select('machine_code, machine_name, type_id')
          .eq('store_code', storeFilter).eq('is_active', true).order('machine_code')
        const filtered = (data ?? []).filter(m => genre === 'all' || m.type_id === genre)
        setAllEntities(filtered.map(m => ({ key: m.machine_code, label: m.machine_name || m.machine_code })))
        setLoadingEntities(false)
        return
      }
      // booth granularity — label: "{machine_name} {booth_num} / {prize_name}" (J-REPORTS-S3-LABEL-FIX-01)
      // booth_num = booth_code 末尾セグメント (例: KOS01-M02-B01 → B01)
      // prize_name = meter_readings の最新 patrol_date 行から (NULL なら '景品未設定')
      if (storeFilter === 'all') { setAllEntities([]); setLoadingEntities(false); return }
      const [{ data: boothsData }, { data: machinesData }, { data: readingsData }] = await Promise.all([
        supabase.from('booths').select('booth_code, booth_number, machine_code').eq('store_code', storeFilter).eq('is_active', true).order('booth_code'),
        supabase.from('machines').select('machine_code, machine_name, type_id').eq('store_code', storeFilter).eq('is_active', true),
        // meter_readings から booth ごとの最新 prize_name を取得
        supabase.from('meter_readings').select('booth_code, prize_name, patrol_date').eq('store_code', storeFilter).order('patrol_date', { ascending: false }).limit(2000),
      ])
      const machineMap = Object.fromEntries((machinesData ?? []).map(m => [m.machine_code, m.machine_name || m.machine_code]))
      const typeMap = Object.fromEntries((machinesData ?? []).map(m => [m.machine_code, m.type_id ?? null]))
      const prizeMap = {}
      for (const r of readingsData ?? []) {
        if (!r.booth_code) continue
        if (!(r.booth_code in prizeMap)) prizeMap[r.booth_code] = r.prize_name || null
      }
      const filteredBooths = genre === 'all'
        ? (boothsData ?? [])
        : (boothsData ?? []).filter(b => typeMap[b.machine_code] === genre)
      setAllEntities(filteredBooths.map(b => {
        const lastSeg = b.booth_code.split('-').pop()
        const machName = machineMap[b.machine_code] || b.machine_code
        const prizeName = prizeMap[b.booth_code] || '景品未設定'
        return { key: b.booth_code, label: `${machName} ${lastSeg} / ${prizeName}`, prize_name: prizeName }
      }))
      setLoadingEntities(false)
    }
    loadEntities()
  }, [granularity, storeFilter, genre])

  // 選択エンティティの play_count 時系列を取得 → 7DMA をフロントエンドで計算
  useEffect(() => {
    if (selected.length === 0) { setSeries({}); setDataDays({}); return }
    setLoading(true)
    const from = jstDateNDaysAgo(rangePresetDays(period))
    async function loadSeries() {
      const ser = {}
      const days = {}
      for (const key of selected) {
        // J-REPORTS-S1S2S3-FIX-02: daily_booth_stats に machine_code 列なし、
        // machine 粒度は booth_code prefix (例 KOS01-M02-%) で絞る。
        let q = supabase.from('daily_booth_stats')
          .select('stat_date, play_count, booth_code, store_code')
          .gte('stat_date', from)
          .order('stat_date')
        if (granularity === 'booth') q = q.eq('booth_code', key)
        else if (granularity === 'machine') q = q.like('booth_code', `${key}-%`)
        else q = q.eq('store_code', key)
        const { data } = await q
        const byDate = {}
        for (const r of data ?? []) {
          if (!byDate[r.stat_date]) byDate[r.stat_date] = 0
          byDate[r.stat_date] += Number(r.play_count || 0)
        }
        const sortedRaw = Object.entries(byDate)
          .map(([d, v]) => ({ stat_date: d, play_count: v }))
          .sort((a, b) => a.stat_date.localeCompare(b.stat_date))
        ser[key] = calc7dmaSeries(sortedRaw, 'play_count')
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

  const genreDisabled = granularity === 'store'

  return (
    <ReportPageLayout title="7日移動平均分析" testid="report-7dma">
      {/* ジャンルフィルタ */}
      <GenreFilter
        value={genre}
        onChange={setGenre}
        disabled={genreDisabled}
        disabledReason={genreDisabled ? '店舗粒度は機種別非対応' : null}
      />

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
        <div className="mb-3">
          {/* J-UI-STORE-PICKER-SHEET-01: dropdown → StorePickerSheet */}
          <StorePickerSheet
            value={storeFilter === 'all' ? null : storeFilter}
            onChange={v => setStoreFilter(v ?? 'all')}
            showAllOption={false}
            placeholder="店舗を選択してください"
          />
        </div>
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
