// @vitest-environment happy-dom
// NumpadField: iPhone=カスタムテンキー / iPhone以外=native input の分岐
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import NumpadField from './NumpadField'

function setUA(ua) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
}
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
const IPAD_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15' // iPadOS13+はMac偽装/PCも同様

afterEach(() => cleanup())

describe('iPhone: alwaysOpen カスタムテンキー', () => {
  beforeEach(() => {
    setUA(IPHONE_UA)
    // J-COLLECTION-12 派生 (ad-hoc): isCustomNumpadEnabled() を true に強制 (本 describe は legacy 経路検証用)
    window.__USE_CUSTOM_NUMPAD__ = true
  })
  afterEach(() => { delete window.__USE_CUSTOM_NUMPAD__ })
  function renderPad(props = {}) {
    const onChange = vi.fn()
    const onNext = vi.fn()
    render(
      <NumpadField alwaysOpen value={props.value ?? ''} onChange={onChange} onNext={onNext}
        allowDecimal={props.allowDecimal ?? false} max={props.max ?? 99999} />,
    )
    const key = (k) => fireEvent.pointerDown(screen.getByText(k))
    return { onChange, onNext, key }
  }

  it('when_数字キー_should_末尾に追加してonChange', () => {
    const { onChange, key } = renderPad({ value: '12' })
    key('3')
    expect(onChange).toHaveBeenCalledWith('123')
  })

  it('when_バックスペース_should_末尾1文字削除', () => {
    const { onChange, key } = renderPad({ value: '120' })
    key('⌫')
    expect(onChange).toHaveBeenCalledWith('12')
  })

  it('when_→キー_should_onNextを呼ぶ', () => {
    const { onNext, key } = renderPad({ value: '5' })
    key('→')
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('when_max超過入力_should_onChangeしない', () => {
    const { onChange, key } = renderPad({ value: '99999', max: 99999 })
    key('9')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('when_空からの数字_should_その数字になる', () => {
    const { onChange, key } = renderPad({ value: '' })
    key('7')
    expect(onChange).toHaveBeenCalledWith('7')
  })

  it('default mode は readOnly input (OSキーボード抑止)', () => {
    render(<NumpadField value="" onChange={vi.fn()} testId="pf" label="x" />)
    expect(screen.getByTestId('pf')).toHaveAttribute('readonly')
  })
})

describe('iPhone以外 (iPad/PC): native input', () => {
  beforeEach(() => {
    setUA(IPAD_UA)
    // SPEC-OCR-MODAL-KEYBOARD-SHIFT-FIX-01: isCustomNumpadEnabled() はデフォルト true になったため
    // native input 経路を明示的にテストするため false に固定
    window.__USE_CUSTOM_NUMPAD__ = false
  })
  afterEach(() => { delete window.__USE_CUSTOM_NUMPAD__ })

  it('default mode は readOnly でない編集可能 input (OSキーボードに委譲)', () => {
    render(<NumpadField value="" onChange={vi.fn()} testId="pf" label="x" />)
    const el = screen.getByTestId('pf')
    expect(el).not.toHaveAttribute('readonly')
    expect(el).toHaveAttribute('inputmode', 'numeric')
  })

  it('when_数字入力_should_onChangeにサニタイズ値', () => {
    const onChange = vi.fn()
    render(<NumpadField value="" onChange={onChange} testId="pf" />)
    fireEvent.change(screen.getByTestId('pf'), { target: { value: '12a3' } })
    expect(onChange).toHaveBeenCalledWith('123')
  })

  it('when_max超過_should_onChangeしない', () => {
    const onChange = vi.fn()
    render(<NumpadField value="" onChange={onChange} testId="pf" max={100} />)
    fireEvent.change(screen.getByTestId('pf'), { target: { value: '999' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('when_Enter_should_onNextを呼ぶ', () => {
    const onNext = vi.fn()
    render(<NumpadField value="5" onChange={vi.fn()} onNext={onNext} testId="pf" />)
    fireEvent.keyDown(screen.getByTestId('pf'), { key: 'Enter' })
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('alwaysOpen も native input (テンキーボタンを出さない)', () => {
    const onChange = vi.fn()
    render(<NumpadField alwaysOpen value="" onChange={onChange} testId="pf" />)
    expect(screen.queryByText('7')).toBeNull()
    fireEvent.change(screen.getByTestId('pf'), { target: { value: '8' } })
    expect(onChange).toHaveBeenCalledWith('8')
  })
})
