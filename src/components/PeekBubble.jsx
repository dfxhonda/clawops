import { useEffect, useState } from 'react'

const BUBBLE_STYLE = {
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
  animation: 'peekFadeIn 0.15s ease-out',
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

/**
 * PeekBubble — 用語の長押し吹き出し
 * @param {object} term   glossary_terms row
 * @param {{ x: number, y: number }} position  ページ座標
 */
export default function PeekBubble({ term, position }) {
  const [style, setStyle] = useState({ ...BUBBLE_STYLE, top: 0, left: 0, opacity: 0 })

  useEffect(() => {
    if (!position) return
    // ビューポートからはみ出さないよう調整
    const vw = window.innerWidth
    const left = Math.min(position.x, vw - 272)
    const top = position.y - 8

    setStyle({
      ...BUBBLE_STYLE,
      top,
      left: Math.max(8, left),
    })
  }, [position])

  if (!term || !position) return null

  const head = [term.label_short, term.label_full].filter(Boolean).join(' — ')

  return (
    <>
      <style>{`
        @keyframes peekFadeIn {
          from { opacity: 0; transform: translateY(4px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>
      <div style={style}>
        <div style={TERM_HEAD_STYLE}>{head}</div>
        {term.bubble_text && (
          <div style={BUBBLE_TEXT_STYLE}>{term.bubble_text}</div>
        )}
      </div>
    </>
  )
}
