// @vitest-environment happy-dom
// NumpadField (alwaysOpen カスタムテンキー) のキー入力ロジック
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import NumpadField from './NumpadField'

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

describe('NumpadField alwaysOpen キーパッド', () => {
  it('when_数字キー_should_末尾に追加してonChange', () => {
    const { onChange, key } = renderPad({ value: '12' })
    key('3')
    expect(onChange).toHaveBeenCalledWith('123')
    cleanup()
  })

  it('when_バックスペース_should_末尾1文字削除', () => {
    const { onChange, key } = renderPad({ value: '120' })
    key('⌫')
    expect(onChange).toHaveBeenCalledWith('12')
    cleanup()
  })

  it('when_→キー_should_onNextを呼ぶ', () => {
    const { onNext, key } = renderPad({ value: '5' })
    key('→')
    expect(onNext).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('when_max超過入力_should_onChangeしない', () => {
    const { onChange, key } = renderPad({ value: '99999', max: 99999 })
    key('9') // 999999 > 99999
    expect(onChange).not.toHaveBeenCalled()
    cleanup()
  })

  it('when_空からの数字_should_その数字になる', () => {
    const { onChange, key } = renderPad({ value: '' })
    key('7')
    expect(onChange).toHaveBeenCalledWith('7')
    cleanup()
  })
})
