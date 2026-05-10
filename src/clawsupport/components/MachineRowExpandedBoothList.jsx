import DiffChip from './DiffChip'

export default function MachineRowExpandedBoothList({ booths, todayMap, diffMap, onBoothClick }) {
  return (
    <div className="ml-6 mt-1 space-y-1 pb-1">
      {booths.map(booth => {
        const done = !!todayMap[booth.booth_code]
        const diff = diffMap[booth.booth_code] ?? null

        return (
          <button
            key={booth.booth_code}
            data-testid={`booth-row-${booth.booth_code}`}
            onClick={() => onBoothClick(booth)}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform"
          >
            <span className="text-muted text-base shrink-0">└</span>
            <div className="flex-1 min-w-0">
              <p className="text-text text-base">ブース {booth.booth_number}</p>
              {done && <p className="text-emerald-400/70 text-base mt-0.5">入力済み</p>}
            </div>
            {diff && (
              <div className="flex gap-1 ml-auto shrink-0">
                <DiffChip label="IN" value={diff.inDiff} />
                <DiffChip label="OUT" value={diff.outDiff} />
              </div>
            )}
            <span className="text-muted text-lg shrink-0">›</span>
          </button>
        )
      })}
    </div>
  )
}
