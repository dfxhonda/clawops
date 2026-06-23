// SPEC-PATROL-HISTORY-HEATMAP-02: 一体横スクロール対応。個別 overflow-x-auto 廃止。
// PatrolStorePage の unified scroll に組み込まれる。dateAxis prop で店舗共通日付軸受取。
// mode toggle / expand toggle は PatrolStorePage のコントロールバーに移動。

import { useMemo } from 'react'
import {
  VIEW_MODES,
  COLUMN_COUNT,
  NEWEST,
  aggregateSummaries,
  formatCell,
} from './patrolViewModes'

export function computeStoreTotals(diffMap, mode = 'IN', dateAxis = null) {
  return aggregateSummaries(Object.values(diffMap || {}), mode, dateAxis)
}

// 'YYYY-MM-DD' → 'M/D' (JST safe: patrol_date 直使用、toISOString 禁止)
function fmtDateLabel(dateStr) {
  if (!dateStr) return null
  const parts = dateStr.split('-')
  if (parts.length < 3) return null
  return `${Number(parts[1])}/${Number(parts[2])}`
}

export default function StoreTotalsHeader({ diffMap, dateAxis = null, mode = 'IN' }) {
  const modeDef = VIEW_MODES[mode] ?? VIEW_MODES.IN
  const totals = useMemo(
    () => computeStoreTotals(diffMap || {}, mode, dateAxis),
    [diffMap, mode, dateAxis],
  )
  return (
    <div data-testid="store-totals-header" className="border-b border-border">
      <div className="px-4 pt-1 flex items-center gap-2">
        <div className="w-40 shrink-0 sticky left-0 z-10 bg-surface" />
        <div className="grid grid-cols-10 gap-x-1 text-base text-right leading-tight text-muted w-[400px] tabular-nums">
          {Array.from({ length: COLUMN_COUNT }, (_, i) => (
            <div key={i} data-testid={`store-label-${i}`}>
              {fmtDateLabel(dateAxis?.[i]) ?? ''}
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 pb-1 flex items-center gap-2">
        <div className="w-40 shrink-0 text-sm text-muted sticky left-0 z-10 bg-surface">合計</div>
        <div className="grid grid-cols-10 gap-x-1 text-right leading-tight w-[400px] tabular-nums">
          {Array.from({ length: COLUMN_COUNT }, (_, i) => (
            <div
              key={i}
              data-testid={`store-value-${i}`}
              className={`font-mono text-base font-bold ${i === NEWEST ? 'text-green-300' : 'text-text'}`}
            >
              {formatCell(totals[i], modeDef.type)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
