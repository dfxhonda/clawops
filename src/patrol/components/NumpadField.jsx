import { useEffect, useRef } from 'react'

const KEYS = ['7','8','9','4','5','6','1','2','3','⌫','0','→']

export default function NumpadField({ value, onChange, label, max = 99999, allowDecimal = false, alwaysOpen = false, onClose }) {
  const inputRef = useRef(null)

  function handleKey(k) {
    if (k === '⌫') {
      onChange(String(value || '').slice(0, -1))
      return
    }
    if (k === '→') {
      if (onClose) onClose()
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
      <div className="w-full h-full grid grid-rows-4 gap-1 bg-slate-800 p-2 select-none">
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

  // bottom sheet mode (not used in OCR, for future Phase 1.5)
  return (
    <div className="relative">
      <input
        ref={inputRef}
        readOnly
        value={value || ''}
        placeholder={label || '入力'}
        className="w-full text-right py-2 px-3 text-xl font-mono rounded-lg bg-slate-800 border border-slate-600 text-white cursor-pointer"
        onFocus={e => e.target.blur()}
      />
    </div>
  )
}
