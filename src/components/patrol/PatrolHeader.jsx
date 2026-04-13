// 日付ドロップダウン + 機械名ヘッダー
export default function PatrolHeader({ dateOpts, readDate, onDateChange, machineName, boothLabel, badge, onBack }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {onBack && (
          <button onClick={onBack} style={{ fontSize: 22, color: '#8888a8', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>←</button>
        )}
        <span style={{ fontSize: 11, color: '#8888a8' }}>📅</span>
        <select
          value={readDate}
          onChange={e => onDateChange(e.target.value)}
          style={{ fontSize: 14, color: '#f0c040', background: '#1a1a2e', border: '1px solid #2a2a44', borderRadius: 4, padding: '6px 10px', fontWeight: 700, WebkitAppearance: 'none', outline: 'none' }}
        >
          {dateOpts.map(d => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e8e8f0' }}>
        {badge && (
          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, marginRight: 4, background: 'rgba(93,173,226,.15)', color: '#5dade2' }}>
            {badge}
          </span>
        )}
        {machineName}
        {boothLabel && <span style={{ color: '#8888a8', marginLeft: 4 }}>/ {boothLabel}</span>}
      </div>
    </div>
  )
}
