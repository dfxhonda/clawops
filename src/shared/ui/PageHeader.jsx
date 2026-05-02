const THEME_COLORS = {
  clawsupport: '#ec4899',
  tanasupport:  '#10b981',
  manesupport:  '#3b82f6',
}

export function PageHeader({ module, title, subtitle, onBack, backLabel, children }) {
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
      <div className="flex-1 min-w-0">
        <p className="text-text text-xl font-bold leading-snug">{title}</p>
        {subtitle && <p className="text-muted text-xs mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
