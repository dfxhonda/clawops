// @vitest-environment happy-dom
// SPEC-PWA-SW-UPDATE-FIX-A-01 (D-109): 控えめトースト常駐バナー。表示→タップで applyUpdate、自動reloadなし。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const applyMock = vi.fn()
const subState = { cb: null }
vi.mock('../../lib/swRegistration', () => ({
  subscribeNeedRefresh: (cb) => { subState.cb = cb; cb(false); return () => { subState.cb = null } },
  applyUpdate: () => applyMock(),
}))

import SwUpdateBanner from '../../shared/ui/SwUpdateBanner'

beforeEach(() => { applyMock.mockReset(); subState.cb = null })

describe('AC2/AC3/AC4: バナー表示とタップ適用 (自動reloadなし)', () => {
  it('更新なし(初期)は非表示', () => {
    render(<SwUpdateBanner />)
    expect(screen.queryByTestId('sw-update-banner')).toBeNull()
    expect(applyMock).not.toHaveBeenCalled() // 自動適用しない
  })

  it('更新ありフラグで常駐バナー表示、タップで applyUpdate を1回だけ (=updateSW(true))', () => {
    render(<SwUpdateBanner />)
    // waiting検知 → フラグ true
    act(() => subState.cb(true))
    const banner = screen.getByTestId('sw-update-banner')
    expect(banner).toBeTruthy()
    expect(banner.textContent).toContain('タップ')
    // 表示された時点では reload していない (安全: 入力中でも自動適用しない)
    expect(applyMock).not.toHaveBeenCalled()
    // 明示タップで初めて適用
    fireEvent.click(banner)
    expect(applyMock).toHaveBeenCalledTimes(1)
  })
})

describe('AC1: vite.config workbox から skipWaiting/clientsClaim 除去', () => {
  const vite = readFileSync(resolve(__dirname, '../../../vite.config.js'), 'utf-8')
  it('skipWaiting/clientsClaim の記述なし、registerType prompt 維持、precache系は残す', () => {
    expect(vite).not.toMatch(/^\s*skipWaiting:\s*true/m)
    expect(vite).not.toMatch(/^\s*clientsClaim:\s*true/m)
    expect(vite).toContain("registerType: 'prompt'")
    expect(vite).toContain('cleanupOutdatedCaches: true')
    expect(vite).toContain("globPatterns: ['**/*.{js,css,html}']")
  })
})
