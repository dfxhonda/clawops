import { useState } from 'react'
import MachineRowExpandedBoothList from './MachineRowExpandedBoothList'

// J-PATROL-IN-DAILY-fix-03 ad-hoc (ヒロ Discord IMG_4231): + は要らない、空欄 −、負号 - のみ
function fmtSigned(n) {
  if (n == null) return '−'
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
  // J-PATROL-IN-DAILY-fix-03 ad-hoc (ヒロ Discord IMG_4231):
  //   - ○/✓ 状態アイコン削除
  //   - chevron 矢印削除
  //   - X/N完了 / 入力済み サブテキスト削除
  //   - 4 列 (前IN/今IN/前/日/今/日) は値のみ、ラベルは PatrolStorePage 最上行のみ
  const controlled = typeof onToggleExpand === 'function'
  const [localExpanded, setLocalExpanded] = useState(false)
  const isExpanded = controlled ? !!expanded : localExpanded
  const booths = machine.booths ?? []
  const isSingleBooth = booths.length === 1

  const totals = machineTotals(booths, diffMap)

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
        <div className="flex-1 min-w-0">
          <p className="text-text text-base font-bold truncate">{machine.machine_name}</p>
        </div>
        {/* 値のみ。ラベルは最上行のみ、列幅は w-44 で固定 (全 row 同 x) */}
        <div
          data-testid={`machine-totals-${machine.machine_code}`}
          className="shrink-0 grid grid-cols-4 text-right leading-tight w-44"
        >
          <div className="w-11 font-mono text-sm font-bold text-text">{fmtSigned(totals.prevIn)}</div>
          <div className="w-11 font-mono text-sm font-bold text-green-300">{fmtSigned(totals.currIn)}</div>
          <div className="w-11 font-mono text-sm font-bold text-text">{fmtPerDay(totals.prevPerDay)}</div>
          <div className="w-11 font-mono text-sm font-bold text-green-300">{fmtPerDay(totals.currPerDay)}</div>
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
