// SPEC-PATROL-HISTORY-CROSS-FREEZE-02 (D-110): ヒートマップを table 化。本コンポーネントは <thead>。
// 日付ラベル行 + 合計行を <th> で出し、sticky top で縦フリーズ。左端 th:first-child は左上コーナー(左+上, z最上位)。
// 全 sticky セルは不透明 bg (bg-surface #13131c)。列幅は親 table の <colgroup> + table-layout:fixed が決める。
import { useMemo } from 'react'
import {
  VIEW_MODES,
  COLUMN_COUNT,
  NEWEST,
  aggregateSummaries,
  formatCellPlain,
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

// z階層: 左上コーナー(40) > 上端ヘッダー行(30) > 左端列(20) > 中央(0)。h-7=28px ゆえ2行目 sticky top-7。
const HEAD_ROW1 = 'sticky top-0 z-30 bg-surface'
const HEAD_ROW2 = 'sticky top-7 z-30 bg-surface'
const CORNER_ROW1 = 'sticky left-0 top-0 z-40 bg-surface'
const CORNER_ROW2 = 'sticky left-0 top-7 z-40 bg-surface'

export default function StoreTotalsHeader({ diffMap, dateAxis = null, mode = 'IN', accumMap = {} }) {
  const modeDef = VIEW_MODES[mode] ?? VIEW_MODES.IN
  const totals = useMemo(
    () => computeStoreTotals(diffMap || {}, mode, dateAxis),
    [diffMap, mode, dateAxis],
  )
  // SPEC-PATROL-ACCUM-COL-S3-DISPLAY-01 (D-098): 全店の前回集金後累計 合計。
  const accumTotal = useMemo(() => sumAccum(accumMap), [accumMap])
  return (
    <thead data-testid="store-totals-header">
      {/* 日付ラベル行 */}
      <tr>
        <th className={`h-7 px-2 text-left border-b border-border ${CORNER_ROW1}`} />
        {/* SPEC-PATROL-ACCUM-COL-S3-DISPLAY-01 (D-098): 累計列ヘッダ (列幅は colgroup)。 */}
        <th data-testid="store-accum-header" className={`h-7 px-1 text-right text-base leading-tight text-amber-300/80 border-b border-border ${HEAD_ROW1}`}>累計</th>
        {Array.from({ length: COLUMN_COUNT }, (_, i) => (
          <th key={i} data-testid={`store-label-${i}`} className={`h-7 px-1 text-right text-base leading-tight text-muted tabular-nums border-b border-border ${HEAD_ROW1}`}>
            {fmtDateLabel(dateAxis?.[i]) ?? ''}
          </th>
        ))}
      </tr>
      {/* 合計行 */}
      <tr>
        <th className={`h-7 px-2 text-left text-sm text-muted border-b border-border ${CORNER_ROW2}`}>合計</th>
        {/* SPEC-PATROL-ACCUM-COL-S3-DISPLAY-01 (D-098): 全店累計合計 (カンマ抜き/null='−')。 */}
        <th data-testid="store-accum-total" className={`h-7 px-1 text-right font-mono text-base font-bold tabular-nums text-amber-300 border-b border-border ${HEAD_ROW2}`}>
          {formatCellPlain(accumTotal, 'count')}
        </th>
        {Array.from({ length: COLUMN_COUNT }, (_, i) => (
          <th key={i} data-testid={`store-value-${i}`} className={`h-7 px-1 text-right font-mono text-base font-bold tabular-nums border-b border-border ${i === NEWEST ? 'text-green-300' : 'text-text'} ${HEAD_ROW2}`}>
            {formatCellPlain(totals[i], modeDef.type)}
          </th>
        ))}
      </tr>
    </thead>
  )
}
