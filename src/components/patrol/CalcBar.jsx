// IN差/OUT差/理論残/出率 表示バー + リセットボタン
export default function CalcBar({ inDiff, outDiff, theoryZan, rate, onReset, style }) {
  const C = { flex: 1, textAlign: 'center', whiteSpace: 'nowrap' }
  const CL = { fontSize: 9, color: '#8888a8', display: 'block' }
  const CV = { fontWeight: 700, fontFamily: "'Courier New', Courier, monospace", fontSize: 12 }
  const fmt = n => n != null ? (n >= 0 ? '+' : '') + n : '—'

  return (
    <div style={{ display: 'flex', gap: 2, padding: '4px 4px', fontSize: 11, background: '#1a1a2e', borderRadius: 4, marginBottom: 6, alignItems: 'center', ...style }}>
      {inDiff !== undefined && (
        <div style={C}>
          <span style={CL}>IN差</span>
          <span style={{ ...CV, color: '#2ecc71' }}>{fmt(inDiff)}</span>
        </div>
      )}
      {outDiff !== undefined && (
        <div style={C}>
          <span style={CL}>OUT差</span>
          <span style={{ ...CV, color: '#2ecc71' }}>{fmt(outDiff)}</span>
        </div>
      )}
      {theoryZan !== undefined && (
        <div style={C}>
          <span style={CL}>理論残</span>
          <span style={{ ...CV, color: '#a855f7' }}>{theoryZan ?? '—'}</span>
        </div>
      )}
      {rate !== undefined && (
        <div style={C}>
          <span style={CL}>出率</span>
          <span style={{ ...CV, color: '#5dade2' }}>{rate != null ? rate.toFixed(1) + '%' : '—'}</span>
        </div>
      )}
      {onReset && (
        <button onClick={onReset} style={{ padding: '5px 14px', borderRadius: 4, background: '#222238', border: '1px solid #2a2a44', color: '#8888a8', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          ↩
        </button>
      )}
    </div>
  )
}
