// @vitest-environment happy-dom
// SPEC-IDLE-LOGOUT-SENTRY-AUTODETECT-01
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSentry = vi.hoisted(() => ({ addBreadcrumb: vi.fn(), captureMessage: vi.fn() }))
vi.mock('../../lib/sentry', () => ({ Sentry: mockSentry }))

import { markLogoutStart, markLogoutReplaced, reportInterrupt } from '../../lib/idleLogoutProbe'

beforeEach(() => {
  vi.resetAllMocks()         // clear calls + implementations
  markLogoutReplaced()       // reset logoutInFlight=false
  vi.clearAllMocks()         // clear the addBreadcrumb call from the reset above
})

describe('idleLogoutProbe (SPEC-IDLE-LOGOUT-SENTRY-AUTODETECT-01)', () => {
  it('when_markLogoutStart_then_reportInterrupt_RELOAD_should_captureMessage', () => {
    markLogoutStart()
    reportInterrupt('RELOAD')
    expect(mockSentry.captureMessage).toHaveBeenCalledWith(
      'IDLE-LOGOUT-ABORTED-BY-RELOAD',
      expect.objectContaining({
        level: 'error',
        tags: expect.objectContaining({ interrupt_source: 'RELOAD' }),
      })
    )
  })

  it('when_markLogoutStart_then_markLogoutReplaced_then_reportInterrupt_should_not_capture', () => {
    markLogoutStart()
    markLogoutReplaced()
    vi.clearAllMocks()
    reportInterrupt('RELOAD')
    expect(mockSentry.captureMessage).not.toHaveBeenCalled()
  })

  it('when_reportInterrupt_without_start_should_be_noop', () => {
    reportInterrupt('SWCHANGE')
    expect(mockSentry.captureMessage).not.toHaveBeenCalled()
  })

  it('when_markLogoutStart_then_reportInterrupt_twice_should_capture_only_once', () => {
    markLogoutStart()
    reportInterrupt('SWCHANGE')
    reportInterrupt('SWCHANGE')
    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('when_captureMessage_throws_should_not_propagate', () => {
    mockSentry.captureMessage.mockImplementationOnce(() => { throw new Error('Sentry error') })
    markLogoutStart()
    expect(() => reportInterrupt('RELOAD')).not.toThrow()
  })
})
