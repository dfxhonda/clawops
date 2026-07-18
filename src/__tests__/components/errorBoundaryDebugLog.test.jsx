// @vitest-environment happy-dom
// SPEC-DEBUG-LOGS-WIRING-AND-CRASH-RESEARCH-01 (D-092) AC1/AC3:
// ErrorBoundary が React クラッシュを catch → debug_logs へ (logDebug) + 黒画面でも fallback UI (再読み込み)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const logDebugSpy = vi.fn(() => Promise.resolve())
vi.mock('../../lib/debugLog', () => ({ logDebug: (...a) => logDebugSpy(...a) }))
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

import ErrorBoundary from '../../components/ErrorBoundary'

function Boom() { throw new Error('render boom') }

beforeEach(() => { logDebugSpy.mockClear(); logDebugSpy.mockResolvedValue(undefined) })

describe('AC1/AC3: ErrorBoundary → debug_logs + fallback UI', () => {
  it('AC1: クラッシュを catch → logDebug(tag=react-crash) を呼ぶ', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<MemoryRouter><ErrorBoundary><Boom /></ErrorBoundary></MemoryRouter>)
    expect(logDebugSpy).toHaveBeenCalledTimes(1)
    const arg = logDebugSpy.mock.calls[0][0]
    expect(arg.tag).toBe('react-crash')
    expect(arg.level).toBe('error')
    expect(arg.message).toBe('render boom')
    expect(arg.payload.componentStack).toBeTruthy()
    spy.mockRestore()
  })

  it('AC1: fallback UI に「再読み込み」ボタンが出る', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<MemoryRouter><ErrorBoundary><Boom /></ErrorBoundary></MemoryRouter>)
    expect(screen.getByTestId('fallback-reload')).toBeTruthy()
    expect(screen.getByText('再読み込み')).toBeTruthy()
    spy.mockRestore()
  })

  it('AC3: logDebug が reject/throw しても二次クラッシュせず fallback UI が出る', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logDebugSpy.mockImplementationOnce(() => { throw new Error('log failed') })
    expect(() =>
      render(<MemoryRouter><ErrorBoundary><Boom /></ErrorBoundary></MemoryRouter>),
    ).not.toThrow()
    expect(screen.getByTestId('fallback-reload')).toBeTruthy()
    spy.mockRestore()
  })
})
