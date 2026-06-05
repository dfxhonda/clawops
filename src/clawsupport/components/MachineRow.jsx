import { useState } from 'react'
import MachineRowExpandedBoothList from './MachineRowExpandedBoothList'
import { rankColor } from './storeTotalsRanking'
import {
  VIEW_MODES,
  COLUMN_COUNT,
  aggregateSummaries,
  formatCell,
  machineBoothSummaries,
} from './patrolViewModes'

// SPEC-PATROL-VIEW-MODE-SWITCH-02:
// mode (IN/DAILY/OUT) で 4 列 (4 前 / 3 前 / 前回 / 今回) の値が切り替わる。
// 機械集計は aggregateSummaries: count 系は SUM、daily は重み付き平均 SUM(in)/SUM(days)。
// best/worst 色は「今回」(display index 3) 列のみに適用、他列は plain。
const NEWEST = 3

export default function MachineRow({
  machine, todayMap, diffMap, onBoothClick, expanded, onToggleExpand, rankMap,
  mode = 'IN',
}) {
  const controlled = typeof onToggleExpand === 'function'
  const [localExpanded, setLocalExpanded] = useState(false)
  const isExpanded = controlled ? !!expanded : localExpanded
  const booths = machine.booths ?? []
  const isSingleBooth = booths.length === 1

  const modeDef = VIEW_MODES[mode] ?? VIEW_MODES.IN
  const summaries = machineBoothSummaries(machine, diffMap)
  const totals = aggregateSummaries(summaries, mode)

  const mc = machine.machine_code
  const rank = rankMap?.[mc] ?? null
  const allDone = booths.length > 0 && booths.every(b => !!todayMap[b.booth_code])

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
        className="w-full flex items-center gap-2 px-4 py-1.5 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform"
      >
        <div className="flex-1 min-w-0 flex items-center">
          <span className="text-text text-base font-bold truncate">{machine.machine_name}</span>
          {allDone && <span data-testid={`machine-row-allDone-${mc}`} className="shrink-0 ml-1 text-emerald-400/70">✓</span>}
        </div>
        <div
          data-testid={`machine-totals-${machine.machine_code}`}
          className="shrink-0 grid grid-cols-4 gap-x-1.5 text-right leading-tight w-52"
        >
          {Array.from({ length: COLUMN_COUNT }, (_, i) => {
            const isToday = i === NEWEST
            const colorClass = isToday ? rankColor(rank, true) : 'text-text'
            return (
              <div
                key={i}
                data-testid={`machine-cell-${mc}-${i}`}
                className={`font-mono text-sm font-bold ${colorClass}`}
              >
                {formatCell(totals[i], modeDef.type)}
              </div>
            )
          })}
        </div>
      </button>

      {!isSingleBooth && isExpanded && (
        <MachineRowExpandedBoothList
          booths={booths}
          todayMap={todayMap}
          diffMap={diffMap}
          onBoothClick={onBoothClick}
          mode={mode}
        />
      )}
    </div>
  )
}
