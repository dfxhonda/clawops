// SPEC-PATROL-HISTORY-HEATMAP-02: 一体横スクロール対応。個別 overflow-x-auto + scrollRef 廃止。
// dateAxis prop を受け取り aggregateSummaries の日付軸ベースリマップを利用。
// F4: text-sm→text-base (data cells), text-base→text-lg (machine name)
// F5: py-1.5→py-1 (row spacing)

import { useState } from 'react'
import Collapse from '../../components/Collapse'
import MachineRowExpandedBoothList from './MachineRowExpandedBoothList'
import { rankColor } from './storeTotalsRanking'
import {
  VIEW_MODES,
  COLUMN_COUNT,
  NEWEST,
  aggregateSummaries,
  formatCellPlain,
  machineBoothSummaries,
} from './patrolViewModes'

export default function MachineRow({
  machine, todayMap, diffMap, onBoothClick, expanded, onToggleExpand, rankMap,
  mode = 'IN', dateAxis = null,
}) {
  const controlled = typeof onToggleExpand === 'function'
  const [localExpanded, setLocalExpanded] = useState(false)
  const isExpanded = controlled ? !!expanded : localExpanded
  const booths = machine.booths ?? []
  const isSingleBooth = booths.length === 1

  const modeDef = VIEW_MODES[mode] ?? VIEW_MODES.IN
  const summaries = machineBoothSummaries(machine, diffMap)
  const totals = aggregateSummaries(summaries, mode, dateAxis)

  const mc = machine.machine_code
  const rank = rankMap?.[mc] ?? null
  const allDone = booths.length > 0 && booths.every(b => !!todayMap[b.booth_code])
  // SPEC-PATROL-HEATMAP-PRIZE-NAME-01 (D-060): 単一ブース機械のみ機械名の下に現在景品名。複数ブースは展開ブース行に個別表示。
  const singlePrizeName = isSingleBooth ? (diffMap[booths[0]?.booth_code]?.latestPrizeName ?? null) : null

  const handleClick = () => {
    if (isSingleBooth) {
      onBoothClick(booths[0])
    } else if (controlled) {
      onToggleExpand()
    } else {
      setLocalExpanded(e => !e)
    }
  }

  return (
    <div data-testid={`machine-row-${machine.machine_code}`}>
      <button
        data-testid={`machine-row-btn-${machine.machine_code}`}
        onClick={handleClick}
        className="w-full flex items-center gap-2 px-4 py-1 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform"
      >
        <div className="w-40 shrink-0 flex flex-col justify-center sticky left-0 z-10 bg-surface">
          <div className="flex items-center min-w-0">
            <span className="text-text text-lg font-bold truncate">{machine.machine_name}</span>
            {allDone && <span data-testid={`machine-row-allDone-${mc}`} className="shrink-0 ml-1 text-emerald-400/70">✓</span>}
          </div>
          {singlePrizeName && (
            <span data-testid={`machine-row-prize-${mc}`} className="text-xs text-muted truncate">{singlePrizeName}</span>
          )}
        </div>
        <div
          data-testid={`machine-totals-${machine.machine_code}`}
          className="grid grid-cols-10 gap-x-2 text-right leading-tight w-[440px] tabular-nums"
        >
          {Array.from({ length: COLUMN_COUNT }, (_, i) => {
            const isToday = i === NEWEST
            const colorClass = isToday ? rankColor(rank, true) : 'text-text'
            return (
              <div
                key={i}
                data-testid={`machine-cell-${mc}-${i}`}
                className={`font-mono text-base font-bold ${colorClass}`}
              >
                {formatCellPlain(totals[i], modeDef.type)}
              </div>
            )
          })}
        </div>
      </button>

      {/* SPEC-MOTION-W2-MACHINEROW-BOOTH-EXPAND-COLLAPSE-01 (D-080) C1: ブース展開を共有 Collapse で常時mount化。
          条件レンダー (DOM 瞬間挿入=いきなり出る) → grid-fr 0fr↔1fr transition で集金金種展開と同じ「ぬるっと」。
          isSingleBooth (単一ブース=展開不要) は従来通り Collapse を mount しない。親に transform 無し (gate_1 確認) なので
          W1 の合成抑制罠なし = iOS でも発火見込み。 */}
      {!isSingleBooth && (
        <Collapse open={isExpanded} testId={`booth-collapse-${machine.machine_code}`}>
          <MachineRowExpandedBoothList
            booths={booths}
            todayMap={todayMap}
            diffMap={diffMap}
            onBoothClick={onBoothClick}
            mode={mode}
            dateAxis={dateAxis}
          />
        </Collapse>
      )}
    </div>
  )
}
