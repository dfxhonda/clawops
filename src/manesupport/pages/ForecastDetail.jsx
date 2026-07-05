// SPEC-ADMIN-FORECAST-CYCLE-S2-UI-01: 集金サイクル売上着地予測 店舗詳細
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot,
} from 'recharts'
import LandscapeSideHeader from '../../components/LandscapeSideHeader'
import ErrorDisplay from '../../components/ErrorDisplay'
import { getForecastStoreDetail, saveForecastSettings } from '../../services/forecast'
import { getAllStores } from '../../services/masters'
import { useAuth } from '../../hooks/useAuth'
import { fmtYen } from '../../utils/format'
import { formatJstDate } from '../../admin/lib/jstDate'

const DATE_INPUT_CLASS =
  'w-full bg-surface2 border border-border rounded-lg px-2 py-1.5 text-xs text-text [color-scheme:dark]'

// テスト用 export (純粋関数)
export function buildChartData(daily) {
  const rows = (daily ?? []).map(r => ({ ...r }))
  let lastActualIdx = -1
  rows.forEach((r, i) => { if (r.actual_cum != null) lastActualIdx = i })
  if (lastActualIdx >= 0 && rows[lastActualIdx].projected_cum == null) {
    rows[lastActualIdx] = { ...rows[lastActualIdx], projected_cum: rows[lastActualIdx].actual_cum }
  }
  return rows
}

export function pickMilestones(rows) {
  if (!rows.length) return []
  const idxs = rows.map((_, i) => i).filter(i => i % 5 === 0 || i === rows.length - 1)
  return idxs.map(i => {
    const r = rows[i]
    return { d: r.d, value: r.actual_cum ?? r.projected_cum, isLanding: i === rows.length - 1 }
  })
}

