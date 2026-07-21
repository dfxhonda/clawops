// @vitest-environment happy-dom
// SPEC-PWA-SW-UPDATE-REDUCTION-01 (D-112): 更新4層を減築。層D(Login version-reload)撤去 + statechange購読追加 + 冪等ガード。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const captured = vi.hoisted(() => ({ opts: {} }))
vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn((opts) => { captured.opts = opts || {}; return vi.fn() }),
}))

import { getNeedRefresh, subscribeNeedRefresh, watchInstalling, __resetNeedRefreshForTest } from '../../lib/swRegistration'

function setController(present) {
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    value: { controller: present ? {} : null }, configurable: true, writable: true,
  })
}
function makeSW(state) {
  const cbs = []
  return { state, addEventListener: (ev, cb) => { if (ev === 'statechange') cbs.push(cb) }, fire() { cbs.forEach(cb => cb()) } }
}
function makeReg({ installing = null, waiting = null } = {}) {
  const uf = []
  return { installing, waiting, addEventListener: (ev, cb) => { if (ev === 'updatefound') uf.push(cb) }, fireUpdatefound() { uf.forEach(cb => cb()) } }
}

beforeEach(() => { __resetNeedRefreshForTest(); setController(true) })

describe('AC2: installing→installed statechange 購読で waiting 検知→markNeedRefresh', () => {
  it('取得時 installing 中の worker が installed 化 + waiting → 発火', () => {
    const sw = makeSW('installing')
    const reg = makeReg({ installing: sw })
    watchInstalling(reg)
    expect(getNeedRefresh()).toBe(false)
    sw.state = 'installed'
    reg.waiting = sw
    sw.fire()
    expect(getNeedRefresh()).toBe(true)
  })

  it('updatefound で後から現れた installing worker も購読される', () => {
    const reg = makeReg({ installing: null })
    watchInstalling(reg)
    const sw = makeSW('installing')
    reg.installing = sw
    reg.fireUpdatefound()
    sw.state = 'installed'; reg.waiting = sw; sw.fire()
    expect(getNeedRefresh()).toBe(true)
  })

  it('初回インストール(controller無し)では発火しない (更新のみ)', () => {
    setController(false)
    const sw = makeSW('installing')
    const reg = makeReg({ installing: sw, waiting: sw })
    watchInstalling(reg)
    sw.state = 'installed'; sw.fire()
    expect(getNeedRefresh()).toBe(false)
  })

  it('installed だが waiting 不在なら発火しない', () => {
    const sw = makeSW('installing')
    const reg = makeReg({ installing: sw, waiting: null })
    watchInstalling(reg)
    sw.state = 'installed'; sw.fire()
    expect(getNeedRefresh()).toBe(false)
  })

  it('registration が無くても throw しない', () => {
    expect(() => watchInstalling(null)).not.toThrow()
  })
})

describe('AC6: markNeedRefresh 二重発火ガード (バナー一度)', () => {
  it('複数経路が叩いてもバナー通知は一度だけ', () => {
    const cb = vi.fn()
    subscribeNeedRefresh(cb) // 初回 false
    captured.opts.onNeedRefresh() // 1回目 → true 通知
    captured.opts.onNeedRefresh() // 2回目 → 冪等ガードで通知しない
    const trueNotifs = cb.mock.calls.filter(c => c[0] === true).length
    expect(trueNotifs).toBe(1)
    expect(getNeedRefresh()).toBe(true)
  })
})

describe('AC1: Login.jsx から層D(checkVersionAndReload)撤去', () => {
  const login = readFileSync(resolve(__dirname, '../../pages/Login.jsx'), 'utf-8')
  it('checkVersionAndReload の import も呼び出しも無い', () => {
    expect(login).not.toContain('checkVersionAndReload')
  })
})

describe('AC3/AC4/AC5: 自動reload経路ゼロ / defaultWaitForController温存 / vite.config PWA無変更', () => {
  it('AC3: swRegistration 検知経路に location.reload / 自動 updateSW(true) が無い', () => {
    const sw = readFileSync(resolve(__dirname, '../../lib/swRegistration.js'), 'utf-8')
    expect(sw).not.toMatch(/location\.reload/)
    const onReg = sw.match(/onRegisteredSW\([^)]*\)\s*\{[\s\S]*?\n {2}\},/)[0]
    const watch = sw.match(/export function watchInstalling[\s\S]*?\n\}/)[0]
    for (const body of [onReg, watch]) expect(body).not.toMatch(/updateSW\s*\(\s*true\s*\)/)
  })
  it('AC4: defaultWaitForController が main.jsx から import され preloadReloadGuard に渡る', () => {
    const main = readFileSync(resolve(__dirname, '../../main.jsx'), 'utf-8')
    expect(main).toContain("import { defaultWaitForController }")
    expect(main).toMatch(/handlePreloadError\(\{\s*waitForController:\s*defaultWaitForController/)
  })
  it('AC5: vite.config PWA部 prompt維持 + skipWaiting/clientsClaim不在', () => {
    const vite = readFileSync(resolve(__dirname, '../../../vite.config.js'), 'utf-8')
    expect(vite).toContain("registerType: 'prompt'")
    expect(vite).not.toMatch(/^\s*skipWaiting:\s*true/m)
    expect(vite).not.toMatch(/^\s*clientsClaim:\s*true/m)
  })
})
