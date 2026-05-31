import { useState } from 'react'
import MachineRowExpandedBoothList from './MachineRowExpandedBoothList'
import { rankColor } from './storeTotalsRanking'

// J-PATROL-IN-DAILY-fix-05 ad-hoc (ヒロ Discord IMG_4234):
// 行縦圧縮 (py-3 → py-1.5)、grid gap-x-1.5 で数値間隔開け、各列にベスト3/ワースト3 色付け。
function fmtSigned(n) {
  if (n == null) return '−'
  return n.toLocaleString()
}
function fmtPerDay(n) {
  if (n == null) return '−'
  return n.toFixed(1)
}

function machineTotals(booths, diffMap) {
  const t = { prevIn: null, currIn: null, prevPerDay: null, currPerDay: null }
  for (const b of booths) {
    const d = diffMap[b.booth_code]
    if (!d) continue
    if (d.prevIn != null)     t.prevIn     = (t.prevIn     ?? 0) + d.prevIn
    if (d.currIn != null)     t.currIn     = (t.currIn     ?? 0) + d.currIn
    if (d.prevPerDay != null) t.prevPerDay = (t.prevPerDay ?? 0) + d.prevPerDay
    if (d.currPerDay != null) t.currPerDay = (t.currPerDay ?? 0) + d.currPerDay
  }
  return t
}

export default function MachineRow({ machine, todayMap, diffMap, onBoothClick, expanded, onToggleExpand, rankMap }) {
  const controlled = typeof onToggleExpand === 'function'
  const [localExpanded, setLocalExpanded] = useState(false)
  const isExpanded = controlled ? !!expanded : localExpanded
  const booths = machine.booths ?? []
  const isSingleBooth = booths.length === 1

  const totals = machineTotals(booths, diffMap)

  // 列ごとのランク取得 (rankMap 渡されない場合はランクなしで fallback 色)
  const mc = machine.machine_code
  const r = {
    prevIn:     rankMap?.prevIn?.[mc]     ?? null,
    currIn:     rankMap?.currIn?.[mc]     ?? null,
    prevPerDay: rankMap?.prevPerDay?.[mc] ?? null,
    currPerDay: rankMap?.currPerDay?.[mc] ?? null,
  }

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
          <div className={`font-mono text-sm font-bold ${rankColor(r.prevIn, false)}`}>{fmtSigned(totals.prevIn)}</div>
          <div className={`font-mono text-sm font-bold ${rankColor(r.currIn, true)}`}>{fmtSigned(totals.currIn)}</div>
          <div className={`font-mono text-sm font-bold ${rankColor(r.prevPerDay, false)}`}>{fmtPerDay(totals.prevPerDay)}</div>
          <div className={`font-mono text-sm font-bold ${rankColor(r.currPerDay, true)}`}>{fmtPerDay(totals.currPerDay)}</div>
        </div>
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
