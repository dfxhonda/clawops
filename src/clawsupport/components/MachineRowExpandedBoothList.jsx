// SPEC-PATROL-HISTORY-CROSS-FREEZE-02 (D-110): 役割変更 = ブースビューのフラットブース行描画 (BoothFlatRows)。
// 旧「機械展開ブースリスト」から、全機械横断のフラットブース行 (<tr> 群) を返す描画に載せ替え。
// 左端ブース名 = <th scope="row"> sticky left-0 横フリーズ (中位 z-20, 不透明 bg)。行タップでそのブースへ遷移。
// entries は page 側で 機械順/ランキング に並べ替え済 (集計はしない、既存供給値の並び替えのみ)。
import { useMemo } from 'react'
import {
  VIEW_MODES,
  COLUMN_COUNT,
  NEWEST,
  formatCellPlain,
  sourceArrayFor,
  computeWorstBoothMap,
  mapSummaryToDateAxis,
} from './patrolViewModes'

// F5: entry_type ごとの背景色 (中央セルのみ、sticky セルには付けない)
const ENTRY_BG = {
  replace: 'bg-blue-900/40',
  config:  'bg-green-900/30',
}

const STICKY_LEFT = 'sticky left-0 z-20 bg-surface'

// entries: [{ booth, machine }] のフラット配列 (全機械横断、page で並べ替え済)。
export default function BoothFlatRows({
  entries, todayMap, diffMap, onBoothClick, mode = 'IN', dateAxis = null, accumMap = {},
}) {
  const modeDef = VIEW_MODES[mode] ?? VIEW_MODES.IN

  const worstMap = useMemo(
    () => computeWorstBoothMap(diffMap, mode, dateAxis),
    [diffMap, mode, dateAxis],
  )

  return (
    <>
      {(entries ?? []).map(({ booth, machine }) => {
        const done = !!todayMap?.[booth.booth_code]
        const d = diffMap[booth.booth_code] ?? null
        const mapped = dateAxis ? mapSummaryToDateAxis(d, dateAxis) : d
        const arr = sourceArrayFor(mapped, mode)
        const entryTypes = mapped?.entryTypes ?? []
        const boothWorst = worstMap[booth.booth_code] ?? null
        // SPEC-PATROL-HEATMAP-PRIZE-NAME-01 (D-060): 各ブース行に現在景品名 (null/空は非表示)
        const prizeName = d?.latestPrizeName ?? null
        return (
          <tr
            key={booth.booth_code}
            data-testid={`booth-row-${booth.booth_code}`}
            onClick={() => onBoothClick(booth)}
            className="border-b border-border/40 cursor-pointer active:bg-surface/60"
          >
            <th scope="row" className={`px-2 py-0.5 text-left align-middle ${STICKY_LEFT}`}>
              <p className="text-text text-sm font-bold truncate">
                {machine?.machine_name ? `${machine.machine_name} ` : ''}B{String(booth.booth_number).padStart(2, '0')}
                {done && <span className="ml-1 text-emerald-400/70">✓</span>}
              </p>
              {prizeName && (
                <p data-testid={`booth-row-prize-${booth.booth_code}`} className="text-xs text-muted truncate">{prizeName}</p>
              )}
            </th>
            {/* SPEC-PATROL-ACCUM-COL-S3-DISPLAY-01 (D-098): ブース別 前回集金後累計。 */}
            <td data-testid={`booth-accum-${booth.booth_code}`} className="px-1 py-0.5 text-right font-mono text-base font-bold tabular-nums text-amber-300">
              {formatCellPlain(accumMap[booth.booth_code]?.accum ?? null, 'count')}
            </td>
            {Array.from({ length: COLUMN_COUNT }, (_, i) => {
              const worstColor = boothWorst?.[i] ?? null
              const textColor = worstColor ?? (i === NEWEST ? 'text-green-300' : 'text-text')
              const bgClass = ENTRY_BG[entryTypes?.[i]] ?? ''
              return (
                <td
                  key={i}
                  data-testid={`booth-cell-${booth.booth_code}-${i}`}
                  className={`px-1 py-0.5 text-right font-mono text-base font-bold tabular-nums ${textColor} ${bgClass}`}
                >
                  {formatCellPlain(arr[i], modeDef.type)}
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}
