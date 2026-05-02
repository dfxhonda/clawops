const THEME_COLORS = {
  clawsupport: '#ec4899',
  tanasupport:  '#10b981',
  manesupport:  '#3b82f6',
}

export function PageHeader({ module, title, onBack, backLabel, children }) {
  const color = THEME_COLORS[module] ?? '#888899'
  return (
    <div
      className="shrink-0 flex items-center gap-3 px-5 pt-10 pb-6"
      style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: color }}
    >
      {onBack && (
        <button onClick={onBack} className="text-muted text-xl leading-none shrink-0">
          {backLabel ?? '‹'}
        </button>
      )}
      <p className="text-text text-xl font-bold flex-1 leading-snug">{title}</p>
      {children}
    </div>
  )
}
