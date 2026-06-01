// J-PATROL-IN-DAILY-fix-05 ad-hoc (ヒロ Discord IMG_4234): 縦圧縮 (py-2 → py-1) + grid gap-x-1.5 + w-52
// ブース行はランク色付け対象外 (詳細レベル、機械行のみランク)。
// SPEC-PATROL-VIEW-MODE-SWITCH-01: mode prop で表示列が切り替わる。booth 単体は集計不要、
// summary[col.key] をそのまま表示 (出率は per-booth out_diff/in_diff で computeBoothDiffSummary 済)。
import { VIEW_MODES, formatCell } from './patrolViewModes'

export default function MachineRowExpandedBoothList({ booths, todayMap, diffMap, onBoothClick, mode = 'IN' }) {
  const cols = (VIEW_MODES[mode] ?? VIEW_MODES.IN).cols
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
            className="w-full flex items-center gap-2 px-4 py-1 rounded-xl bg-surface/40 border border-border/40 text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex-1 min-w-0 pl-4">
              <p className="text-text text-sm">
                └ B{String(booth.booth_number).padStart(2, '0')}
                {done && <span className="ml-1 text-emerald-400/70">✓</span>}
              </p>
            </div>
            <div className="shrink-0 grid grid-cols-4 gap-x-1.5 text-right leading-tight w-52">
              {cols.map(c => (
                <div
                  key={c.key}
                  data-testid={`booth-cell-${booth.booth_code}-${c.key}`}
                  className={`font-mono text-sm font-bold ${c.today ? 'text-green-300' : 'text-text'}`}
                >
                  {formatCell(d?.[c.key], c.type)}
                </div>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
