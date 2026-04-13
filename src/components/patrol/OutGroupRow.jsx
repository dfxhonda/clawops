// OUT-A/B/C行 (パターンB/D2用)
// 1行に: ラベル + OUT + 残 + 補 + 景品名 + @単価 + OUT差
const COLORS = { 0: '#2ecc71', 1: '#5dade2', 2: '#ff6b6b' }
const INP = { fontSize: 16, background: '#222238', border: '1px solid #2a2a44', borderRadius: 4, padding: '0.35em 0.3em', fontFamily: "'Courier New', Courier, monospace", fontWeight: 'bold', outline: 'none', WebkitAppearance: 'none', minWidth: 0 }

export default function OutGroupRow({ idx, label, out, touched, prevOut, outDiff, readonly = false, onMeter, onZan, onHo, onPrize, onCost }) {
  const color = COLORS[idx] || '#8888a8'
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 5, padding: '5px 6px', background: '#1a1a2e', borderRadius: 4, borderLeft: `3px solid ${color}`, flexWrap: 'nowrap' }}>
      <span style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, width: 12, color }}>{label}</span>

      <input type="text" inputMode="numeric" style={{ ...INP, width: 72, flexShrink: 0, textAlign: 'right', color: touched.meter ? '#e8e8f0' : '#d0d0e0' }}
        value={out.meter} placeholder={prevOut != null ? String(prevOut) : '—'}
        onFocus={e => e.target.select()}
        onChange={e => onMeter?.(e.target.value)}
      />

      <span style={{ fontSize: 9, color: '#8888a8', flexShrink: 0 }}>残</span>
      <input type="text" inputMode="numeric" maxLength={3} style={{ ...INP, width: 38, flexShrink: 0, textAlign: 'right', color: '#d0d0e0' }}
        value={out.zan}
        onFocus={e => e.target.select()}
        onChange={e => onZan?.(e.target.value)}
      />

      <span style={{ fontSize: 9, color: '#8888a8', flexShrink: 0 }}>補</span>
      <input type="text" inputMode="numeric" maxLength={3} style={{ ...INP, width: 38, flexShrink: 0, textAlign: 'center', color: '#d0d0e0' }}
        value={out.ho}
        onFocus={e => e.target.select()}
        onChange={e => onHo?.(e.target.value)}
      />

      <input type="text" style={{ ...INP, flex: 2, color: readonly ? '#8888a8' : '#d0d0e0', background: readonly ? 'rgba(18,18,30,.8)' : '#222238', borderColor: readonly ? 'transparent' : '#2a2a44', pointerEvents: readonly ? 'none' : 'auto' }}
        value={out.prize || ''} placeholder="景品名"
        onFocus={e => e.target.select()}
        onChange={e => !readonly && onPrize?.(e.target.value)}
      />

      <span style={{ fontSize: 9, color: '#8888a8', flexShrink: 0 }}>@</span>
      <input type="text" inputMode="numeric" style={{ ...INP, width: 42, flexShrink: 0, textAlign: 'right', color: readonly ? '#8888a8' : '#d0d0e0', background: readonly ? 'rgba(18,18,30,.8)' : '#222238', borderColor: readonly ? 'transparent' : '#2a2a44', pointerEvents: readonly ? 'none' : 'auto' }}
        value={out.cost || ''}
        onFocus={e => e.target.select()}
        onChange={e => !readonly && onCost?.(e.target.value)}
      />

      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'Courier New', monospace", whiteSpace: 'nowrap', flexShrink: 0, minWidth: 28, textAlign: 'right', color }}>
        {outDiff != null ? (outDiff >= 0 ? '+' : '') + outDiff : '—'}
      </span>
    </div>
  )
}
