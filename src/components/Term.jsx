import { useRef, useState, useCallback } from 'react'
import { useGlossaryStore } from '../stores/glossaryStore'
import PeekBubble from './PeekBubble'

const PEEK_DELAY = 400   // ms: 長押し認識
const HL_DELAY   = 250   // ms: ハイライト開始

/**
 * Term — 用語ラベルラッパー
 *
 * 使い方:
 *   <Term id="in">IN</Term>
 *
 * - 400ms 長押しで PeekBubble 表示
 * - 250ms 地点でハイライト
 * - 用語が見つからなければ <span>{children}</span> にフォールバック
 * - タッチ・マウス両対応
 */
export default function Term({ id, children, style }) {
  const term = useGlossaryStore(s => s.terms[id])
  const timerRef    = useRef(null)
  const hlTimerRef  = useRef(null)
  const [highlighted, setHighlighted] = useState(false)
  const [bubble, setBubble]           = useState(null) // { term, position }

  const clear = useCallback(() => {
    clearTimeout(timerRef.current)
    clearTimeout(hlTimerRef.current)
    timerRef.current   = null
    hlTimerRef.current = null
    setHighlighted(false)
  }, [])

  const hideBubble = useCallback(() => {
    clear()
    setBubble(null)
  }, [clear])

  const startPress = useCallback((clientX, clientY) => {
    if (!term) return
    hlTimerRef.current = setTimeout(() => setHighlighted(true), HL_DELAY)
    timerRef.current   = setTimeout(() => {
      setBubble({ term, position: { x: clientX, y: clientY - 80 } })
    }, PEEK_DELAY)
  }, [term])

  // ── タッチ ──────────────────────────────────────────────
  const handleTouchStart = useCallback((e) => {
    const t = e.touches[0]
    startPress(t.clientX, t.clientY)
  }, [startPress])

  const handleTouchEnd = useCallback(() => {
    hideBubble()
  }, [hideBubble])

  const handleTouchMove = useCallback(() => {
    hideBubble()
  }, [hideBubble])

  // ── マウス ──────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    startPress(e.clientX, e.clientY)
  }, [startPress])

  const handleMouseUp = useCallback(() => {
    hideBubble()
  }, [hideBubble])

  const handleMouseLeave = useCallback(() => {
    hideBubble()
  }, [hideBubble])

  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
  }, [])

  const spanStyle = {
    ...style,
    ...(highlighted && term ? {
      color: '#06b6d4',
      textShadow: '0 0 6px rgba(6,182,212,0.6)',
      transition: 'color 0.1s, text-shadow 0.1s',
    } : {}),
    position: 'relative',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: term ? 'default' : undefined,
  }

  // PeekBubble はポータルが理想だが、PatrolPage はインラインクラスタなので
  // document.body へ append する代わりに fixed 座標で絶対配置
  return (
    <>
      <span
        style={spanStyle}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      >
        {children}
      </span>
      {bubble && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none' }}>
          <PeekBubble term={bubble.term} position={bubble.position} />
        </div>
      )}
    </>
  )
}
