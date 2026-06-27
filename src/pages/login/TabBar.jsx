const TABS = ['★', 'あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ']

export { TABS }

export default function TabBar({ active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 6, padding: '8px 8px 0', flexShrink: 0,
      overflowX: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {TABS.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            minWidth: 44, height: 44, flexShrink: 0,
            borderRadius: 22, border: 'none',
            fontSize: 19, fontWeight: active === t ? 700 : 400,
            background: active === t ? 'var(--color-info)' : 'var(--color-surface2)',
            color: active === t ? 'var(--color-bg)' : 'var(--color-text-dim)',
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
