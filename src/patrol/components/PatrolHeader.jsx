import { HelpCircle } from 'lucide-react'

// 日付カレンダー入力 + 機械名ヘッダー
export default function PatrolHeader({ readDate, onDateChange, machineName, boothLabel, badge, playPrice, onBack, dateLocked = false, onHelp }) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {onBack && (
          <button onClick={onBack} style={{ fontSize: 22, color: '#8888a8', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>←</button>
        )}
        <input
          type="date"
          value={readDate}
          max={today}
          disabled={dateLocked}
          onChange={e => !dateLocked && onDateChange(e.target.value)}
          style={{ fontSize: 16, color: dateLocked ? '#a8882a' : '#f0c040', background: dateLocked ? 'rgba(18,18,30,.8)' : '#1a1a2e', border: '1px solid #2a2a44', borderRadius: 4, padding: '5px 8px', fontWeight: 700, outline: 'none', WebkitAppearance: 'none', colorScheme: 'dark', opacity: dateLocked ? 0.8 : 1 }}
        />
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e8e8f0' }}>
        {badge && (
          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, marginRight: 4, background: 'rgba(93,173,226,.15)', color: '#5dade2' }}>
            {badge}
          </span>
        )}
        {machineName}
        {boothLabel && <span style={{ color: '#8888a8', marginLeft: 4 }}>/ {boothLabel}</span>}
        {playPrice && <span style={{ color: '#f0c040', marginLeft: 6, fontSize: 11, fontWeight: 400 }}>@{playPrice}円</span>}
        {onHelp && (
          <button
            onClick={onHelp}
            aria-label="ヘルプ"
            style={{ marginLeft: 6, width: 24, height: 24, borderRadius: '50%', background: '#0891b2', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}
          >
            <HelpCircle style={{ width: 14, height: 14, color: '#fff' }} />
          </button>
        )}
      </div>
    </div>
  )
}
