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
 * @param {{ x: number, y: number }} position  ビューポート座標
 */
export default function PeekBubble({ term, position }) {
  if (!term || !position) return null

  // ビューポートからはみ出さないよう調整 (useEffect不要・直接計算)
  const vw = window.innerWidth
  const left = Math.max(8, Math.min(position.x, vw - 272))
  const top  = Math.max(8, position.y - 8)

  const style = { ...BUBBLE_STYLE, top, left }
  const head  = [term.label_short, term.label_full].filter(Boolean).join(' — ')

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
