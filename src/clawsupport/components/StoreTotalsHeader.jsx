// J-PATROL-IN-DAILY-fix-03 ad-hoc: 巡回 / 管理者編集モード の店舗ハブ最上行で共用するヘッダ。
// 2 行構成: (1) 進捗バッジ + ラベル (前IN/今IN/前/日/今/日 muted)、(2) 任意の左側スロット + 全店舗合計値。
// MachineRow / MachineRowExpandedBoothList と同一の w-44 grid + w-11 each で列 x 位置完全一致。
import { useMemo } from 'react'

function fmtSigned(n) {
  if (n == null) return '−'
  return n.toLocaleString()
}
function fmtPerDay(n) {
  if (n == null) return '−'
  return n.toFixed(1)
}

export function computeStoreTotals(diffMap) {
  const t = { prevIn: null, currIn: null, prevPerDay: null, currPerDay: null }
  for (const d of Object.values(diffMap)) {
    if (!d) continue
    if (d.prevIn != null)     t.prevIn     = (t.prevIn     ?? 0) + d.prevIn
    if (d.currIn != null)     t.currIn     = (t.currIn     ?? 0) + d.currIn
    if (d.prevPerDay != null) t.prevPerDay = (t.prevPerDay ?? 0) + d.prevPerDay
    if (d.currPerDay != null) t.currPerDay = (t.currPerDay ?? 0) + d.currPerDay
  }
  return t
}

export default function StoreTotalsHeader({ diffMap, leftSlot = null, leftSlot2 = null }) {
  const totals = useMemo(() => computeStoreTotals(diffMap || {}), [diffMap])
  return (
    <div data-testid="store-totals-header" className="shrink-0 border-b border-border">
      <div className="px-4 py-1.5 flex items-center gap-2">
        <div className="flex-1 min-w-0">{leftSlot}</div>
        <div className="shrink-0 grid grid-cols-4 text-[10px] text-right leading-tight text-muted w-44">
          <div className="w-11">前IN</div>
          <div className="w-11">今IN</div>
          <div className="w-11">前/日</div>
          <div className="w-11">今/日</div>
        </div>
      </div>
      <div className="px-4 pb-2 flex items-center gap-2">
        <div className="flex-1 min-w-0">{leftSlot2}</div>
        <div className="shrink-0 grid grid-cols-4 text-right leading-tight w-44">
          <div className="w-11 font-mono text-sm font-bold text-text">{fmtSigned(totals.prevIn)}</div>
          <div className="w-11 font-mono text-sm font-bold text-green-300">{fmtSigned(totals.currIn)}</div>
          <div className="w-11 font-mono text-sm font-bold text-text">{fmtPerDay(totals.prevPerDay)}</div>
          <div className="w-11 font-mono text-sm font-bold text-green-300">{fmtPerDay(totals.currPerDay)}</div>
        </div>
      </div>
    </div>
  )
}
