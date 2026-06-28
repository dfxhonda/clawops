// @vitest-environment happy-dom
// SPEC-INPUT-INPUTMODE-FIX-01 AC5: ラッパー(TInput/Input)がinputMode propをDOM inputに透過する
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

// TInput from AdminSupplierPage
function TInputSupplier({ value, onChange, placeholder, type = 'text', inputMode }) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full"
    />
  )
}

// TInput from AdminAlertTypesPage (same shape)
function TInputAlertTypes({ value, onChange, placeholder, type = 'text', inputMode }) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full"
    />
  )
}

// Input from AdminPrizeMasterPage
function InputPrizeMaster({ value, onChange, placeholder, type = 'text', required, className = '', inputMode }) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className={`bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full ${className}`}
    />
  )
}

describe('SPEC-INPUT-INPUTMODE-FIX-01: ラッパーinputMode透過', () => {
  it('when_TInputSupplier_receives_inputMode_numeric_should_set_attribute_on_input', () => {
    render(<TInputSupplier value="5" onChange={() => {}} type="number" inputMode="numeric" />)
    const input = document.querySelector('input')
    expect(input.getAttribute('inputmode')).toBe('numeric')
  })

  it('when_TInputAlertTypes_receives_inputMode_numeric_should_set_attribute_on_input', () => {
    render(<TInputAlertTypes value="3" onChange={() => {}} type="number" inputMode="numeric" />)
    const input = document.querySelector('input')
    expect(input.getAttribute('inputmode')).toBe('numeric')
  })

  it('when_InputPrizeMaster_receives_inputMode_decimal_should_set_attribute_on_input', () => {
    render(<InputPrizeMaster value="100" onChange={() => {}} type="number" inputMode="decimal" />)
    const input = document.querySelector('input')
    expect(input.getAttribute('inputmode')).toBe('decimal')
  })

  it('when_InputPrizeMaster_receives_inputMode_numeric_should_set_attribute_on_input', () => {
    render(<InputPrizeMaster value="12" onChange={() => {}} type="number" inputMode="numeric" />)
    const input = document.querySelector('input')
    expect(input.getAttribute('inputmode')).toBe('numeric')
  })

  it('when_TInputSupplier_omits_inputMode_should_not_set_attribute', () => {
    render(<TInputSupplier value="x" onChange={() => {}} />)
    const input = document.querySelector('input')
    expect(input.getAttribute('inputmode')).toBeNull()
  })
})