function ForecastChart({ daily }) {
  const chartData = useMemo(() => buildChartData(daily), [daily])
  const milestones = useMemo(() => pickMilestones(chartData), [chartData])

  if (!chartData.length) {
    return <p className="text-center text-muted text-sm py-8">推移データがありません</p>
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <p className="text-xs font-bold text-muted mb-2">売上推移 (実績 + 予測)</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="d" stroke="var(--color-text-dim)" fontSize={10} tickFormatter={d => formatJstDate(d)} />
          <YAxis stroke="var(--color-text-dim)" fontSize={10} tickFormatter={v => fmtYen(v)} width={70} />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: 11 }}
            labelFormatter={d => formatJstDate(d)}
            formatter={(value, name) => [fmtYen(value), name === 'actual_cum' ? '実績' : '予測']}
          />
          <Line type="monotone" dataKey="actual_cum" stroke="var(--color-success)" strokeWidth={2} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="projected_cum" stroke="var(--color-accent)" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
          {milestones.map(m => (
            <ReferenceDot
              key={m.d}
              x={m.d}
              y={m.value}
              r={m.isLanding ? 5 : 3}
              fill={m.isLanding ? 'var(--color-accent)' : 'var(--color-success)'}
              stroke="none"
              label={{
                value: `${formatJstDate(m.d).slice(5)} ${fmtYen(m.value)}`,
                position: 'top',
                fontSize: m.isLanding ? 11 : 9,
                fontWeight: m.isLanding ? 'bold' : 'normal',
                fill: m.isLanding ? 'var(--color-accent)' : 'var(--color-text-dim)',
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function BoothTable({ booths }) {
  const sorted = useMemo(
    () => [...(booths ?? [])].sort((a, b) => (b.projected_landing ?? -Infinity) - (a.projected_landing ?? -Infinity)),
    [booths]
  )
  if (!sorted.length) return <p className="text-center text-muted text-sm py-4">ブースデータがありません</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" data-testid="forecast-booth-table">
        <thead>
          <tr className="text-muted border-b border-border">
            <th className="text-left py-2 pr-2 font-normal">ブース</th>
            <th className="text-right py-2 px-1 font-normal whitespace-nowrap">現在累計</th>
            <th className="text-right py-2 px-1 font-normal whitespace-nowrap">Ave/日</th>
            <th className="text-right py-2 pl-1 font-normal whitespace-nowrap">着地予測</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(b => (
            <tr key={b.booth_code} className="border-b border-border/50">
              {/* SPEC-S2C: model_name + booth_no + prize_name (prize null は省略) */}
              <td className="py-2 pr-2">
                <div className="flex items-baseline gap-1">
                  <span className="truncate max-w-[7rem]">{b.model_name ?? b.machine_code}</span>
                  <span className="text-[10px] font-mono text-muted shrink-0">{b.booth_no}</span>
                </div>
                {b.prize_name && (
                  <div className="text-[10px] text-muted truncate max-w-[9rem]">{b.prize_name}</div>
                )}
              </td>
              <td className="text-right py-2 px-1 font-mono">{fmtYen(b.ctd_revenue)}</td>
              <td className="text-right py-2 px-1 font-mono text-muted">{fmtYen(b.dma7_daily)}</td>
              <td className="text-right py-2 pl-1 font-mono text-accent font-bold">{fmtYen(b.projected_landing)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SettingsForm({ storeCode, store, staffId, onSaved }) {
  const cycleEditable = store.origin_source !== 'collection'
  const [cycleStart, setCycleStart] = useState(store.cycle_start ?? '')
  const [nextCollection, setNextCollection] = useState(store.next_collection ?? '')
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [error, setError] = useState(null)

  async function handleSave() {
    setSaveState('saving')
    setError(null)
    try {
      await saveForecastSettings(
        storeCode,
        { cycleStartDate: cycleEditable ? cycleStart : undefined, nextCollectionDate: nextCollection },
        staffId
      )
      setSaveState('saved')
      onSaved()
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (e) {
      setError(e)
      setSaveState('error')
    }
  }

  const canSave = cycleEditable ? !!cycleStart : true

  return (
    <div className="bg-surface border border-border rounded-xl p-3 space-y-2" data-testid="forecast-settings-form">
      <p className="text-xs font-bold text-muted">サイクル設定</p>
      {error && <ErrorDisplay error={error} onRetry={handleSave} onDismiss={() => setError(null)} />}

      {cycleEditable ? (
        <div>
          <label className="text-xs text-muted block mb-1">サイクル開始日 (集金記録なし店舗のみ手動設定)</label>
          <input
            type="date"
            value={cycleStart}
            onChange={e => setCycleStart(e.target.value)}
            className={DATE_INPUT_CLASS}
            data-testid="forecast-cycle-start-input"
          />
        </div>
      ) : (
        <p className="text-xs text-muted">サイクル開始日: {formatJstDate(store.cycle_start)} (集金記録から自動設定、編集不可)</p>
      )}

      <div>
        <label className="text-xs text-muted block mb-1">次回集金予定日 (上書き)</label>
        <input
          type="date"
          value={nextCollection}
          onChange={e => setNextCollection(e.target.value)}
          className={DATE_INPUT_CLASS}
          data-testid="forecast-next-collection-input"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave || saveState === 'saving'}
        data-testid="forecast-settings-save"
        className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${
          canSave && saveState !== 'saving' ? 'bg-accent text-bg active:scale-[0.98]' : 'bg-surface2 text-muted opacity-40'
        }`}
      >
        {saveState === 'saving' ? '保存中...' : saveState === 'saved' ? '✓ 保存しました' : saveState === 'error' ? 'エラー — 再試行' : '保存する'}
      </button>
    </div>
  )
}

export default function ForecastDetail() {
  const { storeCode } = useParams()
  const navigate = useNavigate()
  const { staffId } = useAuth()
  const [detail, setDetail] = useState(null)
  const [storeName, setStoreName] = useState(storeCode)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [d, stores] = await Promise.all([getForecastStoreDetail(storeCode), getAllStores()])
      setDetail(d)
      const match = stores.find(s => s.store_code === storeCode)
      if (match) setStoreName(match.store_name)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [storeCode])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="h-svh flex items-center justify-center bg-bg text-muted text-sm">読み込み中...</div>
    )
  }

  const store = detail?.store
  const noOrigin = store?.origin_source === 'none'

  return (
    <div className="h-svh flex flex-col landscape-short:flex-row max-w-lg md:max-w-3xl mx-auto">
      <LandscapeSideHeader module="admin" title={storeName} subtitle={storeCode} onBack={() => navigate('/admin/forecast')} />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {error && <ErrorDisplay error={error} onRetry={load} onDismiss={() => setError(null)} />}

        {store && !noOrigin && (
          <>
            <div className="bg-surface border border-border rounded-xl p-3">
              <p className="text-xs text-muted mb-1">
                {formatJstDate(store.cycle_start)} 〜 {formatJstDate(store.next_collection)}
                <span className="ml-2">残り{store.days_remaining ?? '—'}日 / 最終読取 {formatJstDate(store.last_reading_date)}</span>
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono mt-1">
                <div>
                  <p className="text-xs text-muted">現在累計</p>
                  <p className="text-lg font-bold">{fmtYen(store.ctd_revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">着地予測 ({formatJstDate(store.next_collection)})</p>
                  <p className="text-lg font-bold text-accent">{fmtYen(store.projected_landing)}</p>
                </div>
              </div>
            </div>

            <ForecastChart daily={detail.daily} />
            <BoothTable booths={detail.booths} />
          </>
        )}

        {store && noOrigin && (
          <div className="bg-surface border border-border rounded-xl p-4 text-center space-y-2">
            <p className="text-sm text-accent font-bold">この店舗は集金記録も開始日設定もありません</p>
            <p className="text-xs text-muted">下でサイクル開始日を設定すると着地予測が計算されます</p>
          </div>
        )}

        {store && <SettingsForm storeCode={storeCode} store={store} staffId={staffId} onSaved={load} />}
      </div>
    </div>
  )
}
