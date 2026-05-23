import { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const KEYS = ['7','8','9','4','5','6','1','2','3','⌫','0','→']

export function NumpadFooterPanel({ currentField }) {
  const isActive = !!currentField

  function handleKey(k) {
    if (!currentField) return

    const { onChange, allowDecimal, max, freshRef, valueRef, dataTabindex } = currentField

    if (k === '⌫') {
      freshRef.current = false
      onChange(String(valueRef.current ?? '').slice(0, -1))
      return
    }

    if (k === '→') {
      const all = Array.from(document.querySelectorAll('[data-tabindex]'))
        .sort((a, b) => Number(a.dataset.tabindex) - Number(b.dataset.tabindex))
      const idx = all.findIndex(el => Number(el.dataset.tabindex) === dataTabindex)
      const nextEl = all[idx + 1]
      if (nextEl?._numpadActivate) nextEl._numpadActivate()
      else if (nextEl) nextEl.focus()
      return
    }

    if (k === '.' && !allowDecimal) return

    const base = freshRef.current ? '' : String(valueRef.current ?? '')
    freshRef.current = false

    const next = base + k
    if (!allowDecimal && isNaN(Number(next))) return
    if (Number(next) > max) return
    onChange(next)
  }

  const displayVal = currentField ? String(currentField.valueRef.current ?? '') : ''

  return createPortal(
    <div
      data-testid="numpad-footer"
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: 'calc(280px + env(safe-area-inset-bottom))',
        background: '#13132a',
        borderRadius: '12px 12px 0 0',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.7)',
        zIndex: 10,
        opacity: isActive ? 1 : 0.5,
        transition: 'opacity 150ms ease',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div style={{
        height: 44, padding: '0 12px', borderBottom: '1px solid #2a2a44',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <span
          data-testid="numpad-active-label"
          style={isActive ? {
            fontSize: 16, fontWeight: 'bold', color: '#2563eb',
            background: '#eff6ff', padding: '2px 12px', borderRadius: 6,
          } : {
            fontSize: 14, color: '#6b7280',
          }}
        >
          {isActive ? `入力中: ${currentField.label}` : 'タップして選択'}
        </span>
        <span style={{
          fontSize: 22, fontFamily: "'Courier New', monospace",
          fontWeight: 'bold', color: '#e8e8f0',
        }}>
          {displayVal || '—'}
        </span>
      </div>
      <div
        data-testid="numpad-sheet"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(4, 1fr)',
          gap: 2,
          padding: 6,
        }}
      >
        {KEYS.map(k => (
          <button
            key={k}
            data-numpad-key={k}
            disabled={!isActive}
            onPointerDown={e => { e.preventDefault(); handleKey(k) }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 52, borderRadius: 8, fontSize: 20, fontWeight: 'bold',
              border: 'none',
              cursor: isActive ? 'pointer' : 'default',
              touchAction: 'none',
              background: !isActive ? '#1e293b' :
                k === '→' ? '#059669' : k === '⌫' ? '#4b5563' : '#1e293b',
              color: isActive ? '#f1f5f9' : '#374151',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {k}
          </button>
        ))}
      </div>
    </div>,
    document.body
  )
}

export default function NumpadField({
  value,
  onChange,
  label,
  max = 99999,
  allowDecimal = false,
  alwaysOpen = false,
  onNext,
  id,
  style,
  dataTabindex,
  inputClassName,
  testId,
  inputPlaceholder,
  onRegister,
  isActive = false,
}) {
  const inputRef = useRef(null)
  const freshRef = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const activateRef = useRef(null)

  function activate() {
    inputRef.current?.focus()
    freshRef.current = true
    onRegister?.({
      valueRef,
      onChange: (v) => onChangeRef.current(v),
      onNext,
      dataTabindex: Number(dataTabindex),
      allowDecimal,
      max,
      label,
      freshRef,
    })
  }
  activateRef.current = activate

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current._numpadActivate = () => activateRef.current()
    }
  }, [])

  // alwaysOpen branch kept for OcrCaptureScreen + StockCount usage
  if (alwaysOpen) {
    function handleKeyInline(k) {
      if (k === '⌫') {
        onChange(String(value || '').slice(0, -1))
        return
      }
      if (k === '→') {
        if (onNext) onNext()
        return
      }
      if (k === '.' && !allowDecimal) return
      const next = String(value || '') + k
      if (!allowDecimal && isNaN(Number(next))) return
      if (Number(next) > max) return
      onChange(next)
    }
    return (
      <div className="w-full h-full grid grid-rows-4 gap-1 bg-slate-800 p-2 select-none" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {KEYS.map(k => (
          <button
            key={k}
            onPointerDown={e => { e.preventDefault(); handleKeyInline(k) }}
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

  const displayVal = value !== '' && value != null ? String(value) : ''

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      readOnly
      inputMode="none"
      data-tabindex={dataTabindex}
      data-testid={testId}
      value={displayVal}
      placeholder={inputPlaceholder ?? '—'}
      onPointerDown={e => {
        e.preventDefault()
        activate()
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          if (onNext) onNext()
          const all = Array.from(document.querySelectorAll('[data-tabindex]'))
            .sort((a, b) => Number(a.dataset.tabindex) - Number(b.dataset.tabindex))
          const idx = all.findIndex(el => Number(el.dataset.tabindex) === Number(dataTabindex))
          const nextEl = all[idx + 1]
          if (nextEl?._numpadActivate) nextEl._numpadActivate()
          else if (nextEl) nextEl.focus()
        }
      }}
      className={inputClassName ?? ''}
      style={{
        cursor: 'pointer',
        border: isActive ? '1px solid #3b82f6' : '1px solid #2a2a44',
        background: isActive ? '#eff6ff' : '#0a0a14',
        borderRadius: 4,
        padding: '0.4em 0.35em',
        fontFamily: "'Courier New', Courier, monospace",
        fontWeight: 'bold',
        textAlign: 'right',
        outline: 'none',
        boxSizing: 'border-box',
        WebkitAppearance: 'none',
        fontSize: 16,
        ...(isActive ? { color: '#1e3a5f' } : {}),
        ...style,
      }}
    />
  )
}
