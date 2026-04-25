import { useLayoutEffect, useRef, useState } from 'react'

const BUBBLE_BASE = {
  position: 'absolute',
  zIndex: 9999,
  background: '#0f172a',
  border: '2px solid #06b6d4',
  borderRadius: 8,
  padding: '8px 12px',
  minWidth: 160,
  maxWidth: 260,
  pointerEvents: 'none',
  boxShadow: '0 4px 24px rgba(6,182,212,0.25)',
}

const TERM_HEAD_STYLE = {
  fontSize: 13,
  fontWeight: 700,
  color: '#06b6d4',
  marginBottom: 4,
  whiteSpace: 'nowrap',
}

const BUBBLE_TEXT_STYLE = {
  fontSize: 12,
  color: '#cbd5e1',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
}

const TOP_SAFE = 60   // px: 画面上端からの最小マージン
const OFFSET   = 12  // px: 要素エッジからのギャップ

/**
 * PeekBubble — 用語の長押し吹き出し
 * @param {object} term   glossary_terms row
 * @param {{ anchorX, anchorTop, anchorBottom }} anchor  要素の中央X・上端・下端のビューポート座標
 */
export default function PeekBubble({ term, anchor }) {
  const bubbleRef = useRef(null)
  const [pos, setPos]           = useState(null)   // { top, left } — null=未計算
  const [arrowDir, setArrowDir] = useState('down') // 'down' | 'up'

  // LayoutEffect でバブルの実寸を取ってから座標を確定
  useLayoutEffect(() => {
    if (!anchor || !bubbleRef.current) return
    const bh = bubbleRef.current.offsetHeight ?? 100
    const bw = bubbleRef.current.offsetWidth  ?? 240
    const vw = window.innerWidth
    const left   = Math.max(8, Math.min(anchor.anchorX - bw / 2, vw - bw - 8))
    const upTop  = anchor.anchorTop - OFFSET - bh

    if (upTop >= TOP_SAFE) {
      setPos({ top: upTop, left })
      setArrowDir('down')
    } else {
      setPos({ top: anchor.anchorBottom + OFFSET, left })
      setArrowDir('up')
    }
  }, [anchor])

  if (!term || !anchor) return null

  const head = [term.label_short, term.label_full].filter(Boolean).join(' — ')

  // pos が確定するまでは画面外に隠す (visibility:hidden で占有スペースを確保しつつ測定可能に)
  const bubbleStyle = pos
    ? { ...BUBBLE_BASE, ...pos, animation: 'peekFadeIn 0.15s ease-out' }
    : { ...BUBBLE_BASE, top: -9999, left: -9999, visibility: 'hidden', animation: 'none' }

  // 三角矢印: ↓ バブルが上に出る場合は下向き、↑ バブルが下に出る場合は上向き
  const arrowStyle = arrowDir === 'down' ? {
    position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
    width: 0, height: 0,
    borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
    borderTop: '8px solid #06b6d4',
  } : {
    position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
    width: 0, height: 0,
    borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
    borderBottom: '8px solid #06b6d4',
  }

  return (
    <>
      <style>{`
        @keyframes peekFadeIn {
          from { opacity: 0; transform: translateY(4px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>
      <div ref={bubbleRef} style={bubbleStyle}>
        <div style={TERM_HEAD_STYLE}>{head}</div>
        {term.bubble_text && (
          <div style={BUBBLE_TEXT_STYLE}>{term.bubble_text}</div>
        )}
        <div style={arrowStyle} />
      </div>
    </>
  )
}
