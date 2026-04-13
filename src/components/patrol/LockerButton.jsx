import { fmtYen } from '../../utils/format'

// variant: 'check' (blue) | 'edit' (red)
export default function LockerButton({ variant = 'check', total, emptyCount, onClick }) {
  const isEdit = variant === 'edit'
  const borderColor = isEdit ? '#ff6b6b' : '#5dade2'
  const arrowColor = isEdit ? '#ff6b6b' : '#5dade2'
  const label = isEdit ? 'ロッカー入替/補充' : 'ロッカー確認'
  const infoColor = isEdit ? '#ff6b6b' : '#8888a8'

  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#1a1a2e', border: `1px solid ${borderColor}`, borderRadius: 8, marginBottom: 8, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 20, marginRight: 8 }}>🔐</span>
        <div style={{ fontSize: 11, color: infoColor, lineHeight: 1.4 }}>
          {label} — 総額
          <b style={{ color: '#f0c040', fontFamily: "'Courier New', monospace" }}>{fmtYen(total)}</b>
          {' '}/ 空き
          <b style={{ color: '#f0c040', fontFamily: "'Courier New', monospace" }}>{emptyCount ?? '—'}</b>
        </div>
      </div>
      <span style={{ fontSize: 16, opacity: .5, color: arrowColor }}>▶</span>
    </div>
  )
}
