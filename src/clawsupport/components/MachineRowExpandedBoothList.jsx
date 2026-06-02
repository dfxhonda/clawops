// SPEC-PATROL-VIEW-MODE-SWITCH-02: 4 列固定 (4 前 / 3 前 / 前回 / 今回)、mode で値配列が切り替わる。
// ブース行はランク色付け対象外 (詳細レベル、機械行のみランク)。今回列のみ text-green-300。
import { VIEW_MODES, COLUMN_COUNT, formatCell, sourceArrayFor } from './patrolViewModes'

const NEWEST = 3

export default function MachineRowExpandedBoothList({ booths, todayMap, diffMap, onBoothClick, mode = 'IN' }) {
  const modeDef = VIEW_MODES[mode] ?? VIEW_MODES.IN
  return (
    <div className="mt-1 space-y-1" data-testid="machine-expanded-booth-list">
      {booths.map(booth => {
        const done = !!todayMap[booth.booth_code]
        const d = diffMap[booth.booth_code] ?? null
        const arr = sourceArrayFor(d, mode)
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
              {Array.from({ length: COLUMN_COUNT }, (_, i) => (
                <div
                  key={i}
                  data-testid={`booth-cell-${booth.booth_code}-${i}`}
                  className={`font-mono text-sm font-bold ${i === NEWEST ? 'text-green-300' : 'text-text'}`}
                >
                  {formatCell(arr[i], modeDef.type)}
                </div>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
