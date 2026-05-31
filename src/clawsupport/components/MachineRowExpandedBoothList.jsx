// J-PATROL-IN-DAILY-fix-03 ad-hoc (ヒロ Discord IMG_4231):
// ブース行も MachineRow と全く同じ 4 列レイアウト (w-44 grid + w-11 each) で縦に揃える。
// テーブル形式 / 列ヘッダラベル は廃止 (ラベルは PatrolStorePage 最上行のみ)。

function fmtSigned(n) {
  if (n == null) return '−'
  return n.toLocaleString()
}
function fmtPerDay(n) {
  if (n == null) return '−'
  return n.toFixed(1)
}

export default function MachineRowExpandedBoothList({ booths, todayMap, diffMap, onBoothClick }) {
  return (
    <div className="mt-1 space-y-1" data-testid="machine-expanded-booth-list">
      {booths.map(booth => {
        const done = !!todayMap[booth.booth_code]
        const d = diffMap[booth.booth_code] ?? null
        return (
          <button
            key={booth.booth_code}
            data-testid={`booth-row-${booth.booth_code}`}
            onClick={() => onBoothClick(booth)}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-xl bg-surface/40 border border-border/40 text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex-1 min-w-0 pl-4">
              <p className="text-text text-sm">
                └ B{String(booth.booth_number).padStart(2, '0')}
                {done && <span className="ml-1 text-emerald-400/70">✓</span>}
              </p>
            </div>
            {/* MachineRow と同一の 4 列 (w-44 + w-11 each) — 全 row で列 x 位置一致 */}
            <div className="shrink-0 grid grid-cols-4 text-right leading-tight w-44">
              <div className="w-11 font-mono text-sm font-bold text-text">{fmtSigned(d?.prevIn)}</div>
              <div className="w-11 font-mono text-sm font-bold text-green-300">{fmtSigned(d?.currIn)}</div>
              <div className="w-11 font-mono text-sm font-bold text-text">{fmtPerDay(d?.prevPerDay)}</div>
              <div className="w-11 font-mono text-sm font-bold text-green-300">{fmtPerDay(d?.currPerDay)}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
