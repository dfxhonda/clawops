import { useRef } from 'react'

/**
 * モバイル向け数値入力コンポーネント
 * - テンキーキーボード表示 (inputMode="numeric")
 * - +/- ステッパーボタン付き
 *
 * props: value, onChange(newValue), min, max, step, className, style, placeholder, disabled
 */
export default function NumberInput({ value, onChange, min, max, step = 1, className = '', style = {}, placeholder = '', disabled = false }) {
  const ref = useRef(null)
  const numVal = value === '' || value == null ? null : Number(value)

  function increment() {
    const next = (numVal ?? 0) + step
    if (max != null && next > max) return
    onChange(String(next))
  }

  function decrement() {
    const next = (numVal ?? 0) - step
    if (min != null && next < min) return
    onChange(String(next))
  }

  function handleChange(e) {
    onChange(e.target.value)
  }

  const btnStyle = {
    width: 36, height: 36, border: '1px solid #333', borderRadius: 8,
    background: '#252525', color: '#aaa', fontSize: 18, fontWeight: 'bold',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
    flexShrink: 0, padding: 0, lineHeight: 1,
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      <button type="button" onClick={decrement} disabled={disabled || (min != null && (numVal ?? 0) <= min)} style={btnStyle}>
        −
      </button>
      <input
        ref={ref}
        type="tel"
        value={value ?? ''}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        style={{
          flex: 1, minWidth: 0, textAlign: 'center', fontSize: 16, fontWeight: 'bold',
          background: '#1a1a1a', border: '1px solid #333', borderRadius: 8,
          color: '#e0e0e0', padding: '8px 4px', outline: 'none',
          opacity: disabled ? 0.5 : 1,
        }}
      />
      <button type="button" onClick={increment} disabled={disabled || (max != null && (numVal ?? 0) >= max)} style={btnStyle}>
        +
      </button>
    </div>
  )
}
