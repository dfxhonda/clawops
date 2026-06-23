// @vitest-environment happy-dom
// SPEC-PWA-SW-CONTROLLERCHANGE-RELOAD-01: PwaUpdateBanner
// AC2: onNeedRefresh → バナー表示
// AC4: [更新]タップ → updateSW()呼び出し
// AC5: バナー表示だけで勝手にリロードしない
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ updateSW: vi.fn() }))

vi.mock('../../lib/swRegistration', () => ({
  updateSW: mocks.updateSW,
}))

import PwaUpdateBanner from '../../components/PwaUpdateBanner'

beforeEach(() => mocks.updateSW.mockClear())

describe('PwaUpdateBanner (SPEC-PWA-SW-CONTROLLERCHANGE-RELOAD-01)', () => {
  it('when_mounted_without_event_should_not_show_banner', () => {
    render(<PwaUpdateBanner />)
    expect(screen.queryByTestId('pwa-update-banner')).toBeNull()
  })

  it('AC3: when_pwa_need_refresh_event_fires_should_show_banner', () => {
    render(<PwaUpdateBanner />)
    act(() => window.dispatchEvent(new CustomEvent('pwa-need-refresh')))
    expect(screen.getByTestId('pwa-update-banner')).toBeTruthy()
    expect(screen.getByTestId('pwa-update-button')).toBeTruthy()
  })

  it('AC4: when_update_button_clicked_should_call_updateSW', () => {
    render(<PwaUpdateBanner />)
    act(() => window.dispatchEvent(new CustomEvent('pwa-need-refresh')))
    fireEvent.click(screen.getByTestId('pwa-update-button'))
    expect(mocks.updateSW).toHaveBeenCalledOnce()
  })

  it('AC5: when_banner_shown_should_not_auto_reload', () => {
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      configurable: true,
    })
    render(<PwaUpdateBanner />)
    act(() => window.dispatchEvent(new CustomEvent('pwa-need-refresh')))
    expect(reloadMock).not.toHaveBeenCalled()
  })
})
