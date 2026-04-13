// 異常値アラートバー
// alerts: [{ level: 'red'|'yellow', msg: string }]
export default function AlertBar({ alerts }) {
  if (!alerts || alerts.length === 0) return null
  return (
    <div style={{ marginBottom: 6 }}>
      {alerts.map((a, i) => (
        <div key={i} style={{
          padding: '6px 10px',
          background: a.level === 'red' ? 'rgba(255,107,107,.15)' : 'rgba(240,192,64,.1)',
          border: `1px solid ${a.level === 'red' ? '#ff6b6b' : '#f0c040'}`,
          borderRadius: 4,
          fontSize: 12,
          color: a.level === 'red' ? '#ff6b6b' : '#f0c040',
          fontWeight: 700,
          marginBottom: i < alerts.length - 1 ? 4 : 0,
        }}>
          {a.level === 'red' ? '! ' : '^ '}{a.msg}
        </div>
      ))}
    </div>
  )
}
