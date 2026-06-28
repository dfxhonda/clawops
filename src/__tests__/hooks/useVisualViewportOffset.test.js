// @vitest-environment happy-dom
// SPEC-IOS-KEYBOARD-VIEWPORT-ANCHOR-FIX-01
// AC4: visualViewport不在で offsetTop=0、例外なし
// AC6: unmount時にリスナー解除済み
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVisualViewportOffset } from '../../hooks/useVisualViewportOffset'

let originalVisualViewport

beforeEach(() => {
  originalVisualViewport = window.visualViewport
})

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', {
    value: originalVisualViewport,
    configurable: true,
    writable: true,
  })
})

describe('useVisualViewportOffset: visualViewport不在(AC4)', () => {
  it('when_visualViewport_absent_should_return_0_without_error', () => {
    Object.defineProperty(window, 'visualViewport', { value: null, configurable: true, writable: true })
    const { result } = renderHook(() => useVisualViewportOffset())
    expect(result.current).toBe(0)
  })
})

describe('useVisualViewportOffset: 購読・更新・解除', () => {
  it('when_visualViewport_present_should_subscribe_to_scroll_and_resize', () => {
    const vv = {
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true, writable: true })
    renderHook(() => useVisualViewportOffset())
    expect(vv.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(vv.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('when_scroll_fires_should_update_offsetTop', () => {
    const listeners = {}
    let currentOffsetTop = 0
    const vv = {
      get offsetTop() { return currentOffsetTop },
      addEventListener: vi.fn((type, fn) => { listeners[type] = fn }),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true, writable: true })

    const { result } = renderHook(() => useVisualViewportOffset())
    expect(result.current).toBe(0)

    act(() => {
      currentOffsetTop = 80
      listeners['scroll']?.()
    })
    expect(result.current).toBe(80)
  })

  it('when_resize_fires_should_update_offsetTop', () => {
    const listeners = {}
    let currentOffsetTop = 0
    const vv = {
      get offsetTop() { return currentOffsetTop },
      addEventListener: vi.fn((type, fn) => { listeners[type] = fn }),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true, writable: true })

    const { result } = renderHook(() => useVisualViewportOffset())

    act(() => {
      currentOffsetTop = 120
      listeners['resize']?.()
    })
    expect(result.current).toBe(120)
  })

  it('when_kb_closes_should_return_to_0', () => {
    const listeners = {}
    let currentOffsetTop = 0
    const vv = {
      get offsetTop() { return currentOffsetTop },
      addEventListener: vi.fn((type, fn) => { listeners[type] = fn }),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true, writable: true })

    const { result } = renderHook(() => useVisualViewportOffset())

    act(() => {
      currentOffsetTop = 100
      listeners['scroll']?.()
    })
    expect(result.current).toBe(100)

    act(() => {
      currentOffsetTop = 0
      listeners['scroll']?.()
    })
    expect(result.current).toBe(0)
  })

  it('when_unmounted_should_remove_both_listeners', () => {
    let capturedScroll, capturedResize
    const vv = {
      offsetTop: 0,
      addEventListener: vi.fn((type, fn) => {
        if (type === 'scroll') capturedScroll = fn
        if (type === 'resize') capturedResize = fn
      }),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true, writable: true })

    const { unmount } = renderHook(() => useVisualViewportOffset())
    unmount()

    expect(vv.removeEventListener).toHaveBeenCalledWith('scroll', capturedScroll)
    expect(vv.removeEventListener).toHaveBeenCalledWith('resize', capturedResize)
  })
})
