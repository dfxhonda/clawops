import { useState } from 'react'
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

// J-PATROL-IN-DAILY-fix-01: 数値フォーマット (符号付き整数 / 1dp/日 / 空欄=−)
function fmtSigned(n) {
  if (n == null) return '−'
  if (n > 0) return `+${n.toLocaleString()}`
  if (n < 0) return n.toLocaleString()
  return '0'
}
function fmtPerDay(n) {
  if (n == null) return '−'
  return n.toFixed(1)
}

// 機械合計 = ブース合計の SUM
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

export default function MachineRow({ machine, todayMap, diffMap, onBoothClick, expanded, onToggleExpand }) {
  // expanded/onToggleExpand が渡されれば外部制御(リスト状態の保持用)、無ければ従来の内部state
  const controlled = typeof onToggleExpand === 'function'
  const [localExpanded, setLocalExpanded] = useState(false)
  const isExpanded = controlled ? !!expanded : localExpanded
  const booths = machine.booths ?? []
  const isSingleBooth = booths.length === 1

  const totals = machineTotals(booths, diffMap)
  const hasAny =
    totals.prevIn != null || totals.currIn != null ||
    totals.prevPerDay != null || totals.currPerDay != null

  const doneCnt = booths.filter(b => !!todayMap[b.booth_code]).length
  const allDone = doneCnt === booths.length && booths.length > 0

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
        {/* J-PATROL-IN-DAILY-fix-01: 機械合計 = booth SUM (4 列、OUT 完全削除) */}
        {hasAny && (
          <div
            data-testid={`machine-totals-${machine.machine_code}`}
            className="ml-auto shrink-0 grid grid-cols-4 gap-x-2 text-[10px] text-right leading-tight"
          >
            <div>
              <div className="text-muted">前IN</div>
              <div className="font-mono text-sm font-bold text-text">{fmtSigned(totals.prevIn)}</div>
            </div>
            <div>
              <div className="text-muted">今IN</div>
              <div className="font-mono text-sm font-bold text-green-300">{fmtSigned(totals.currIn)}</div>
            </div>
            <div>
              <div className="text-muted">前/日</div>
              <div className="font-mono text-sm font-bold text-text">{fmtPerDay(totals.prevPerDay)}</div>
            </div>
            <div>
              <div className="text-muted">今/日</div>
              <div className="font-mono text-sm font-bold text-green-300">{fmtPerDay(totals.currPerDay)}</div>
            </div>
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
