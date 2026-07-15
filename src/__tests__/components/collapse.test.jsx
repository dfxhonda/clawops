// @vitest-environment happy-dom
// SPEC-MOTION-W1-COLLAPSE-AND-NUMPAD-01 (D-069) AC1: Collapse 部品。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import Collapse from '../../components/Collapse'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function stubReducedMotion(matches) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
}

describe('AC1: Collapse', () => {
  it('open=true → grid-template-rows 1fr、閉じ属性なし', () => {
    stubReducedMotion(false)
    const { getByTestId } = render(<Collapse open testId="c"><div data-testid="child">x</div></Collapse>)
    expect(getByTestId('c').style.gridTemplateRows).toBe('1fr')
    const inner = getByTestId('c-inner')
    expect(inner.hasAttribute('inert')).toBe(false)
    expect(inner.getAttribute('aria-hidden')).toBeNull()
  })

  it('open=false → grid-template-rows 0fr、inert + aria-hidden (フォーカス到達不可)', () => {
    stubReducedMotion(false)
    const { getByTestId } = render(<Collapse open={false} testId="c"><div data-testid="child">x</div></Collapse>)
    expect(getByTestId('c').style.gridTemplateRows).toBe('0fr')
    const inner = getByTestId('c-inner')
    expect(inner.hasAttribute('inert')).toBe(true)
    expect(inner.getAttribute('aria-hidden')).toBe('true')
  })

  it('children は open に関わらず常時 mount', () => {
    stubReducedMotion(false)
    const closed = render(<Collapse open={false} testId="c"><div data-testid="child">x</div></Collapse>)
    expect(closed.getByTestId('child')).toBeTruthy() // 閉じていても DOM に存在
  })

  it('reduced-motion 時は transition none', () => {
    stubReducedMotion(true)
    const { getByTestId } = render(<Collapse open testId="c"><div>x</div></Collapse>)
    expect(getByTestId('c').style.transition).toBe('none')
  })

  it('通常時は grid-template-rows の transition (200ms ease-out)', () => {
    stubReducedMotion(false)
    const { getByTestId } = render(<Collapse open testId="c"><div>x</div></Collapse>)
    expect(getByTestId('c').style.transition).toContain('grid-template-rows')
    expect(getByTestId('c').style.transition).toContain('200ms')
  })
})
