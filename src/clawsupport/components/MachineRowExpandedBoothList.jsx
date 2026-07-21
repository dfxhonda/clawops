// SPEC-PATROL-HISTORY-HEATMAP-02: 一体横スクロール対応。BoothScrollCells の overflow-x-auto 廃止。
// dateAxis prop でリマップ。F4 ワースト赤テキスト、F5 entry_type 背景色は維持。
// F4: text-sm→text-base (data cells, booth label)
// F5: py-1→py-0.5 (booth row spacing)

import { useMemo } from 'react'
import {
  VIEW_MODES,
  COLUMN_COUNT,
  NEWEST,
  formatCellPlain,
  sourceArrayFor,
  computeWorstBoothMap,
  mapSummaryToDateAxis,
  ACCUM_COL_WIDTH,
} from './patrolViewModes'

// F5: entry_type ごとの背景色
const ENTRY_BG = {
  replace: 'bg-blue-900/40',
  config:  'bg-green-900/30',
}

function BoothScrollCells({ arr, entryTypes, boothWorst, boothCode, modeDef }) {
  return (
    <div className="grid grid-cols-10 gap-x-2 text-right leading-tight w-[440px] tabular-nums">
      {Array.from({ length: COLUMN_COUNT }, (_, i) => {
        const worstColor = boothWorst?.[i] ?? null
        const textColor = worstColor ?? (i === NEWEST ? 'text-green-300' : 'text-text')
        const bgClass = ENTRY_BG[entryTypes?.[i]] ?? ''
        return (
          <div
            key={i}
            data-testid={`booth-cell-${boothCode}-${i}`}
            className={`font-mono text-base font-bold ${textColor} ${bgClass}`}
          >
            {formatCellPlain(arr[i], modeDef.type)}
          </div>
        )
      })}
    </div>
  )
}

export default function MachineRowExpandedBoothList({
  booths, todayMap, diffMap, onBoothClick, mode = 'IN', dateAxis = null, accumMap = {},
}) {
  const modeDef = VIEW_MODES[mode] ?? VIEW_MODES.IN

  const worstMap = useMemo(
    () => computeWorstBoothMap(diffMap, mode, dateAxis),
    [diffMap, mode, dateAxis],
  )

  return (
    <div className="mt-1 space-y-0.5" data-testid="machine-expanded-booth-list">
      {booths.map(booth => {
        const done = !!todayMap?.[booth.booth_code]
        const d = diffMap[booth.booth_code] ?? null
        const mapped = dateAxis ? mapSummaryToDateAxis(d, dateAxis) : d
        const arr = sourceArrayFor(mapped, mode)
        const entryTypes = mapped?.entryTypes ?? []
        const boothWorst = worstMap[booth.booth_code] ?? null
        // SPEC-PATROL-HEATMAP-PRIZE-NAME-01 (D-060): 各ブース行に現在景品名 (null/空は非表示)
        const prizeName = d?.latestPrizeName ?? null
        return (
          <button
            key={booth.booth_code}
            data-testid={`booth-row-${booth.booth_code}`}
            onClick={() => onBoothClick(booth)}
            className="w-full flex items-center gap-2 px-4 py-0.5 rounded-xl bg-surface/40 border border-border/40 text-left active:scale-[0.98] transition-transform"
          >
            {/* SPEC-PATROL-HISTORY-CROSS-FREEZE-01 (D-110): 左端ブース名列。単一コンテナ内で sticky left-0 横固定 (中位 z-20)。bg 不透明で透けなし。 */}
            <div className="w-40 shrink-0 pl-4 sticky left-0 z-20 bg-surface">
              <p className="text-text text-base">
                └ B{String(booth.booth_number).padStart(2, '0')}
                {done && <span className="ml-1 text-emerald-400/70">✓</span>}
              </p>
              {prizeName && (
                <p data-testid={`booth-row-prize-${booth.booth_code}`} className="text-xs text-muted truncate pl-3">{prizeName}</p>
              )}
            </div>
            {/* SPEC-PATROL-ACCUM-COL-S3-DISPLAY-01 (D-098): ブース別 前回集金後累計 固定列 (機械行と同幅=同位置)。 */}
            <div
              data-testid={`booth-accum-${booth.booth_code}`}
              className={`${ACCUM_COL_WIDTH} font-mono text-base font-bold text-right tabular-nums text-amber-300`}
            >
              {formatCellPlain(accumMap[booth.booth_code]?.accum ?? null, 'count')}
            </div>
            <BoothScrollCells
              arr={arr}
              entryTypes={entryTypes}
              boothWorst={boothWorst}
              boothCode={booth.booth_code}
              modeDef={modeDef}
            />
          </button>
        )
      })}
    </div>
  )
}
