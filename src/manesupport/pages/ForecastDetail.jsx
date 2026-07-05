// SPEC-ADMIN-FORECAST-CYCLE-S2-UI-01: 集金サイクル売上着地予測 店舗詳細
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Label,
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

// SPEC-S2D2: compact k-format for y-axis ticks (¥800,000 -> 800k). Ticks only;
// tooltip/table/summary keep full fmtYen (values unchanged).
export function fmtYenK(v) {
  if (v == null || v === '') return ''
  const num = typeof v === 'string' ? parseFloat(v) : Number(v)
  if (isNaN(num)) return ''
  if (num === 0) return '0'
  const abs = Math.abs(num)
  if (abs < 1000) return String(Math.round(num))
  return `${Math.round(num / 1000)}k`
}

// SPEC-S2D2: JS mirror of the CSS `landscape-short` variant
// (@media (orientation: landscape) and (max-height: 500px)) — Recharts props
// (mirror/inside ticks) can't key off a Tailwind variant, so detect in JS.
const LANDSCAPE_SHORT_QUERY = '(orientation: landscape) and (max-height: 500px)'
function useLandscapeShort() {
  const [match, setMatch] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(LANDSCAPE_SHORT_QUERY).matches
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(LANDSCAPE_SHORT_QUERY)
    const onChange = () => setMatch(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return match
}

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
    return { d: r.d, value: r.actual_cum ?? r.projected_cum, isLanding: i === rows.length - 1, isFirst: i === 0 }
  })
}

// SPEC-S2D2: 2-line (date / amount) milestone label, clamped INSIDE chart bounds.
// Horizontal clamp via textAnchor (landing -> end grows left, first -> start grows
// right, else middle); vertical clamp: landing / top-edge dots render below.
export function MilestoneLabel({ viewBox, m, landscapeShort }) {
  const vb = viewBox || {}
  // ReferenceDot's cartesian viewBox is the dot's bounding box {x,y,width,height};
  // recover the dot center. Fallback to cx/cy or bare x/y for other callers/tests.
  const cx = vb.x != null ? vb.x + (vb.width ?? 0) / 2 : vb.cx
  const cy = vb.y != null ? vb.y + (vb.height ?? 0) / 2 : vb.cy
  if (cx == null || cy == null || !m) return null
  const anchor = m.isLanding ? 'end' : m.isFirst ? 'start' : 'middle'
  // landscape renders y ticks INSIDE the plot at the left; push the first-point
  // label clear of that tick column (AC2: no overlap).
  const firstDx = landscapeShort ? 18 : 6
  const dx = m.isLanding ? -6 : m.isFirst ? firstDx : 0
  const fontSize = m.isLanding ? 11 : 9
  const lineGap = fontSize + 1
  const below = m.isLanding || cy < 28 // top-edge dots flip below to avoid clipping
  const line1Y = below ? cy + 14 + fontSize : cy - 10 - lineGap
  const x = cx + dx
  return (
    <text
      x={x}
      y={line1Y}
      textAnchor={anchor}
      fontSize={fontSize}
      fontWeight={m.isLanding ? 'bold' : 'normal'}
      fill={m.isLanding ? 'var(--color-accent)' : 'var(--color-text-dim)'}
    >
      <tspan x={x} dy={0}>{formatJstDate(m.d).slice(5)}</tspan>
      <tspan x={x} dy={lineGap}>{fmtYen(m.value)}</tspan>
    </text>
  )
}

// SPEC-S2D2: landscape-short only — y tick label rotated vertical, rendered inside
// the plot (paired with YAxis mirror) so the plot claims the former axis gutter.
// Vertical (thin) keeps the ticks out of the first data-point label's way.
function VerticalYTick({ x, y, payload }) {
  return (
    <g transform={`translate(${(x ?? 0) + 7},${y ?? 0}) rotate(-90)`}>
      <text textAnchor="middle" dy={3} fontSize={9} fill="var(--color-text-dim)">
        {fmtYenK(payload?.value)}
      </text>
    </g>
  )
}

function ForecastChart({ daily }) {
  const chartData = useMemo(() => buildChartData(daily), [daily])
  const milestones = useMemo(() => pickMilestones(chartData), [chartData])
  const landscapeShort = useLandscapeShort()

  if (!chartData.length) {
    return <p className="text-center text-muted text-sm py-8">推移データがありません</p>
  }

  // SPEC-S2D2: landscape-short renders y ticks INSIDE the plot (mirror + vertical
  // angle, narrow gutter) so the plot claims the full width; portrait keeps normal
  // outside ticks. Both use compact k-format.
  const yAxisProps = landscapeShort
    ? { mirror: true, width: 14, tick: <VerticalYTick /> }
    : { width: 40, tickFormatter: fmtYenK }

  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <p className="text-xs font-bold text-muted mb-2">売上推移 (実績 + 予測)</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="d" stroke="var(--color-text-dim)" fontSize={10} tickFormatter={d => formatJstDate(d)} />
          <YAxis stroke="var(--color-text-dim)" fontSize={10} {...yAxisProps} />
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
              label={<Label content={props => <MilestoneLabel {...props} m={m} landscapeShort={landscapeShort} />} />}
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
