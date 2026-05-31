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

// J-PATROL-IN-DAILY-fix-02 ad-hoc (ヒロ Discord IMG_4230): + は要らない、負号 - のみ残す、空欄 −
function fmtSigned(n) {
  if (n == null) return '−'
  // 負数は toLocaleString が '-' を付ける、正数は + 無し
  return n.toLocaleString()
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
        {/* J-PATROL-IN-DAILY-fix-02 ad-hoc (ヒロ Discord IMG_4230):
            全機械で列の x 位置を揃えるため totals は固定幅 w-44 (= 4 * w-11 = 11rem = 176px)、
            各列 w-11 固定、履歴無し機械も同幅プレースホルダ + chevron スロットも同幅で揃える。
            これで縦に 前IN/今IN/前/日/今/日 が並ぶ。 */}
        <div
          data-testid={`machine-totals-${machine.machine_code}`}
          className="shrink-0 grid grid-cols-4 text-[10px] text-right leading-tight w-44"
        >
          <div className="w-11">
            <div className="text-muted">前IN</div>
            <div className="font-mono text-sm font-bold text-text">{fmtSigned(totals.prevIn)}</div>
          </div>
          <div className="w-11">
            <div className="text-muted">今IN</div>
            <div className="font-mono text-sm font-bold text-green-300">{fmtSigned(totals.currIn)}</div>
          </div>
          <div className="w-11">
            <div className="text-muted">前/日</div>
            <div className="font-mono text-sm font-bold text-text">{fmtPerDay(totals.prevPerDay)}</div>
          </div>
          <div className="w-11">
            <div className="text-muted">今/日</div>
            <div className="font-mono text-sm font-bold text-green-300">{fmtPerDay(totals.currPerDay)}</div>
          </div>
        </div>
        {/* chevron スロット: 単一ブースでも invisible で同幅確保 → 列の x 位置が全機械で揃う */}
        {!isSingleBooth ? (
          <span
            data-testid={`chevron-${machine.machine_code}`}
            className={`text-muted shrink-0 transition-transform duration-200 inline-flex ${isExpanded ? 'rotate-90' : ''}`}
          >
            <Chevron className="" />
          </span>
        ) : (
          <span className="shrink-0 inline-flex w-5 h-5" aria-hidden />
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
