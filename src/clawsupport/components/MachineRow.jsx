import { useRef, useEffect, useState } from 'react'
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

// SPEC-PATROL-HISTORY-HEATMAP-01: 10列横スクロール。
// mode (IN/DAILY/OUT) で 10 列の値が切り替わる。
// 機械集計は aggregateSummaries: count 系は SUM、daily は重み付き平均 SUM(in)/SUM(days)。
// best/worst 色は「今回」(display index 9) 列のみに適用、他列は plain。

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

  // スクロールを最右端 (最新列) へ初期化
  const scrollRef = useRef(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [])

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
        <div className="shrink-0 overflow-x-auto w-52" ref={scrollRef}>
          <div
            data-testid={`machine-totals-${machine.machine_code}`}
            className="grid grid-cols-10 gap-x-1.5 text-right leading-tight w-[360px] tabular-nums"
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
