// @vitest-environment happy-dom
// NumpadField: iPhone=カスタムテンキー / iPhone以外=native input の分岐
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import NumpadField, { NumpadFooterPanel } from './NumpadField'

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

  it('when_retキー_should_onNextを呼ぶ', () => {
    const { onNext, key } = renderPad({ value: '5' })
    key('⏎')
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

describe('NumpadField: キャレットオーバーレイ (SPEC-NUMPAD-CARET-VISIBLE-01)', () => {
  beforeEach(() => { window.__USE_CUSTOM_NUMPAD__ = true })
  afterEach(() => { delete window.__USE_CUSTOM_NUMPAD__ })

  it('when_isActive=true_should_キャレットspan描画', () => {
    render(<NumpadField value="123" isActive onChange={vi.fn()} testId="pf" label="IN" />)
    expect(screen.getByTestId('numpad-caret-overlay')).toBeTruthy()
  })

  it('when_isActive=false_should_キャレットspan非描画', () => {
    render(<NumpadField value="123" isActive={false} onChange={vi.fn()} testId="pf" label="IN" />)
    expect(screen.queryByTestId('numpad-caret-overlay')).toBeNull()
  })

  it('when_readOnly_inputMode=none_should_OSキーボード属性維持 (回帰ガード)', () => {
    render(<NumpadField value="" isActive onChange={vi.fn()} testId="pf" label="IN" />)
    const input = screen.getByTestId('pf')
    expect(input).toHaveAttribute('readonly')
    expect(input).toHaveAttribute('inputmode', 'none')
  })

  it('when_caretL押下_should_キャレットspan右位置が増加(左移動)', () => {
    const { field } = (() => {
      const caretPosRef = { current: 2 }
      const onChange = vi.fn()
      return { field: { valueRef: { current: '12' }, caretPosRef, inputRef: { current: null }, onChange, allowDecimal: false, max: 99999, freshRef: { current: false }, dataTabindex: 1, label: 'IN', onCaretChange: vi.fn() } }
    })()
    render(<NumpadFooterPanel currentField={field} />)
    const spanBefore = screen.queryByTestId('numpad-caret-overlay')
    // NumpadFooterPanel単体テスト: onCaretChange が caretL で呼ばれる
    fireEvent.pointerDown(screen.getByText('←'))
    expect(field.onCaretChange).toHaveBeenCalledTimes(1)
    expect(field.caretPosRef.current).toBe(1)
    expect(spanBefore).toBeNull() // FooterPanelにはcaret spanがない(NumpadField側にある)
  })
})

describe('NumpadFooterPanel: カーソル編集モデル (SPEC-NUMPAD-CARET-EDIT-4COL-01)', () => {
  beforeEach(() => { window.__USE_CUSTOM_NUMPAD__ = true })
  afterEach(() => { delete window.__USE_CUSTOM_NUMPAD__ })

  function makeField(value) {
    const caretPosRef = { current: String(value ?? '').length }
    const onChange = vi.fn()
    return {
      field: {
        valueRef: { current: String(value ?? '') },
        caretPosRef,
        inputRef: { current: null },
        onChange,
        allowDecimal: false,
        max: 99999,
        freshRef: { current: false },
        dataTabindex: 1,
        label: 'IN',
      },
      onChange,
      caretPosRef,
    }
  }

  it('when_4列レイアウト_should_bs/c/ret/caretL/caretRキー全て描画', () => {
    const { field } = makeField('1')
    render(<NumpadFooterPanel currentField={field} />)
    expect(screen.getByText('⌫')).toBeTruthy()
    expect(screen.getByText('C')).toBeTruthy()
    expect(screen.getByText('⏎')).toBeTruthy()
    expect(screen.getByText('←')).toBeTruthy()
    expect(screen.getByText('→')).toBeTruthy()
  })

  it('when_中間caret_数字キー_should_caret位置に挿入', () => {
    const { field, onChange, caretPosRef } = makeField('33')
    caretPosRef.current = 0
    render(<NumpadFooterPanel currentField={field} />)
    fireEvent.pointerDown(screen.getByText('5'))
    expect(onChange).toHaveBeenCalledWith('533')
    expect(caretPosRef.current).toBe(1)
  })

  it('when_末尾caret_数字キー_should_末尾に追加', () => {
    const { field, onChange, caretPosRef } = makeField('12')
    render(<NumpadFooterPanel currentField={field} />)
    fireEvent.pointerDown(screen.getByText('3'))
    expect(onChange).toHaveBeenCalledWith('123')
    expect(caretPosRef.current).toBe(3)
  })

  it('when_中間caret_bs_should_caret左を削除してcaret--', () => {
    const { field, onChange, caretPosRef } = makeField('123')
    caretPosRef.current = 2
    render(<NumpadFooterPanel currentField={field} />)
    fireEvent.pointerDown(screen.getByText('⌫'))
    expect(onChange).toHaveBeenCalledWith('13')
    expect(caretPosRef.current).toBe(1)
  })

  it('when_caret=0でbs_should_onChangeしない', () => {
    const { field, onChange, caretPosRef } = makeField('12')
    caretPosRef.current = 0
    render(<NumpadFooterPanel currentField={field} />)
    fireEvent.pointerDown(screen.getByText('⌫'))
    expect(onChange).not.toHaveBeenCalled()
    expect(caretPosRef.current).toBe(0)
  })

  it('when_c_should_全クリア+caret=0', () => {
    const { field, onChange, caretPosRef } = makeField('999')
    render(<NumpadFooterPanel currentField={field} />)
    fireEvent.pointerDown(screen.getByText('C'))
    expect(onChange).toHaveBeenCalledWith('')
    expect(caretPosRef.current).toBe(0)
  })

  it('when_caretL_should_caret左移動(下限0でクランプ)', () => {
    const { field, onChange, caretPosRef } = makeField('12')
    caretPosRef.current = 1
    render(<NumpadFooterPanel currentField={field} />)
    fireEvent.pointerDown(screen.getByText('←'))
    expect(caretPosRef.current).toBe(0)
    expect(onChange).not.toHaveBeenCalled()
    // 下限クランプ
    fireEvent.pointerDown(screen.getByText('←'))
    expect(caretPosRef.current).toBe(0)
  })

  it('when_caretR_should_caret右移動(上限value.lengthでクランプ)', () => {
    const { field, onChange, caretPosRef } = makeField('12')
    caretPosRef.current = 0
    render(<NumpadFooterPanel currentField={field} />)
    fireEvent.pointerDown(screen.getByText('→'))
    expect(caretPosRef.current).toBe(1)
    expect(onChange).not.toHaveBeenCalled()
    // 上限クランプ(value='12'のlength=2)
    fireEvent.pointerDown(screen.getByText('→'))
    expect(caretPosRef.current).toBe(2)
    fireEvent.pointerDown(screen.getByText('→'))
    expect(caretPosRef.current).toBe(2)
  })

  it('when_max超過挿入_should_onChangeしない', () => {
    const { field, onChange } = makeField('99999')
    render(<NumpadFooterPanel currentField={field} />)
    fireEvent.pointerDown(screen.getByText('1'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('when_fresh_数字キー_should_既存値クリアして挿入', () => {
    const { field, onChange, caretPosRef } = makeField('999')
    field.freshRef.current = true
    render(<NumpadFooterPanel currentField={field} />)
    fireEvent.pointerDown(screen.getByText('5'))
    expect(onChange).toHaveBeenCalledWith('5')
    expect(caretPosRef.current).toBe(1)
  })
})
