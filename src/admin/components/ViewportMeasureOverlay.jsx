// DIAG-NUMPAD-VIEWPORT-LIVE-MEASURE-01: NO-FIX 実機計測オーバーレイ
// DEV環境 または ?measure=1 クエリ付き時のみ表示。本番非表示。
// AdminBoothEditPage に1行マウント、本体レイアウトclass未変更。
import { useEffect, useRef, useState } from 'react'

const showGate =
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
  (typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('measure') === '1')

function collectValues(divVh, divSvh, divDvh) {
  return {
    innerH: window.innerHeight,
    vvH: window.visualViewport?.height ?? null,
    clientH: document.documentElement.clientHeight,
    vhPx: divVh ? divVh.getBoundingClientRect().height : null,
    svhPx: divSvh ? divSvh.getBoundingClientRect().height : null,
    dvhPx: divDvh ? divDvh.getBoundingClientRect().height : null,
    pageRootH: document.querySelector('[data-testid="page-root"]')?.getBoundingClientRect().height ?? null,
    numpadBottom: document.querySelector('[data-testid="numpad-anchor"]')?.getBoundingClientRect().bottom ?? null,
  }
}

function valuesChanged(a, b) {
  if (!a) return true
  return a.innerH !== b.innerH
    || a.vvH !== b.vvH
    || a.vhPx !== b.vhPx
    || a.svhPx !== b.svhPx
    || a.dvhPx !== b.dvhPx
    || a.pageRootH !== b.pageRootH
    || a.numpadBottom !== b.numpadBottom
}

export default function ViewportMeasureOverlay() {
  const [vals, setVals] = useState(null)
  const divVhRef = useRef(null)
  const divSvhRef = useRef(null)
  const divDvhRef = useRef(null)
  const rafRef = useRef(null)
  const prevRef = useRef(null)

  useEffect(() => {
    if (!showGate) return

    // Initial sync measurement after DOM commit
    const initial = collectValues(divVhRef.current, divSvhRef.current, divDvhRef.current)
    prevRef.current = initial
    setVals(initial)

    function loop() {
      const next = collectValues(divVhRef.current, divSvhRef.current, divDvhRef.current)
      if (valuesChanged(prevRef.current, next)) {
        prevRef.current = next
        setVals({ ...next })
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  if (!showGate) return null

  const fmt = (v) => v !== null ? String(Math.round(v * 10) / 10) : '?'
  const overflow = vals?.numpadBottom !== null && vals?.numpadBottom !== undefined
    ? vals.numpadBottom - (vals.innerH ?? 0)
    : null
  const isOver = overflow !== null && overflow > 0

  return (
    <>
      {/* Hidden 1px-wide divs for CSS unit measurement — position:fixed to escape flex layout */}
      <div ref={divVhRef} style={{ position: 'fixed', width: 1, height: '100vh', top: 0, left: -2, visibility: 'hidden', pointerEvents: 'none' }} />
      <div ref={divSvhRef} style={{ position: 'fixed', width: 1, height: '100svh', top: 0, left: -2, visibility: 'hidden', pointerEvents: 'none' }} />
      <div ref={divDvhRef} style={{ position: 'fixed', width: 1, height: '100dvh', top: 0, left: -2, visibility: 'hidden', pointerEvents: 'none' }} />

      {/* Live display overlay — top-left, pointer-events:none */}
      <div
        data-testid="viewport-measure-overlay"
        style={{
          position: 'fixed',
          top: 6,
          left: 6,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.82)',
          color: '#fff',
          fontSize: 10,
          fontFamily: 'monospace',
          lineHeight: 1.6,
          padding: '4px 8px',
          borderRadius: 5,
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {vals ? (
          <>
            <div>innerH:&nbsp; {fmt(vals.innerH)}</div>
            <div>vvH:&nbsp;&nbsp;&nbsp; {fmt(vals.vvH)}</div>
            <div>clientH:  {fmt(vals.clientH)}</div>
            <div>100vh:&nbsp; {fmt(vals.vhPx)}</div>
            <div>100svh:   {fmt(vals.svhPx)}</div>
            <div>100dvh:   {fmt(vals.dvhPx)}</div>
            <div>root.h:   {fmt(vals.pageRootH)}</div>
            <div>npm.btm:  {fmt(vals.numpadBottom)}</div>
            <div style={{ color: isOver ? '#ff4444' : '#44ff44', fontWeight: 'bold' }}>
              {isOver ? `⚠ +${fmt(overflow)}px` : `✓ ${fmt(overflow)}px`}
            </div>
          </>
        ) : (
          <div>measuring…</div>
        )}
      </div>
    </>
  )
}
