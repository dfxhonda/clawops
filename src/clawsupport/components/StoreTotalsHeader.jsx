// SPEC-PATROL-HISTORY-HEATMAP-01: 10列横スクロール、F3 日付ラベル、F6 全展開トグル。
// MachineRow / MachineRowExpandedBoothList と同一 grid-cols-10 + gap-x-1.5 で列 x 位置一致。

import { useMemo, useRef, useEffect } from 'react'
import {
  VIEW_MODES,
  VIEW_MODE_ORDER,
  COLUMN_HEADERS,
  COLUMN_COUNT,
  NEWEST,
  aggregateSummaries,
  formatCell,
  computeColumnDates,
} from './patrolViewModes'

export function computeStoreTotals(diffMap, mode = 'IN') {
  return aggregateSummaries(Object.values(diffMap || {}), mode)
}

// F3: 'YYYY-MM-DD' → 'M/D' 表示
function fmtDateLabel(dateStr) {
  if (!dateStr) return null
  const parts = dateStr.split('-')
  if (parts.length < 3) return null
  return `${Number(parts[1])}/${Number(parts[2])}`
}

function ModeToggle({ mode, onModeChange }) {
  return (
    <div
      role="tablist"
      data-testid="patrol-view-mode-toggle"
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface/60 p-0.5"
    >
      {VIEW_MODE_ORDER.map(m => {
        const active = m === mode
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`patrol-view-mode-btn-${m}`}
            onClick={() => onModeChange(m)}
            className={`min-h-[36px] px-2.5 rounded text-xs font-bold leading-tight ${
              active ? 'bg-emerald-600 text-white' : 'text-muted active:bg-surface'
            }`}
          >
            {VIEW_MODES[m].label}
          </button>
        )
      })}
    </div>
  )
}

function LabelScrollSection({ diffMap }) {
  const scrollRef = useRef(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [])
  const dates = computeColumnDates(diffMap || {})
  return (
    <div className="shrink-0 overflow-x-auto w-52" ref={scrollRef}>
      <div className="grid grid-cols-10 gap-x-1.5 text-xs text-right leading-tight text-muted w-[360px] mr-[17px] tabular-nums">
        {COLUMN_HEADERS.map((label, i) => {
          const dl = fmtDateLabel(dates[i])
          return (
            <div key={i} data-testid={`store-label-${i}`}>{dl ?? label}</div>
          )
        })}
      </div>
    </div>
  )
}

function ValueScrollSection({ totals, modeDef }) {
  const scrollRef = useRef(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [])
  return (
    <div className="shrink-0 overflow-x-auto w-52" ref={scrollRef}>
      <div className="grid grid-cols-10 gap-x-1.5 text-right leading-tight w-[360px] mr-[17px] tabular-nums">
        {Array.from({ length: COLUMN_COUNT }, (_, i) => (
          <div
            key={i}
            data-testid={`store-value-${i}`}
            className={`font-mono text-sm font-bold ${i === NEWEST ? 'text-green-300' : 'text-text'}`}
          >
            {formatCell(totals[i], modeDef.type)}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StoreTotalsHeader({
  diffMap, leftSlot = null, leftSlot2 = null,
  mode = 'IN', onModeChange = null,
  allExpanded = false, onExpandAllToggle = null,
}) {
  const modeDef = VIEW_MODES[mode] ?? VIEW_MODES.IN
  const totals = useMemo(() => computeStoreTotals(diffMap || {}, mode), [diffMap, mode])
  const showToggle = typeof onModeChange === 'function'
  const showExpandToggle = typeof onExpandAllToggle === 'function'
  return (
    <div data-testid="store-totals-header" className="shrink-0 border-b border-border">
      <div className="px-4 py-1 flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {leftSlot}
          {showToggle && <ModeToggle mode={mode} onModeChange={onModeChange} />}
          {/* F6: 全展開/折畳みトグル */}
          {showExpandToggle && (
            <button
              type="button"
              data-testid="expand-all-toggle"
              onClick={onExpandAllToggle}
              className="text-xs text-muted border border-border rounded px-1.5 py-0.5 active:bg-surface"
            >
              {allExpanded ? '全閉' : '全開'}
            </button>
          )}
        </div>
        <LabelScrollSection diffMap={diffMap} />
      </div>
      <div className="px-4 pb-1.5 flex items-center gap-2">
        <div className="flex-1 min-w-0">{leftSlot2}</div>
        <ValueScrollSection totals={totals} modeDef={modeDef} />
      </div>
    </div>
  )
}
