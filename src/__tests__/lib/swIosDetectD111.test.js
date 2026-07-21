// @vitest-environment happy-dom
// SPEC-PWA-SW-IOS-DETECT-FIX-01 (D-111): iOS の updatefound/onNeedRefresh 取りこぼし対策=registration.waiting 実在チェック。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const captured = vi.hoisted(() => ({ opts: {} }))
vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn((opts) => { captured.opts = opts || {}; return vi.fn() }),
}))

import { getNeedRefresh, createUpdateChecker, __resetNeedRefreshForTest } from '../../lib/swRegistration'

beforeEach(() => __resetNeedRefreshForTest())

const flush = async () => { await Promise.resolve(); await Promise.resolve() }

describe('AC1: onRegisteredSW 起動時 waiting 実在チェック', () => {
  it('registration.waiting あり → markNeedRefresh (needRefresh true, イベントを待たない)', () => {
    expect(getNeedRefresh()).toBe(false)
    captured.opts.onRegisteredSW('url', { waiting: {}, update: vi.fn(() => Promise.resolve()) })
    expect(getNeedRefresh()).toBe(true)
  })
  it('registration が無ければ何もしない (クラッシュしない)', () => {
    expect(() => captured.opts.onRegisteredSW('url', null)).not.toThrow()
    expect(getNeedRefresh()).toBe(false)
  })
})

describe('AC2: onRegisteredSW 起動時 update() 即実行 (KILL再起動の初回チェック)', () => {
  it('registration.update() が1回呼ばれる', () => {
    const update = vi.fn(() => Promise.resolve())
    captured.opts.onRegisteredSW('url', { waiting: null, update })
    expect(update).toHaveBeenCalledTimes(1)
  })
  it('起動時 update() 解決後 waiting が現れたら markNeedRefresh', async () => {
    const reg = { waiting: null, update: vi.fn(() => Promise.resolve()) }
    captured.opts.onRegisteredSW('url', reg)
    expect(getNeedRefresh()).toBe(false)
    reg.waiting = {} // update 中に waiting 化
    await flush()
    expect(getNeedRefresh()).toBe(true)
  })
})

describe('AC3: createUpdateChecker update() 後 waiting ポーリング', () => {
  it('update() 解決後 waiting あり → markNeedRefresh', async () => {
    const reg = { waiting: {}, update: vi.fn(() => Promise.resolve()) }
    const check = createUpdateChecker(reg, () => 1_000_000)
    expect(getNeedRefresh()).toBe(false)
    check()
    await flush()
    expect(getNeedRefresh()).toBe(true)
  })
  it('waiting なし → needRefresh false のまま (誤発火なし)', async () => {
    const reg = { waiting: null, update: vi.fn(() => Promise.resolve()) }
    createUpdateChecker(reg, () => 2_000_000)()
    await flush()
    expect(getNeedRefresh()).toBe(false)
  })
  it('update() reject でも needRefresh false + throw しない (silent)', async () => {
    const reg = { waiting: {}, update: vi.fn(() => Promise.reject(new Error('offline'))) }
    createUpdateChecker(reg, () => 3_000_000)()
    await flush()
    expect(getNeedRefresh()).toBe(false)
  })
})

describe('AC5: onNeedRefresh イベント保険維持 (非iOS用)', () => {
  it('onNeedRefresh() も markNeedRefresh を叩く', () => {
    expect(getNeedRefresh()).toBe(false)
    captured.opts.onNeedRefresh()
    expect(getNeedRefresh()).toBe(true)
  })
})

describe('AC6: 自動reload / 自動updateSW(true) が検知経路に無い', () => {
  const src = readFileSync(resolve(__dirname, '../../lib/swRegistration.js'), 'utf-8')
  it('updateSW(true) は applyUpdate(明示タップ経路)に存在する', () => {
    const apply = src.match(/export function applyUpdate\s*\(\)\s*\{[\s\S]*?\n\}/)[0]
    expect(apply).toMatch(/updateSW\s*\(\s*true\s*\)/)
  })
  it('createUpdateChecker / onRegisteredSW 内に updateSW(true) も location.reload も無い', () => {
    const checker = src.match(/export function createUpdateChecker[\s\S]*?\n\}/)[0]
    const onReg = src.match(/onRegisteredSW\([^)]*\)\s*\{[\s\S]*?\n {2}\},/)[0]
    for (const body of [checker, onReg]) {
      expect(body).not.toMatch(/updateSW\s*\(\s*true\s*\)/)
      expect(body).not.toMatch(/location\.reload/)
    }
  })
})

describe('AC4: updateViaCache:none 相当 (vercel.json /sw.js no-cache + vite.config 明記)', () => {
  it('vercel.json /sw.js が no-cache (SWスクリプトは常に再検証=stale配信なし)', () => {
    const vercel = readFileSync(resolve(__dirname, '../../../vercel.json'), 'utf-8')
    expect(vercel).toMatch(/"\/sw\.js"[\s\S]*?no-cache/)
  })
  it('vite.config が updateViaCache の resolution を明記 (プラグイン注入不能→vercel等価)', () => {
    const vite = readFileSync(resolve(__dirname, '../../../vite.config.js'), 'utf-8')
    expect(vite).toContain('updateViaCache')
  })
})
