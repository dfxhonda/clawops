import { fmtYen } from '../../utils/format'

export default function MonthlySummary({ currRevenue, currRate, prevRevenue, prevRate, histRows }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 2, padding: '4px 4px', fontSize: 11, background: '#1a1a2e', borderRadius: 4, marginBottom: 4, marginTop: 8, borderTop: '1px solid #2a2a44', paddingTop: 8 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 9, color: '#8888a8', display: 'block' }}>今月売上</span>
          <span style={{ fontWeight: 700, fontFamily: "'Courier New', monospace", color: '#f0c040' }}>{fmtYen(currRevenue)}</span>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 9, color: '#8888a8', display: 'block' }}>景品代</span>
          <span style={{ fontWeight: 700, fontFamily: "'Courier New', monospace", color: '#e8e8f0' }}>—</span>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 9, color: '#8888a8', display: 'block' }}>出率</span>
          <span style={{ fontWeight: 700, fontFamily: "'Courier New', monospace", color: '#5dade2' }}>{currRate != null ? currRate.toFixed(1) + '%' : '—'}</span>
        </div>
      </div>

      {histRows && histRows.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: "'Courier New', monospace" }}>
            <thead>
              <tr>
                <th style={{ fontSize: 9, color: '#8888a8', fontWeight: 400, textAlign: 'left', padding: '3px 4px', borderBottom: '1px solid #2a2a44' }}>日付</th>
                <th style={{ fontSize: 9, color: '#8888a8', fontWeight: 400, textAlign: 'right', padding: '3px 4px', borderBottom: '1px solid #2a2a44' }}>売上</th>
                <th style={{ fontSize: 9, color: '#8888a8', fontWeight: 400, textAlign: 'right', padding: '3px 4px', borderBottom: '1px solid #2a2a44' }}>日売平均</th>
              </tr>
            </thead>
            <tbody>
              {histRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '3px 4px', color: '#8888a8', borderBottom: '1px solid rgba(42,42,68,.4)' }}>
                    {r.read_time ? String(r.read_time).slice(5, 10).replace('-', '/') : '—'}
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: '#d0d0e0', borderBottom: '1px solid rgba(42,42,68,.4)' }}>
                    {r.in_diff != null ? fmtYen(r.revenue ?? r.in_diff * (r.play_price || 100)) : '—'}
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: '#d0d0e0', borderBottom: '1px solid rgba(42,42,68,.4)' }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
