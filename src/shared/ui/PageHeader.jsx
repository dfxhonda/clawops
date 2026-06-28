import { useNavigate } from 'react-router-dom'
import { MODULE_COLORS } from './moduleColors'

// variant: 'default'(通常画面) | 'compact'(ハブ・リスト画面)
// rightSlot: ヘッダー右端に表示する要素 (例: 今日の日付)
export function PageHeader({ module, title, subtitle, onBack, children, rightSlot, variant = 'default', hideHome = false }) {
  const navigate = useNavigate()
  const color = MODULE_COLORS[module] ?? '#888899'
  const isCompact = variant === 'compact'
  return (
    <div
      className={isCompact
        ? 'shrink-0 flex items-center gap-2 px-5 pt-6 pb-3'
        : 'shrink-0 flex items-center gap-2 px-5 pt-10 pb-6'}
      style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: color }}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          data-testid="header-back"
          className="shrink-0 flex items-center justify-center w-12 h-12 text-muted text-2xl leading-none active:opacity-70"
        >
          ←
        </button>
      )}
      {!hideHome && (
        <button
          type="button"
          onClick={() => navigate('/launcher')}
          data-testid="header-home"
          className="shrink-0 flex items-center justify-center w-12 h-12 text-muted text-2xl leading-none active:opacity-70"
        >
          ⌂
        </button>
      )}
      <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-text font-bold leading-snug truncate text-2xl">{title}</p>
          {subtitle && !isCompact && <p className="text-muted text-base mt-0.5">{subtitle}</p>}
        </div>
        {rightSlot && <div className="text-muted text-base shrink-0">{rightSlot}</div>}
      </div>
      {children}
    </div>
  )
}
