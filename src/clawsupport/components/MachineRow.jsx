import { useState } from 'react'
import MachineRowExpandedBoothList from './MachineRowExpandedBoothList'
import { rankColor } from './storeTotalsRanking'
import { VIEW_MODES, aggregateSummaries, formatCell, machineBoothSummaries } from './patrolViewModes'

// J-PATROL-IN-DAILY-fix-05 ad-hoc (ヒロ Discord IMG_4234):
// 行縦圧縮 (py-3 → py-1.5)、grid gap-x-1.5 で数値間隔開け、各列にベスト3/ワースト3 色付け。
// SPEC-PATROL-VIEW-MODE-SWITCH-01: mode prop (IN/OUT/STOCK) で表示列が切り替わる。
//   IN     = 前IN/今IN/前/日/今/日
//   OUT    = 前OUT/今OUT/前出率%/今出率%
//   STOCK  = 前在庫/今在庫/前補充/今補充
// 集計は aggregateSummaries: count は SUM、出率は SUM(out)/SUM(in)*100 の重み付き平均。

export default function MachineRow({
  machine, todayMap, diffMap, onBoothClick, expanded, onToggleExpand, rankMap,
  mode = 'IN',
}) {
  const controlled = typeof onToggleExpand === 'function'
  const [localExpanded, setLocalExpanded] = useState(false)
  const isExpanded = controlled ? !!expanded : localExpanded
  const booths = machine.booths ?? []
  const isSingleBooth = booths.length === 1

  const cols = (VIEW_MODES[mode] ?? VIEW_MODES.IN).cols
  const summaries = machineBoothSummaries(machine, diffMap)
  const totals = aggregateSummaries(summaries, mode)

  const mc = machine.machine_code

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
        <div className="flex-1 min-w-0">
          <p className="text-text text-base font-bold truncate">{machine.machine_name}</p>
        </div>
        <div
          data-testid={`machine-totals-${machine.machine_code}`}
          className="shrink-0 grid grid-cols-4 gap-x-1.5 text-right leading-tight w-52"
        >
          {cols.map(c => {
            const rank = rankMap?.[c.key]?.[mc] ?? null
            return (
              <div
                key={c.key}
                data-testid={`machine-cell-${mc}-${c.key}`}
                className={`font-mono text-sm font-bold ${rankColor(rank, !!c.today)}`}
              >
                {formatCell(totals[c.key], c.type)}
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
