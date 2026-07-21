// SPEC-PATROL-HISTORY-HEATMAP-02: 一体横スクロール対応。個別 overflow-x-auto 廃止。
// PatrolStorePage の unified scroll に組み込まれる。dateAxis prop で店舗共通日付軸受取。
// mode toggle / expand toggle は PatrolStorePage のコントロールバーに移動。

import { useMemo } from 'react'
import {
  VIEW_MODES,
  COLUMN_COUNT,
  NEWEST,
  aggregateSummaries,
  formatCellPlain,
  ACCUM_COL_WIDTH,
  sumAccum,
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

export default function StoreTotalsHeader({ diffMap, dateAxis = null, mode = 'IN', accumMap = {} }) {
  const modeDef = VIEW_MODES[mode] ?? VIEW_MODES.IN
  const totals = useMemo(
    () => computeStoreTotals(diffMap || {}, mode, dateAxis),
    [diffMap, mode, dateAxis],
  )
  // SPEC-PATROL-ACCUM-COL-S3-DISPLAY-01 (D-098): 全店の前回集金後累計 合計。
  const accumTotal = useMemo(() => sumAccum(accumMap), [accumMap])
  // SPEC-PATROL-HISTORY-CROSS-FREEZE-01 (D-110): 単一スクロールコンテナ内で日付ヘッダー行を sticky top-0 縦固定。
  // 左端ラベルセルは左上コーナー (sticky left-0 top-0, z最上位)。bg 不透明 (#0a0a0f/#13131c) で中央数値の透けなし。
  return (
    <div data-testid="store-totals-header" className="border-b border-border sticky top-0 z-30 bg-bg">
      <div className="px-4 pt-1 flex items-center gap-2">
        <div className="w-40 shrink-0 sticky left-0 top-0 z-40 bg-surface" />
        {/* SPEC-PATROL-ACCUM-COL-S3-DISPLAY-01 (D-098): 累計列ヘッダラベル (日付ラベル行と同段)。 */}
        <div className={`${ACCUM_COL_WIDTH} text-base text-right leading-tight text-amber-300/80`}>累計</div>
        <div className="grid grid-cols-10 gap-x-2 text-base text-right leading-tight text-muted w-[440px] tabular-nums">
          {Array.from({ length: COLUMN_COUNT }, (_, i) => (
            <div key={i} data-testid={`store-label-${i}`}>
              {fmtDateLabel(dateAxis?.[i]) ?? ''}
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 pb-1 flex items-center gap-2">
        <div className="w-40 shrink-0 text-sm text-muted sticky left-0 top-0 z-40 bg-surface">合計</div>
        {/* SPEC-PATROL-ACCUM-COL-S3-DISPLAY-01 (D-098): 全店累計合計 (合計行と同段、カンマ抜き/null='−')。 */}
        <div
          data-testid="store-accum-total"
          className={`${ACCUM_COL_WIDTH} font-mono text-base font-bold text-right tabular-nums text-amber-300`}
        >
          {formatCellPlain(accumTotal, 'count')}
        </div>
        <div className="grid grid-cols-10 gap-x-2 text-right leading-tight w-[440px] tabular-nums">
          {Array.from({ length: COLUMN_COUNT }, (_, i) => (
            <div
              key={i}
              data-testid={`store-value-${i}`}
              className={`font-mono text-base font-bold ${i === NEWEST ? 'text-green-300' : 'text-text'}`}
            >
              {formatCellPlain(totals[i], modeDef.type)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
