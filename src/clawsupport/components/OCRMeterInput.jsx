import { useState } from 'react'
import LiveCameraView from './LiveCameraView'
import CustomNumpad from './CustomNumpad'
import { useOCR } from '../hooks/useOCR'

const INP = {
  fontSize: 16, background: '#222238', border: '1px solid #2a2a44', borderRadius: 4,
  padding: '0.45em 0.35em', fontFamily: "'Courier New', Courier, monospace",
  fontWeight: 'bold', outline: 'none', color: '#d0d0e0', WebkitAppearance: 'none',
  textAlign: 'right', width: '100%', boxSizing: 'border-box',
}

export default function OCRMeterInput({ value, onChange, label, boothCode, orgId, max = 999999, onQR }) {
  const [showCamera, setShowCamera] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [draft, setDraft] = useState('')
  const [captured, setCaptured] = useState(null)

  const { engine, toggleEngine, loading, error, boundingBox, runOCR } = useOCR({ boothCode, orgId })

  async function handleCapture(base64, blob) {
    setShowCamera(false)
    setCaptured({ base64, url: blob ? URL.createObjectURL(blob) : null })
    setConfirming(true)
    setDraft('')

    const { value: v } = await runOCR(base64, blob)
    if (v != null) setDraft(String(v))
  }

  function handleQR(code) {
    setShowCamera(false)
    onQR?.(code)
  }

  function handleNumKey(k) {
    if (k === '⌫') {
      setDraft(d => d.slice(0, -1))
    } else {
      setDraft(d => {
        const next = d + k
        return parseInt(next, 10) > max ? d : next
      })
    }
  }

  function confirmDraft() {
    if (draft !== '') onChange(draft)
    setConfirming(false)
    setCaptured(null)
  }

  function cancelConfirm() {
    setConfirming(false)
    setCaptured(null)
  }

  if (showCamera) {
    return (
      <LiveCameraView
        engine={engine}
        onToggleEngine={toggleEngine}
        onCapture={handleCapture}
        onQR={handleQR}
        onCancel={() => setShowCamera(false)}
      />
    )
  }

  if (confirming) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: '#0a0a16', display: 'flex', flexDirection: 'column' }}>
        {/* top 1/3: captured image with optional bounding box highlight */}
        {captured?.url && (
          <div style={{ position: 'relative', maxHeight: '33dvh', overflow: 'hidden', flexShrink: 0 }}>
            <img src={captured.url} alt="captured" style={{ width: '100%', objectFit: 'cover', display: 'block' }} />
            {error && boundingBox && (
              <div style={{
                position: 'absolute',
                left: `${boundingBox.x * 100}%`,
                top: `${boundingBox.y * 100}%`,
                width: `${boundingBox.w * 100}%`,
                height: `${boundingBox.h * 100}%`,
                border: '2px solid #facc15',
                boxSizing: 'border-box',
              }} />
            )}
          </div>
        )}

        {/* result / error */}
        <div style={{ padding: '12px 16px', flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: '#8888a8', marginBottom: 4 }}>{label}</p>
          {loading && <p style={{ color: '#8888a8', fontSize: 13 }}>読み取り中…</p>}
          {error && !loading && <p style={{ color: '#f87171', fontSize: 12 }}>{error} — 手動入力してください</p>}
          <input
            readOnly
            value={draft}
            style={{ ...INP, fontSize: 28, background: 'transparent', border: 'none', borderBottom: '2px solid #5dade2', borderRadius: 0, width: '100%' }}
          />
        </div>

        {/* numpad */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <CustomNumpad onKey={handleNumKey} />
        </div>

        {/* actions */}
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px 32px' }}>
          <button onClick={cancelConfirm} style={{ flex: 1, padding: 12, borderRadius: 8, background: '#2a2a44', color: '#e0e0f0', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            キャンセル
          </button>
          <button onClick={confirmDraft} disabled={!draft} style={{ flex: 2, padding: 12, borderRadius: 8, background: draft ? '#5dade2' : '#2a2a44', color: '#000', border: 'none', fontWeight: 700, fontSize: 14, cursor: draft ? 'pointer' : 'default' }}>
            セット
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <button
        onClick={() => setShowCamera(true)}
        style={{ width: 32, height: 32, borderRadius: 6, background: '#5dade2', color: '#000', border: 'none', fontSize: 15, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        📷
      </button>
      <input
        readOnly
        value={value ?? ''}
        style={INP}
        onClick={() => setShowCamera(true)}
        placeholder="—"
      />
    </div>
  )
}
