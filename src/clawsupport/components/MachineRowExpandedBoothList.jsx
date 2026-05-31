// J-PATROL-IN-DAILY-fix-01: 展開時はテーブル表示 (ブース | 前IN | 今IN | 前/日 | 今/日)
// OUT 列は完全削除。値欠損は '−' プレースホルダ。

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

export default function MachineRowExpandedBoothList({ booths, todayMap, diffMap, onBoothClick }) {
  return (
    <div className="ml-6 mt-1 pb-1" data-testid="machine-expanded-table">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-muted border-b border-border">
            <th className="text-left  py-1 pl-2 font-normal">ブース</th>
            <th className="text-right py-1 px-1 font-normal">前IN</th>
            <th className="text-right py-1 px-1 font-normal">今IN</th>
            <th className="text-right py-1 px-1 font-normal">前/日</th>
            <th className="text-right py-1 pr-2 font-normal">今/日</th>
          </tr>
        </thead>
        <tbody>
          {booths.map(booth => {
            const done = !!todayMap[booth.booth_code]
            const d = diffMap[booth.booth_code] ?? null
            return (
              <tr
                key={booth.booth_code}
                data-testid={`booth-row-${booth.booth_code}`}
                onClick={() => onBoothClick(booth)}
                className="border-b border-border/40 cursor-pointer active:bg-surface/60"
              >
                <td className="py-2 pl-2">
                  <span className="text-text">B{String(booth.booth_number).padStart(2, '0')}</span>
                  {done && <span className="ml-1 text-emerald-400/70">✓</span>}
                </td>
                <td className="py-2 px-1 text-right font-mono text-text">{fmtSigned(d?.prevIn)}</td>
                <td className="py-2 px-1 text-right font-mono text-green-300">{fmtSigned(d?.currIn)}</td>
                <td className="py-2 px-1 text-right font-mono text-text">{fmtPerDay(d?.prevPerDay)}</td>
                <td className="py-2 pr-2 text-right font-mono text-green-300">{fmtPerDay(d?.currPerDay)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
