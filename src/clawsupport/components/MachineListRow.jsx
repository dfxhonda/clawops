function DiffChip({ label, value, isMoney = false }) {
  let text = '—'
  let cls = 'bg-slate-700/40 text-muted'

  if (value != null) {
    const rounded = isMoney ? Math.round(value) : value
    const prefix = isMoney ? '¥' : ''
    if (value > 0) {
      text = `+${prefix}${Math.abs(rounded).toLocaleString()}`
      cls = 'bg-green-900/50 text-green-300'
    } else if (value < 0) {
      text = `-${prefix}${Math.abs(rounded).toLocaleString()}`
      cls = 'bg-red-900/50 text-red-300'
    } else {
      text = `${prefix}0`
      cls = 'bg-slate-700/40 text-muted'
    }
  }

  return (
    <span
      data-testid={`diff-chip-${label}`}
      className={`inline-flex items-baseline gap-1 px-2 py-1 rounded text-base font-bold leading-tight ${cls}`}
    >
      <span className="opacity-60">{label}</span>
      <span className="font-mono">{text}</span>
    </span>
  )
}

export default function MachineListRow({ booth, done, diff, onClick }) {
  return (
    <button
      data-testid={`booth-row-${booth.booth_code}`}
      onClick={onClick}
      className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform"
    >
      <span className={`text-lg shrink-0 ${done ? 'text-emerald-400' : 'text-muted/30'}`}>
        {done ? '✓' : '○'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-text text-base font-bold">
          ブース {booth.booth_number}
        </p>
        {done && (
          <p className="text-emerald-400/70 text-base mt-0.5">入力済み</p>
        )}
      </div>
      {diff && (
        <div className="flex flex-wrap gap-1 ml-auto shrink-0 max-w-[60%] justify-end">
          <DiffChip label="IN"  value={diff.inDiff}  />
          <DiffChip label="OUT" value={diff.outDiff} />
          <DiffChip label="売上" value={diff.revenue} isMoney />
          <DiffChip label="粗利" value={diff.profit}  isMoney />
        </div>
      )}
      <span className="text-muted text-lg shrink-0">›</span>
    </button>
  )
}
