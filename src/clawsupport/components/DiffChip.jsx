export default function DiffChip({ label, value }) {
  let text = '—'
  let cls = 'bg-slate-700/40 text-muted'

  if (value != null) {
    if (value > 0) {
      text = `+${value.toLocaleString()}`
      cls = 'bg-green-900/50 text-green-300'
    } else if (value < 0) {
      text = `${value.toLocaleString()}`
      cls = 'bg-red-900/50 text-red-300'
    } else {
      text = '0'
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
