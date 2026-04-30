import { useState } from 'react'
import { createPortal } from 'react-dom'

const KEYS = ['7','8','9','4','5','6','1','2','3','⌫','0','→']

export default function NumpadField({ value, onChange, label, max = 99999, allowDecimal = false, alwaysOpen = false, onClose, style }) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  function handleOpen() {
    setMounted(true)
    setTimeout(() => setVisible(true), 10)
  }
  function handleClose() {
    setVisible(false)
    setTimeout(() => setMounted(false), 210)
    if (onClose) onClose()
  }

  function handleKey(k) {
    if (k === '⌫') {
      onChange(String(value || '').slice(0, -1))
      return
    }
    if (k === '→') {
      handleClose()
      return
    }
    if (k === '.' && !allowDecimal) return
    const next = String(value || '') + k
    if (!allowDecimal && isNaN(Number(next))) return
    if (Number(next) > max) return
    onChange(next)
  }

  if (alwaysOpen) {
    return (
      <div className="w-full h-full grid grid-rows-4 gap-1 bg-slate-800 p-2 select-none" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {KEYS.map(k => (
          <button
            key={k}
            onPointerDown={e => { e.preventDefault(); handleKey(k) }}
            className={`
              h-full flex items-center justify-center rounded-lg text-xl font-bold
              active:scale-95 transition-transform select-none
              ${k === '→' ? 'bg-emerald-500 text-white' :
                k === '⌫' ? 'bg-slate-600 text-slate-200' :
                'bg-slate-700 text-white'}
            `}
            style={{ gridRow: 'auto', touchAction: 'none' }}
          >
            {k}
          </button>
        ))}
      </div>
    )
  }

  // Bottom sheet mode
  return (
    <>
      <button
        onPointerDown={e => { e.preventDefault(); handleOpen() }}
        style={{
          cursor: 'pointer',
          border: '1px solid #2a2a44',
          background: '#0a0a14',
          borderRadius: 4,
          padding: '0.4em 0.35em',
          fontFamily: "'Courier New', Courier, monospace",
          fontWeight: 'bold',
          textAlign: 'right',
          color: '#e8e8f0',
          outline: 'none',
          boxSizing: 'border-box',
          WebkitAppearance: 'none',
          ...style,
        }}
      >
        {value !== '' && value != null ? value : <span style={{ opacity: 0.35, fontWeight: 400 }}>—</span>}
      </button>

      {mounted && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
          <div
            style={{
              position: 'absolute', inset: 0,
              background: visible ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0)',
              transition: 'background 200ms ease-out',
            }}
            onPointerDown={handleClose}
          />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            maxHeight: '45vh',
            background: '#13132a', borderRadius: '12px 12px 0 0',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.7)',
            transform: visible ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 200ms ease-out',
          }}>
            <div style={{
              height: 36, padding: '0 16px', borderBottom: '1px solid #2a2a44',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 13, color: '#8888a8' }}>{label || ''}</span>
              <span style={{
                fontSize: 22, fontFamily: "'Courier New', monospace",
                fontWeight: 'bold', color: '#e8e8f0',
              }}>
                {value !== '' && value != null ? value : '—'}
              </span>
            </div>
            <div style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gridTemplateRows: 'repeat(4, 1fr)',
              gap: 2,
              padding: 6,
            }}>
              {KEYS.map(k => (
                <button
                  key={k}
                  onPointerDown={e => { e.preventDefault(); handleKey(k) }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: 52, borderRadius: 8, fontSize: 20, fontWeight: 'bold',
                    border: 'none', cursor: 'pointer', touchAction: 'none',
                    background: k === '→' ? '#059669' : k === '⌫' ? '#4b5563' : '#1e293b',
                    color: '#f1f5f9',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
