// カメラ + IN + IN差 表示行 (および単独IN行として使用)
import { HelpBtn } from '../../common/components/HelpModal'

const INP = { fontSize: 16, background: '#222238', border: '1px solid #2a2a44', borderRadius: 4, padding: '0.45em 0.35em', fontFamily: "'Courier New', Courier, monospace", fontWeight: 'bold', outline: 'none', color: '#d0d0e0', WebkitAppearance: 'none', textAlign: 'right', minWidth: 0, flex: 1 }

export default function MeterInputRow({ inMeter, inTouched, inDiff, onChange, onCamera, showDiff = false, onHelp }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
      {onCamera && (
        <button onClick={onCamera} style={{ width: 38, height: 38, borderRadius: 6, background: '#5dade2', color: '#000', border: 'none', fontSize: 17, flexShrink: 0, padding: 0, cursor: 'pointer' }}>
          📷
        </button>
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 10, color: '#8888a8', flexShrink: 0, textAlign: 'center' }}>IN</span>
          {onHelp && <HelpBtn onClick={onHelp} />}
        <input
          type="text" inputMode="numeric"
          style={inTouched ? { ...INP, color: '#e8e8f0' } : INP}
          value={inMeter}
          onFocus={e => { if (!inTouched) e.target.select() }}
          onChange={e => onChange(e.target.value)}
        />
      </div>
      {showDiff && (
        <span style={{ fontSize: 11, fontWeight: 700, color: '#2ecc71', fontFamily: "'Courier New', monospace", padding: '0 6px', minWidth: 32, textAlign: 'right', flexShrink: 0 }}>
          {inDiff != null ? (inDiff >= 0 ? '+' : '') + inDiff : '—'}
        </span>
      )}
    </div>
  )
}
