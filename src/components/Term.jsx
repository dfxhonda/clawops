import { useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useGlossaryStore } from '../stores/glossaryStore'
import PeekBubble from './PeekBubble'

const PEEK_DELAY     = 400  // ms: 長押し認識
const HL_DELAY       = 250  // ms: ハイライト開始
const MOVE_THRESHOLD = 10   // px: これ以上動いたら長押しキャンセル

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
  const startPosRef = useRef({ x: 0, y: 0 })
  const [highlighted, setHighlighted] = useState(false)
  const [bubble, setBubble]           = useState(null)

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
    startPosRef.current = { x: clientX, y: clientY }
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

  const handleTouchMove = useCallback((e) => {
    const t = e.touches[0]
    const dx = Math.abs(t.clientX - startPosRef.current.x)
    const dy = Math.abs(t.clientY - startPosRef.current.y)
    // 微小ブレはキャンセルしない (iOS Safari の touchmove noise 対策)
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) hideBubble()
  }, [hideBubble])

  const handleTouchCancel = useCallback(() => {
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

  return (
    <>
      <span
        style={spanStyle}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchCancel={handleTouchCancel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      >
        {children}
      </span>
      {bubble && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none' }}>
          <PeekBubble term={bubble.term} position={bubble.position} />
        </div>,
        document.body
      )}
    </>
  )
}
