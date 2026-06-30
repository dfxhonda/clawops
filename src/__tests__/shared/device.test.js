// device: isIPhone UA check
import { describe, it, expect, afterEach, vi } from 'vitest'
import { isIPhone } from '../../shared/lib/device'

describe('isIPhone', () => {
  it('when_userAgent_is_iPhone_should_return_true', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      configurable: true,
    })
    expect(isIPhone()).toBe(true)
  })

  it('when_userAgent_is_desktop_should_return_false', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true,
    })
    expect(isIPhone()).toBe(false)
  })
})
