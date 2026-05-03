const THEME_COLORS = {
  clawsupport: '#ec4899',
  tanasupport:  '#10b981',
  manesupport:  '#3b82f6',
}

// variant: 'default'(通常画面) | 'compact'(ハブ・リスト画面)
// rightSlot: ヘッダー右端に表示する要素 (例: 今日の日付)
export function PageHeader({ module, title, subtitle, onBack, backLabel, children, rightSlot, variant = 'default' }) {
  const color = THEME_COLORS[module] ?? '#888899'
  const isCompact = variant === 'compact'
  return (
    <div
      className={isCompact
        ? 'shrink-0 flex items-center gap-3 px-5 pt-6 pb-3'
        : 'shrink-0 flex items-center gap-3 px-5 pt-10 pb-6'}
      style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: color }}
    >
      {onBack && (
        <button onClick={onBack} className="text-muted text-xl leading-none shrink-0">
          {backLabel ?? '‹'}
        </button>
      )}
      <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-text font-bold leading-snug truncate ${isCompact ? 'text-xl' : 'text-xl'}`}>{title}</p>
          {subtitle && !isCompact && <p className="text-muted text-xs mt-0.5">{subtitle}</p>}
        </div>
        {rightSlot && <div className="text-muted text-sm shrink-0">{rightSlot}</div>}
      </div>
      {children}
    </div>
  )
}
