// SPEC-PATROL-HISTORY-HEATMAP-02: 一体横スクロール対応。個別 overflow-x-auto + scrollRef 廃止。
// dateAxis prop を受け取り aggregateSummaries の日付軸ベースリマップを利用。
// F4: text-sm→text-base (data cells), text-base→text-lg (machine name)
// F5: py-1.5→py-1 (row spacing)

import { useState } from 'react'
import MachineRowExpandedBoothList from './MachineRowExpandedBoothList'
import { rankColor } from './storeTotalsRanking'
import {
  VIEW_MODES,
  COLUMN_COUNT,
  NEWEST,
  aggregateSummaries,
  formatCell,
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
        <div className="w-40 shrink-0 flex items-center sticky left-0 z-10 bg-surface">
          <span className="text-text text-lg font-bold truncate">{machine.machine_name}</span>
          {allDone && <span data-testid={`machine-row-allDone-${mc}`} className="shrink-0 ml-1 text-emerald-400/70">✓</span>}
        </div>
        <div
          data-testid={`machine-totals-${machine.machine_code}`}
          className="grid grid-cols-10 gap-x-1 text-right leading-tight w-[400px] tabular-nums"
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
          dateAxis={dateAxis}
        />
      )}
    </div>
  )
}
