// 前回値1行表示
// For pattern A/D: prev = { date, in, out, zan, ho, prize }
// For pattern B/D2: prev = { date, in, outs: [{out, zan, label, color}] }

export default function PrevRow({ prev, outCount, outLabels }) {
  if (!prev) return null
  const dateStr = prev.readTime ? String(prev.readTime).slice(5, 10).replace('-', '/') : '—'
  const B = ({ v }) => <b style={{ color: '#d8d8e8', fontFamily: "'Courier New', monospace", fontWeight: 'bold', marginLeft: 1 }}>{v ?? '—'}</b>

  if (outCount === 1) {
    return (
      <div style={{ display: 'flex', gap: 8, fontSize: 10, padding: '4px 8px', background: '#1a1a2e', borderRadius: 4, marginBottom: 8, color: '#8888a8', flexWrap: 'wrap', lineHeight: 1.6 }}>
        <span><B v={dateStr} /></span>
        {prev.inMeter != null && <span>in<B v={prev.inMeter} /></span>}
        {prev.outMeter != null && <span>out<B v={prev.outMeter} /></span>}
        {prev.stock1 != null && <span>残<B v={prev.stock1} /></span>}
        {prev.restock1 != null && <span>補<B v={prev.restock1} /></span>}
      </div>
    )
  }

  // multi-OUT (B: 3 OUTs, D2: 2 OUTs)
  const outVals = [
    { meter: prev.outMeter, zan: prev.stock1, label: outLabels?.[0] || 'A', color: '#2ecc71' },
    { meter: prev.outMeter2, zan: prev.stock2, label: outLabels?.[1] || 'B', color: '#5dade2' },
    { meter: prev.outMeter3, zan: prev.stock3, label: outLabels?.[2] || 'C', color: '#ff6b6b' },
  ].slice(0, outCount)

  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 10, padding: '4px 8px', background: '#1a1a2e', borderRadius: 4, marginBottom: 8, color: '#8888a8', flexWrap: 'wrap', lineHeight: 1.6 }}>
      <span><B v={dateStr} /></span>
      {prev.inMeter != null && <span>in<B v={prev.inMeter} /></span>}
      {outVals.map(({ meter, zan, label, color }) => meter != null && (
        <span key={label} style={{ color }}>
          {label}<B v={meter} /> 残<B v={zan ?? '—'} />
        </span>
      ))}
    </div>
  )
}
