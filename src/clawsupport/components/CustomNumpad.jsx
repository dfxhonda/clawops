const KEYS = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']]

export default function CustomNumpad({ onKey }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: '8px 4px' }}>
      {KEYS.flat().map((k, i) => (
        <button
          key={i}
          onClick={() => k && onKey(k)}
          style={{
            height: 44,
            borderRadius: 8,
            border: 'none',
            background: k ? '#2a2a44' : 'transparent',
            color: '#e0e0f0',
            fontSize: 18,
            fontWeight: 700,
            cursor: k ? 'pointer' : 'default',
          }}
        >
          {k}
        </button>
      ))}
    </div>
  )
}
