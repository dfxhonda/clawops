import { useState } from 'react'
import DiffChip from './DiffChip'
import MachineRowExpandedBoothList from './MachineRowExpandedBoothList'

function Chevron({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`w-5 h-5 ${className}`}
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function MachineRow({ machine, todayMap, diffMap, onBoothClick }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const booths = machine.booths ?? []
  const isSingleBooth = booths.length === 1

  let inTotal = null
  let outTotal = null
  for (const b of booths) {
    const d = diffMap[b.booth_code]
    if (!d) continue
    if (d.inDiff != null) inTotal = (inTotal ?? 0) + d.inDiff
    if (d.outDiff != null) outTotal = (outTotal ?? 0) + d.outDiff
  }

  const doneCnt = booths.filter(b => !!todayMap[b.booth_code]).length
  const allDone = doneCnt === booths.length && booths.length > 0

  const handleClick = () => {
    if (isSingleBooth) {
      onBoothClick(booths[0])
    } else {
      setIsExpanded(e => !e)
    }
  }

  return (
    <div data-testid={`machine-row-${machine.machine_code}`}>
      <button
        data-testid={`machine-row-btn-${machine.machine_code}`}
        onClick={handleClick}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform"
      >
        <span className={`text-lg shrink-0 ${allDone ? 'text-emerald-400' : 'text-muted/30'}`}>
          {allDone ? '✓' : '○'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-text text-base font-bold truncate">{machine.machine_name}</p>
          {!isSingleBooth && (
            <p className="text-muted text-base mt-0.5">{doneCnt}/{booths.length} 完了</p>
          )}
          {isSingleBooth && allDone && (
            <p className="text-emerald-400/70 text-base mt-0.5">入力済み</p>
          )}
        </div>
        {(inTotal != null || outTotal != null) && (
          <div className="flex gap-1 ml-auto shrink-0">
            <DiffChip label="IN" value={inTotal} />
            <DiffChip label="OUT" value={outTotal} />
          </div>
        )}
        {!isSingleBooth && (
          <span
            data-testid={`chevron-${machine.machine_code}`}
            className={`text-muted shrink-0 transition-transform duration-200 inline-flex ${isExpanded ? 'rotate-90' : ''}`}
          >
            <Chevron className="" />
          </span>
        )}
      </button>

      {!isSingleBooth && isExpanded && (
        <MachineRowExpandedBoothList
          booths={booths}
          todayMap={todayMap}
          diffMap={diffMap}
          onBoothClick={onBoothClick}
        />
      )}
    </div>
  )
}
