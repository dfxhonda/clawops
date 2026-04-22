// 機械名ヘッダー（日付入力なし — 日付はモードバッジで表示）
export default function PatrolHeader({ machineName, boothLabel, badge, playPrice, onBack }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {onBack && (
          <button onClick={onBack} style={{ fontSize: 22, color: '#8888a8', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>←</button>
        )}
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
      </div>
    </div>
  )
}
