import { useRef, useEffect, useLayoutEffect, useState } from 'react'
import { isCustomNumpadEnabled } from '../../shared/lib/device'

// SPEC-NUMPAD-CARET-VISIBLE-01: 自前点滅キャレットオーバーレイ用 @keyframes を一度だけ注入
function _injectCaretStyle() {
  if (typeof document === 'undefined') return
  if (document.getElementById('_numpad_caret_style')) return
  const s = document.createElement('style')
  s.id = '_numpad_caret_style'
  s.textContent = '@keyframes _numpad_caret_blink{0%,100%{opacity:1}50%{opacity:0}}'
  document.head.appendChild(s)
}

// SPEC-NUMPAD-CARET-EDIT-4COL-01: 4列×4行レイアウト。内部IDと表示ラベルを分離(ret用→とcaret用→の衝突回避)。
// 7 8 9 ⌫ / 4 5 6 C / 1 2 3 ⏎ / ← 0 → [空]
const KEYS = [
  { id: '7', label: '7' }, { id: '8', label: '8' }, { id: '9', label: '9' }, { id: 'bs', label: '⌫' },
  { id: '4', label: '4' }, { id: '5', label: '5' }, { id: '6', label: '6' }, { id: 'c', label: 'C' },
  { id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }, { id: 'ret', label: '⏎' },
  { id: 'caretL', label: '←' }, { id: '0', label: '0' }, { id: 'caretR', label: '→' }, null,
]

// SPEC-NUMPAD-CARET-EDIT-4COL-01: 56px/行(4行=224px≒27%画面占有)。旧88px×4=352px(約42%)から大幅圧縮。
const NUMPAD_ROW_MIN_PX = 56

// iPhone以外 (iPad=システムKB / PC=物理KB) 用の native 数値入力。
// カスタムテンキーを出さず、OS のキーボードに委ねる。値の検証 (max/小数/数字のみ) は維持。
function NativeNumInput({
  value, onChange, onNext, allowDecimal, max,
  id, dataTabindex, inputClassName, style, testId, inputPlaceholder, isActive, fill,
}) {
  function sanitize(raw) {
    let v = String(raw ?? '')
    v = allowDecimal ? v.replace(/[^0-9.]/g, '') : v.replace(/[^0-9]/g, '')
    if (allowDecimal) {
      const i = v.indexOf('.')
      if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '')
    }
    return v
  }
  function handleChange(e) {
    const v = sanitize(e.target.value)
    if (v !== '' && Number(v) > max) return
    onChange(v)
  }
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (onNext) onNext()
      if (dataTabindex != null) {
        const all = Array.from(document.querySelectorAll('[data-tabindex]'))
          .sort((a, b) => Number(a.dataset.tabindex) - Number(b.dataset.tabindex))
        const idx = all.findIndex(el => Number(el.dataset.tabindex) === Number(dataTabindex))
        const nextEl = all[idx + 1]
        if (nextEl) nextEl.focus()
      }
    }
  }
  const displayVal = value !== '' && value != null ? String(value) : ''
  return (
    <input
      id={id}
      data-tabindex={dataTabindex}
      data-testid={testId}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      pattern={allowDecimal ? '[0-9]*[.]?[0-9]*' : '[0-9]*'}
      value={displayVal}
      placeholder={inputPlaceholder ?? '—'}
      autoComplete="off"
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={inputClassName ?? ''}
      style={fill ? {
        width: '100%', height: '100%', textAlign: 'center',
        fontSize: 28, fontWeight: 'bold', fontFamily: "'Courier New', monospace",
        background: '#0a0a14', color: '#f1f5f9', border: 'none', outline: 'none',
        WebkitAppearance: 'none', boxSizing: 'border-box',
        ...style,
      } : {
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
        color: isActive ? '#1e3a5f' : '#e8e8f0',
        ...style,
      }}
    />
  )
}

