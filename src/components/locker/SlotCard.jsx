import { useRef } from 'react'
import { fmtYen } from '../../utils/format'

const S = {
  filled: {
    background: 'linear-gradient(135deg, #222238 0%, rgba(26,26,46,.8) 100%)',
    border: '1px solid rgba(240,192,64,.25)',
    borderRadius: 6, padding: '8px 10px', position: 'relative', overflow: 'hidden',
    cursor: 'pointer', width: 'calc(50% - 3px)', transition: 'transform .15s',
  },
  empty: {
    background: '#1a1a2e', border: '1px dashed rgba(42,42,68,.6)',
    borderRadius: 6, padding: '8px 10px', cursor: 'pointer',
    width: 'calc(50% - 3px)',
  },
}

// mode: 'check' | 'edit'
export default function SlotCard({ slot, mode, onWon, onAction }) {
  const touchStartX = useRef(null)
  const movedRef = useRef(false)
  const cardRef = useRef(null)

  const filled = slot.status === 'filled' && slot.prize_name

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    movedRef.current = false
  }
  function handleTouchMove(e) {
    if (touchStartX.current == null) return
    const dx = e.touches[0].clientX - touchStartX.current
    if (dx < -15 && mode === 'check' && filled) {
      if (cardRef.current) cardRef.current.style.transform = `translateX(${dx}px)`
      movedRef.current = true
    }
  }
  function handleTouchEnd(e) {
    if (touchStartX.current == null) return
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
    touchStartX.current = null
    if (mode === 'check' && filled && dx < -60) {
      if (cardRef.current) {
        cardRef.current.style.transition = 'all .2s'
        cardRef.current.style.transform = 'translateX(-100%)'
        cardRef.current.style.opacity = '0'
        setTimeout(() => onWon?.(slot.slot_id), 220)
      }
      return
    }
    if (cardRef.current) cardRef.current.style.transform = ''
    if (!movedRef.current) {
      if (mode === 'check' && filled) onWon?.(slot.slot_id)
      else if (mode === 'edit') onAction?.(slot)
    }
  }

  if (filled) {
    return (
      <div ref={cardRef} style={S.filled}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (mode === 'edit') onAction?.(slot) }}
      >
        <div style={{ fontSize: 9, color: '#8888a8', fontWeight: 700, marginBottom: 2 }}>#{slot.slot_number}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e8e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {slot.prize_name}
        </div>
        <div style={{ fontSize: 11, color: '#f0c040', fontFamily: "'Courier New', monospace", fontWeight: 'bold', marginTop: 2 }}>
          {fmtYen(slot.prize_value)}
        </div>
        {mode === 'check' && (
          <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#8888a8', opacity: .25 }}>←</span>
        )}
      </div>
    )
  }

  return (
    <div style={S.empty} onClick={() => { if (mode === 'edit') onAction?.(slot) }}>
      <div style={{ fontSize: 9, color: '#8888a8', fontWeight: 700, marginBottom: 2 }}>#{slot.slot_number}</div>
      <div style={{ fontSize: 20, color: '#8888a8', textAlign: 'center', padding: '2px 0' }}>＋</div>
      <div style={{ fontSize: 9, color: '#8888a8', textAlign: 'center' }}>{mode === 'edit' ? 'タップで補充' : '空き'}</div>
    </div>
  )
}
