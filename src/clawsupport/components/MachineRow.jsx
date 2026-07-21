// SPEC-PATROL-HISTORY-CROSS-FREEZE-02 (D-110): 機械集約行を <tr> で描画 (table 化)。
// 左端機械名は <th scope="row"> = sticky left-0 横フリーズ (中位 z-20, 不透明 bg)。数値は <td>。
// アコーディオン(展開)廃止 = 機械ビューは集約のみ。ブース詳細はブースビュー(BoothFlatRows)へ。
// 供給値(totals/machineAccum)・色(rankColor)・カンマ抜き(formatCellPlain) は挙動不変。
import { rankColor } from './storeTotalsRanking'
import {
  VIEW_MODES,
  COLUMN_COUNT,
  NEWEST,
  aggregateSummaries,
  formatCellPlain,
  machineBoothSummaries,
  sumAccum,
} from './patrolViewModes'

const STICKY_LEFT = 'sticky left-0 z-20 bg-surface'

export default function MachineRow({
  machine, todayMap, diffMap, onBoothClick, rankMap,
  mode = 'IN', dateAxis = null, accumMap = {},
}) {
  const booths = machine.booths ?? []
  const isSingleBooth = booths.length === 1

  const modeDef = VIEW_MODES[mode] ?? VIEW_MODES.IN
  const summaries = machineBoothSummaries(machine, diffMap)
  const totals = aggregateSummaries(summaries, mode, dateAxis)
  // SPEC-PATROL-ACCUM-COL-S3-DISPLAY-01 (D-098): 当該機械=全boothの前回集金後累計を合算。
  const machineAccum = sumAccum(accumMap, booths.map(b => b.booth_code))

  const mc = machine.machine_code
  const rank = rankMap?.[mc] ?? null
  const allDone = booths.length > 0 && booths.every(b => !!todayMap[b.booth_code])
  // SPEC-PATROL-HEATMAP-PRIZE-NAME-01 (D-060): 単一ブース機械のみ機械名の下に現在景品名。
  const singlePrizeName = isSingleBooth ? (diffMap[booths[0]?.booth_code]?.latestPrizeName ?? null) : null

  // 機械ビューは集約把握用。単一ブース機械のみ行タップでそのブースへ遷移 (複数ブースはブースビューで個別遷移)。
  const clickable = isSingleBooth && typeof onBoothClick === 'function'
  const handleClick = () => { if (clickable) onBoothClick(booths[0]) }

  return (
    <tr
      data-testid={`machine-row-${mc}`}
      onClick={handleClick}
      className={`border-b border-border/40 ${clickable ? 'cursor-pointer active:bg-surface/60' : ''}`}
    >
      <th scope="row" className={`px-2 py-1 text-left align-middle ${STICKY_LEFT}`}>
        <div className="flex items-center min-w-0">
          <span className="text-text text-lg font-bold truncate">{machine.machine_name}</span>
          {allDone && <span data-testid={`machine-row-allDone-${mc}`} className="shrink-0 ml-1 text-emerald-400/70">✓</span>}
        </div>
        {singlePrizeName && (
          <span data-testid={`machine-row-prize-${mc}`} className="block text-xs text-muted truncate">{singlePrizeName}</span>
        )}
      </th>
      {/* SPEC-PATROL-ACCUM-COL-S3-DISPLAY-01 (D-098): 前回集金後累計 (カンマ抜き/null='−')。日付軸の外の固定列。 */}
      <td data-testid={`machine-accum-${mc}`} className="px-1 py-1 text-right font-mono text-base font-bold tabular-nums text-amber-300">
        {formatCellPlain(machineAccum, 'count')}
      </td>
      {Array.from({ length: COLUMN_COUNT }, (_, i) => {
        const isToday = i === NEWEST
        const colorClass = isToday ? rankColor(rank, true) : 'text-text'
        return (
          <td
            key={i}
            data-testid={`machine-cell-${mc}-${i}`}
            className={`px-1 py-1 text-right font-mono text-base font-bold tabular-nums ${colorClass}`}
          >
            {formatCellPlain(totals[i], modeDef.type)}
          </td>
        )
      })}
    </tr>
  )
}
