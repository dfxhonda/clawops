// A/C/L/R/O 設定行 (パターンA専用) — クレーン機設定パラメータ
import Term from '../../components/Term'

const INP = { fontSize: 16, background: '#222238', border: '1px solid #2a2a44', borderRadius: 4, padding: '0.35em 2px', fontFamily: "'Courier New', Courier, monospace", fontWeight: 'bold', outline: 'none', WebkitAppearance: 'none', textAlign: 'center', width: 42 }
const INP_RO = { ...INP, color: '#8888a8', background: 'rgba(18,18,30,.8)', borderColor: 'transparent', pointerEvents: 'none' }

const CLAW_KEYS = [
  { k: 'A', termId: 'a' },
  { k: 'C', termId: 'c' },
  { k: 'L', termId: 'l' },
  { k: 'R', termId: 'r' },
]

export default function SettingRow({ setA, setC, setL, setR, setO, readonly = false, onSetA, onSetC, onSetL, onSetR, onSetO }) {
  const vals = { A: setA, C: setC, L: setL, R: setR }
  const cbs  = { A: onSetA, C: onSetC, L: onSetL, R: onSetR }
  return (
    <div style={{ display: 'flex', gap: 3, marginBottom: 6, alignItems: 'center' }}>
      {CLAW_KEYS.map(({ k, termId }) => (
        <div key={k} style={{ flexShrink: 0 }}>
          <Term id={termId} style={{ fontSize: 11, color: '#f0c040', fontWeight: 700, display: 'block', textAlign: 'center' }}>
            {k}
          </Term>
          <input type="text" inputMode="numeric" maxLength={3}
            style={readonly ? INP_RO : { ...INP, color: '#d0d0e0' }}
            value={vals[k] || ''} placeholder="-"
            onFocus={e => e.target.select()}
            onChange={e => !readonly && cbs[k]?.(e.target.value)}
          />
        </div>
      ))}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Term id="o" style={{ fontSize: 11, color: '#f0c040', fontWeight: 700, display: 'block' }}>O</Term>
        <input type="text"
          style={{ ...INP, width: '100%', textAlign: 'left', padding: '0.35em 0.3em' }}
          value={setO || ''}
          placeholder="-"
          onFocus={e => e.target.select()}
          onChange={e => onSetO?.(e.target.value)}
        />
      </div>
    </div>
  )
}
