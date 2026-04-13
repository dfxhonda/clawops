// 景品名 + @単価 + O設定 行 (pattern A/D)
const INP = { fontSize: 16, background: '#222238', border: '1px solid #2a2a44', borderRadius: 4, padding: '0.4em 0.35em', fontFamily: "'Courier New', Courier, monospace", fontWeight: 'bold', outline: 'none', WebkitAppearance: 'none', minWidth: 0 }

export default function PrizeRow({ prize, cost, setO, prizeRO = false, costRO = false, onPrize, onCost, onSetO, showO = false }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 6 }}>
      <span style={{ fontSize: 10, color: '#f0c040', fontWeight: 700, flexShrink: 0 }}>景</span>
      <input type="text" style={{ ...INP, flex: 2, color: prizeRO ? '#8888a8' : '#d0d0e0', background: prizeRO ? 'rgba(18,18,30,.8)' : '#222238', borderColor: prizeRO ? 'transparent' : '#2a2a44', pointerEvents: prizeRO ? 'none' : 'auto' }}
        value={prize || ''} placeholder="景品名"
        onFocus={e => e.target.select()}
        onChange={e => !prizeRO && onPrize?.(e.target.value)}
      />
      <span style={{ fontSize: 10, color: '#f0c040', fontWeight: 700, flexShrink: 0 }}>@</span>
      <input type="text" inputMode="numeric" style={{ ...INP, width: 60, color: costRO ? '#8888a8' : '#d0d0e0', background: costRO ? 'rgba(18,18,30,.8)' : '#222238', borderColor: costRO ? 'transparent' : '#2a2a44', pointerEvents: costRO ? 'none' : 'auto', textAlign: 'right' }}
        value={cost || ''} placeholder="¥"
        onFocus={e => e.target.select()}
        onChange={e => !costRO && onCost?.(e.target.value)}
      />
      {showO && (
        <>
          <span style={{ fontSize: 10, color: '#f0c040', fontWeight: 700, flexShrink: 0 }}>O</span>
          <input type="text" maxLength={6} style={{ ...INP, flex: 1, color: '#d0d0e0' }}
            value={setO || ''} placeholder="設定"
            onFocus={e => e.target.select()}
            onChange={e => onSetO?.(e.target.value)}
          />
        </>
      )}
    </div>
  )
}
