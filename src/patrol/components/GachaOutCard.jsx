import { useState } from 'react'
import PrizeSearchInput from './PrizeSearchInput'
import Term from '../../components/Term'

const INP = {
  fontSize: 15,
  background: '#0a0a14',
  border: '1px solid #2a2a44',
  borderRadius: 4,
  padding: '0.4em 0.35em',
  fontFamily: "'Courier New', Courier, monospace",
  fontWeight: 'bold',
  outline: 'none',
  WebkitAppearance: 'none',
  textAlign: 'right',
  color: '#e8e8f0',
  width: '100%',
  boxSizing: 'border-box',
}

// slot: 0=A(上), 1=B(下)
export default function GachaOutCard({ slot, out = {}, touched = {}, outDiff, prevPrizeName, onMeter, onZan, onHo, onPrize, onCost }) {
  const isA = slot === 0
  const accentColor = isA ? '#2ecc71' : '#5dade2'
  const labelChar = isA ? '▲A' : '▼B'
  const borderColor = isA ? '#27ae60' : '#2980b9'

  const [zanEditing, setZanEditing] = useState(false)

  const diff = outDiff ?? null
  const diffStr = diff != null ? (diff >= 0 ? `+${diff}` : String(diff)) : '—'
  const diffColor = diff > 0 ? '#2ecc71' : diff < 0 ? '#e74c3c' : '#555577'

  const zan = out.zan ?? ''
  const ho = (out.ho === 'ー' || out.ho == null) ? '0' : out.ho
  const cost = parseInt(out.cost) || 0
  const revenue = diff != null && diff > 0 && cost > 0 ? diff * cost : null

  const prizeName = out.prize || ''
  const nameChanged = prevPrizeName && prizeName && prizeName !== prevPrizeName

  function handleZanClick() {
    setZanEditing(true)
  }

  function handleZanBlur() {
    setZanEditing(false)
  }

  function handleZanChange(val) {
    onZan(val)
  }

  return (
    <div style={{
      background: '#12121e',
      border: `1px solid #2a2a44`,
      borderLeft: `4px solid ${borderColor}`,
      borderRadius: 6,
      padding: '7px 8px',
    }}>
      {/* 行1: ラベル / 差分 / 残数 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>{labelChar}</span>
        <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: diffColor }}>{diffStr}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Term id="residual" style={{ fontSize: 10, color: '#f0c040', fontWeight: 700 }}>残</Term>
          {zanEditing ? (
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              style={{ ...INP, width: 44, fontSize: 13 }}
              value={zan}
              onFocus={e => e.target.select()}
              onChange={e => handleZanChange(e.target.value)}
              onBlur={handleZanBlur}
            />
          ) : (
            <button
              onClick={handleZanClick}
              style={{
                width: 44,
                fontSize: 13,
                fontFamily: "'Courier New', Courier, monospace",
                fontWeight: 'bold',
                background: '#0a0a14',
                border: '1px dotted #4a4a64',
                borderRadius: 4,
                padding: '0.4em 0.35em',
                color: zan !== '' ? '#e8e8f0' : '#555577',
                textAlign: 'right',
                cursor: 'pointer',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              {zan !== '' ? zan : '—'}
            </button>
          )}
        </div>
      </div>

      {/* 行2: メーター入力 */}
      <input type="text" inputMode="numeric"
        style={{ ...INP, color: touched.meter ? '#e8e8f0' : '#a0a0c0', fontSize: 16 }}
        value={out.meter ?? ''}
        onFocus={e => { if (!touched.meter) e.target.select() }}
        onChange={e => onMeter(e.target.value)} />

      {/* 行3: 景品名 */}
      <div style={{ marginTop: 5 }}>
        <PrizeSearchInput
          value={prizeName}
          onChange={onPrize}
          onSelect={onPrize}
          inputStyle={{ fontSize: 11, padding: '3px 6px' }}
        />
        {nameChanged && (
          <span style={{ fontSize: 9, color: '#f0a040', marginLeft: 4 }}>変更</span>
        )}
      </div>

      {/* 行4: @単価 / 売上 / 補充 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Term id="at" style={{ fontSize: 10, color: '#8888a8' }}>@</Term>
          <input type="text" inputMode="numeric" maxLength={5}
            style={{ ...INP, width: 52, fontSize: 13, color: '#f0c040' }}
            value={out.cost ?? ''}
            onFocus={e => e.target.select()}
            onChange={e => onCost(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Term id="refill" style={{ fontSize: 10, color: '#f0a040', fontWeight: 700 }}>補</Term>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            style={{
              ...INP,
              width: 44,
              fontSize: 13,
              color: ho !== '0' && ho !== '' ? '#f0a040' : '#555577',
              border: '1px solid #4a3010',
              background: '#100a00',
            }}
            value={ho}
            onFocus={e => e.target.select()}
            onChange={e => onHo(e.target.value)}
          />
        </div>
        <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: revenue != null ? '#5dade2' : '#444466' }}>
          {revenue != null ? `¥${revenue.toLocaleString()}` : '¥—'}
        </span>
      </div>
    </div>
  )
}
