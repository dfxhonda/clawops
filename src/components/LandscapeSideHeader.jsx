// SPEC-UI-LANDSCAPE-SIDEHEADER-01
// Detachable shared header wrapper. On PHONES rotated to landscape (short height)
// the normal top PageHeader is hidden and a vertical strip is pinned to the LEFT
// edge (writing-mode: vertical-rl), reclaiming the scarce vertical space for
// charts/tables. Portrait and desktop render the exact current PageHeader (zero diff).
//
// USAGE (opt-in per page):
//   - Make the page root a flex container that flips direction on the gate:
//       <div className="h-svh flex flex-col landscape-short:flex-row ...">
//   - Replace <PageHeader {...} /> with <LandscapeSideHeader {...} /> (same props).
//   - Keep the scrollable content as the next flex child (it becomes the right pane
//     in landscape and gets the full height).
//   Props are a pass-through of PageHeader's: { module, title, subtitle, onBack,
//   hideHome, rightSlot, variant, children }.
//
// Gate: @custom-variant landscape-short = (orientation: landscape) and (max-height: 500px)
//   (defined in index.css; excludes PC/tablet which are tall).
//
// Platform notes (iOS Safari / WebKit, verified 2026-07):
//   - writing-mode: vertical-rl tap targets are correct on iOS 18.5+; buttons keep
//     horizontal glyphs (writing-mode reset) and >=44px tap area.
//   - svh is safe in landscape (page root keeps h-svh; never clipped by the toolbar).
//   - env(safe-area-inset-left) requires viewport-fit=cover (already set) and is
//     honored so the strip clears a left-side notch in landscape.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../shared/ui/PageHeader'
import { MODULE_COLORS } from '../shared/ui/moduleColors'

export default function LandscapeSideHeader({ module, title, subtitle, onBack, hideHome, rightSlot, variant, children }) {
  const navigate = useNavigate()
  const color = MODULE_COLORS[module] ?? 'var(--color-text-dim)'

  // iOS rotation can retain stale layout; nudge a reflow on orientation change.
  useEffect(() => {
    const reflow = () => { void document.body.offsetHeight }
    window.addEventListener('orientationchange', reflow)
    return () => window.removeEventListener('orientationchange', reflow)
  }, [])

  return (
    <>
      {/* portrait / desktop: the exact current header (zero visual diff) */}
      <div className="shrink-0 landscape-short:hidden">
        <PageHeader
          module={module}
          title={title}
          subtitle={subtitle}
          onBack={onBack}
          hideHome={hideHome}
          rightSlot={rightSlot}
          variant={variant}
        >
          {children}
        </PageHeader>
      </div>

      {/* phone landscape (short): vertical strip pinned to the left edge */}
      <div
        data-testid="landscape-side-header"
        className="hidden landscape-short:flex shrink-0 flex-col items-center gap-2 py-3 pr-1 bg-bg border-l-4"
        style={{ borderLeftColor: color, paddingLeft: 'calc(0.25rem + env(safe-area-inset-left))' }}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            data-testid="side-header-back"
            className="shrink-0 w-11 h-11 flex items-center justify-center text-muted text-2xl leading-none active:opacity-70"
          >
            ←
          </button>
        )}
        {!hideHome && (
          <button
            type="button"
            onClick={() => navigate('/launcher')}
            data-testid="side-header-home"
            className="shrink-0 w-11 h-11 flex items-center justify-center text-muted text-2xl leading-none active:opacity-70"
          >
            ⌂
          </button>
        )}
        <p
          className="font-bold text-text text-lg mt-1 whitespace-nowrap"
          style={{ writingMode: 'vertical-rl' }}
        >
          {title}
        </p>
      </div>
    </>
  )
}
