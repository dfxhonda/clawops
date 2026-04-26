const TABS = ['★', 'あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ']

export { TABS }

export default function TabBar({ active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: '8px 8px 0', flexShrink: 0,
      overflowX: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {TABS.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            width: 28, height: 28, flexShrink: 0,
            borderRadius: 6, border: 'none',
            fontSize: 13, fontWeight: active === t ? 700 : 400,
            background: active === t ? '#0e7490' : '#1e293b',
            color: active === t ? '#fff' : '#94a3b8',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
