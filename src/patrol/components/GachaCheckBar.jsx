// 整合チェックバー: IN差分 vs OUT合計 の一致確認 + 合計売上表示
export default function GachaCheckBar({ inDiff, outs = [] }) {
  const totalOut = outs.reduce((s, o) => s + (o?.diff ?? 0), 0)
  const match = inDiff != null && inDiff === totalOut
  const gap = inDiff != null ? Math.abs(inDiff - totalOut) : null

  const totalRevenue = outs.reduce((s, o) => {
    const d = o?.diff ?? 0
    const c = parseInt(o?.cost) || 0
    return s + (d > 0 && c > 0 ? d * c : 0)
  }, 0)

  const barColor = match ? '#1a3b1a' : '#2a2000'
  const borderColor = match ? '#27ae60' : '#d4ac0d'
  const textColor = match ? '#2ecc71' : '#f0c040'
  const icon = match ? '✓' : '⚠'

  const diffStr = (v) => v != null ? (v >= 0 ? `+${v}` : String(v)) : '?'

  return (
    <div style={{
      background: barColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 6,
      padding: '5px 8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: textColor, fontWeight: 700, flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: textColor, flexShrink: 0 }}>
          {match ? '整合OK' : `誤差${gap}`}
        </span>
        <span style={{ fontSize: 10, color: '#8888a8', fontFamily: 'monospace' }}>
          IN{diffStr(inDiff)}=A+B={totalOut}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: '#8888a8' }}>売上</span>
        <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#5dade2' }}>
          ¥{totalRevenue.toLocaleString()}
        </span>
      </div>
    </div>
  )
}