export function NumpadFooterPanel({ currentField, idleContent }) {
  if (!isCustomNumpadEnabled()) return null

  const isActive = !!currentField

  function handleKey(keyId) {
    if (!currentField) return
    const { onChange, allowDecimal, max, freshRef, valueRef, dataTabindex, caretPosRef, inputRef } = currentField

    if (keyId === 'bs') {
      freshRef.current = false
      const val = String(valueRef.current ?? '')
      const caret = caretPosRef.current
      if (caret === 0) return
      caretPosRef.current = caret - 1
      onChange(val.slice(0, caret - 1) + val.slice(caret))
      return
    }
    if (keyId === 'c') {
      freshRef.current = false
      caretPosRef.current = 0
      onChange('')
      return
    }
    if (keyId === 'ret') {
      const all = Array.from(document.querySelectorAll('[data-tabindex]'))
        .sort((a, b) => Number(a.dataset.tabindex) - Number(b.dataset.tabindex))
      const idx = all.findIndex(el => Number(el.dataset.tabindex) === dataTabindex)
      const nextEl = all[idx + 1]
      if (nextEl?._numpadActivate) nextEl._numpadActivate()
      else if (nextEl) nextEl.focus()
      else currentField.onClear?.()
      return
    }
    if (keyId === 'caretL') {
      freshRef.current = false
      caretPosRef.current = Math.max(0, caretPosRef.current - 1)
      inputRef?.current?.setSelectionRange?.(caretPosRef.current, caretPosRef.current)
      currentField.onCaretChange?.()
      return
    }
    if (keyId === 'caretR') {
      freshRef.current = false
      const curLen = String(valueRef.current ?? '').length
      caretPosRef.current = Math.min(curLen, caretPosRef.current + 1)
      inputRef?.current?.setSelectionRange?.(caretPosRef.current, caretPosRef.current)
      currentField.onCaretChange?.()
      return
    }
    // digit: caret位置に挿入、freshRefクリア
    const val = freshRef.current ? '' : String(valueRef.current ?? '')
    const caret = freshRef.current ? 0 : caretPosRef.current
    freshRef.current = false
    const next = val.slice(0, caret) + keyId + val.slice(caret)
    if (!allowDecimal && isNaN(Number(next))) return
    if (Number(next) > max) return
    caretPosRef.current = caret + 1
    onChange(next)
  }

  const displayVal = currentField ? String(currentField.valueRef.current ?? '') : ''

  return (
    <div
      data-testid="numpad-footer"
      style={{
        flex: 1,
        minHeight: 0,
        background: '#13132a',
        borderRadius: '12px 12px 0 0',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.7)',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom)',
        overflow: 'hidden',
      }}
    >
      {!isActive && idleContent ? (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {idleContent}
        </div>
      ) : (
        <>
          <div style={{
            height: 30, padding: '0 12px', borderBottom: '1px solid #2a2a44',
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
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridTemplateRows: 'repeat(4, 1fr)',
              gap: 0,
              padding: 0,
            }}
          >
            {KEYS.map((k, i) => k === null ? (
              <div key={`empty-${i}`} />
            ) : (
              <button
                key={k.id}
                data-numpad-key={k.id}
                disabled={!isActive}
                onPointerDown={e => { e.preventDefault(); handleKey(k.id) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '100%', minHeight: 0, borderRadius: 8, fontSize: 20, fontWeight: 'bold',
                  border: 'none',
                  cursor: isActive ? 'pointer' : 'default',
                  touchAction: 'none',
                  background: !isActive ? '#1e293b' :
                    k.id === 'ret' ? '#059669' :
                    k.id === 'bs' || k.id === 'c' ? '#4b5563' :
                    k.id === 'caretL' || k.id === 'caretR' ? '#374151' :
                    '#1e293b',
                  color: isActive ? '#f1f5f9' : '#374151',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {k.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function NumpadField({
  value,
  onChange,
  label,
  max = 999999,
  allowDecimal = false,
  alwaysOpen = false,
  onNext,
  onClear,
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
  const caretPosRef = useRef(String(value ?? '').length)
  // alwaysOpen path ローカルキャレット状態 (NumpadFooterPanelはcaretPosRefで管理)
  const [aoCaretPos, setAoCaretPos] = useState(() => String(value ?? '').length)
  // SPEC-NUMPAD-CARET-VISIBLE-01: caretL/caretR時(value変化なし)に再レンダリングを起こすカウンタ
  const [, setCaretTick] = useState(0)

  useEffect(() => { _injectCaretStyle() }, [])

  function activate() {
    const initCaret = String(value ?? '').length
    caretPosRef.current = initCaret
    inputRef.current?.focus()
    inputRef.current?.setSelectionRange?.(initCaret, initCaret)
    freshRef.current = true
    onRegister?.({
      valueRef,
      caretPosRef,
      inputRef,
      onChange: (v) => onChangeRef.current(v),
      onCaretChange: () => setCaretTick(t => t + 1),
      onNext,
      onClear,
      dataTabindex: Number(dataTabindex),
      allowDecimal,
      max,
      label,
      freshRef,
    })
  }
  activateRef.current = activate

  // value変更後にsetSelectionRangeでcaret位置をDOM同期(React controlled caret jump回避)
  useLayoutEffect(() => {
    if (alwaysOpen || !isCustomNumpadEnabled()) return
    if (!inputRef.current) return
    const len = String(value ?? '').length
    const pos = Math.min(caretPosRef.current, len)
    inputRef.current.setSelectionRange(pos, pos)
  }, [value, alwaysOpen])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current._numpadActivate = () => activateRef.current?.()
    }
  }, [])

  // alwaysOpen branch kept for OcrCaptureScreen + StockCount usage
  if (alwaysOpen) {
    if (!isCustomNumpadEnabled()) {
      return (
        <NativeNumInput
          value={value} onChange={onChange} onNext={onNext}
          allowDecimal={allowDecimal} max={max} testId={testId} inputPlaceholder={inputPlaceholder}
          fill
        />
      )
    }
    function handleKeyInline(keyId) {
      const val = String(value ?? '')
      const caret = aoCaretPos
      if (keyId === 'bs') {
        if (caret === 0) return
        onChange(val.slice(0, caret - 1) + val.slice(caret))
        setAoCaretPos(caret - 1)
        return
      }
      if (keyId === 'c') {
        onChange('')
        setAoCaretPos(0)
        return
      }
      if (keyId === 'ret') {
        if (onNext) onNext()
        return
      }
      if (keyId === 'caretL') {
        setAoCaretPos(Math.max(0, caret - 1))
        return
      }
      if (keyId === 'caretR') {
        setAoCaretPos(Math.min(val.length, caret + 1))
        return
      }
      // digit
      const next = val.slice(0, caret) + keyId + val.slice(caret)
      if (!allowDecimal && isNaN(Number(next))) return
      if (Number(next) > max) return
      onChange(next)
      setAoCaretPos(caret + 1)
    }
    return (
      <div
        className="w-full h-full gap-1 bg-slate-800 p-2 select-none"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 1fr)' }}
      >
        {KEYS.map((k, i) => k === null ? (
          <div key={`empty-${i}`} />
        ) : (
          <button
            key={k.id}
            onPointerDown={e => { e.preventDefault(); handleKeyInline(k.id) }}
            className={`
              h-full flex items-center justify-center rounded-lg text-xl font-bold
              active:scale-95 transition-transform select-none
              ${k.id === 'ret' ? 'bg-emerald-500 text-white' :
                k.id === 'bs' || k.id === 'c' ? 'bg-slate-600 text-slate-200' :
                k.id === 'caretL' || k.id === 'caretR' ? 'bg-slate-500 text-slate-200' :
                'bg-slate-700 text-white'}
            `}
            style={{ touchAction: 'none' }}
          >
            {k.label}
          </button>
        ))}
      </div>
    )
  }

  if (!isCustomNumpadEnabled()) {
    return (
      <NativeNumInput
        value={value} onChange={onChange} onNext={onNext}
        allowDecimal={allowDecimal} max={max}
        id={id} dataTabindex={dataTabindex} testId={testId}
        inputClassName={inputClassName} style={style}
        inputPlaceholder={inputPlaceholder} isActive={isActive}
      />
    )
  }

  const displayVal = value !== '' && value != null ? String(value) : ''
  // SPEC-NUMPAD-CARET-VISIBLE-01: 点滅縦棒のright位置計算(等幅Courier New, textAlign:right基準)
  const caretPos = Math.min(caretPosRef.current, displayVal.length)
  const charsFromRight = displayVal.length - caretPos

  return (
    <div style={{ position: 'relative' }}>
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
          width: '100%',
          ...(isActive ? { color: '#1e3a5f' } : {}),
          ...style,
        }}
      />
      {isActive && (
        <span
          aria-hidden="true"
          data-testid="numpad-caret-overlay"
          style={{
            position: 'absolute',
            top: '50%',
            right: `calc(0.35em + ${charsFromRight}ch)`,
            transform: 'translateY(-50%)',
            width: 2,
            height: '1em',
            background: '#2563eb',
            borderRadius: 1,
            animation: '_numpad_caret_blink 1s step-end infinite',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
