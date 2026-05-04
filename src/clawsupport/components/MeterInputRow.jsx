import NumpadField from './NumpadField'

const INP = { fontSize: 16, background: '#222238', border: '1px solid #2a2a44', borderRadius: 4, padding: '0.45em 0.35em', fontFamily: "'Courier New', Courier, monospace", fontWeight: 'bold', outline: 'none', color: '#d0d0e0', WebkitAppearance: 'none', textAlign: 'right', minWidth: 0, flex: 1, boxSizing: 'border-box' }

const BTN = { width: 38, height: 38, borderRadius: 6, color: '#000', border: 'none', fontSize: 17, flexShrink: 0, padding: 0, cursor: 'pointer' }

export default function MeterInputRow({ inMeter, inTouched, inDiff, onChange, onCamera, onGallery, showDiff = false, ocrStatusText }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
      {onCamera && (
        <button onClick={onCamera} style={{ ...BTN, background: '#5dade2' }}>📷</button>
      )}
      {onGallery && (
        <button onClick={onGallery} style={{ ...BTN, background: '#7c6cd4' }}>🖼️</button>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#8888a8', flexShrink: 0, width: 18, textAlign: 'center' }}>IN</span>
          <NumpadField
            value={inMeter}
            onChange={onChange}
            label="INメーター"
            max={999999}
            style={inTouched ? { ...INP, color: '#e8e8f0' } : INP}
          />
        </div>
        {ocrStatusText && (
          <div style={{ fontSize: 10, color: '#6b7280', paddingLeft: 20, marginTop: 1 }}>
            {ocrStatusText}
          </div>
        )}
      </div>
      {showDiff && (
        <span style={{ fontSize: 11, fontWeight: 700, color: '#2ecc71', fontFamily: "'Courier New', monospace", padding: '0 6px', minWidth: 32, textAlign: 'right', flexShrink: 0 }}>
          {inDiff != null ? (inDiff >= 0 ? '+' : '') + inDiff : '—'}
        </span>
      )}
    </div>
  )
}
