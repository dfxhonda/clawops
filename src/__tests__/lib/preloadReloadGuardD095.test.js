// SPEC-PWA-SW-AUTOUPDATE-KILL-RELOAD-LOOP-01 (D-095): preloadError reload ガード + 自動reload経路の監査。
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { handlePreloadError, PRELOAD_RELOAD_KEY, PRELOAD_RELOAD_CAP } from '../../lib/preloadReloadGuard'

function makeStorage(initial = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  }
}

describe('AC2: handlePreloadError リトライ上限 + controllerchange待ち', () => {
  it('上限未満 → controllerchange 待ち後に reload + counter++', async () => {
    const storage = makeStorage()
    const order = []
    const reload = vi.fn(() => order.push('reload'))
    const waitForController = vi.fn(async () => { order.push('wait') })
    const r = await handlePreloadError({ storage, reload, waitForController, max: 3 })
    expect(r).toBe('reloaded')
    expect(reload).toHaveBeenCalledTimes(1)
    expect(storage.getItem(PRELOAD_RELOAD_KEY)).toBe('1')
    // controllerchange を待ってから reload
    expect(order).toEqual(['wait', 'reload'])
    expect(waitForController).toHaveBeenCalled()
  })

  it('上限到達 → reload せず warn のみ (無限reload 防止)', async () => {
    const storage = makeStorage({ [PRELOAD_RELOAD_KEY]: '3' })
    const reload = vi.fn()
    const warn = vi.fn()
    const r = await handlePreloadError({ storage, reload, warn, max: 3, waitForController: vi.fn() })
    expect(r).toBe('capped')
    expect(reload).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })

  it('cap 回 reload したら次は停止する (3→停止)', async () => {
    const storage = makeStorage()
    const reload = vi.fn()
    for (let i = 0; i < PRELOAD_RELOAD_CAP; i++) {
      await handlePreloadError({ storage, reload, waitForController: vi.fn(), max: PRELOAD_RELOAD_CAP })
    }
    expect(reload).toHaveBeenCalledTimes(PRELOAD_RELOAD_CAP)
    const r = await handlePreloadError({ storage, reload, warn: vi.fn(), waitForController: vi.fn(), max: PRELOAD_RELOAD_CAP })
    expect(r).toBe('capped')
    expect(reload).toHaveBeenCalledTimes(PRELOAD_RELOAD_CAP) // 上限超過は reload しない
  })

  it('waitForController 未指定でも reload する (依存注入デフォルト)', async () => {
    const storage = makeStorage()
    const reload = vi.fn()
    const r = await handlePreloadError({ storage, reload })
    expect(r).toBe('reloaded')
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('AC3/AC5: 自動reload経路の監査 (grep)', () => {
  const swSrc = readFileSync(resolve(__dirname, '../../lib/swRegistration.js'), 'utf-8')
  const mainSrc = readFileSync(resolve(__dirname, '../../main.jsx'), 'utf-8')

  it('AC3(D-109更新): onNeedRefresh は自動reloadせず、updateSW(true) は applyUpdate(明示タップ)のみ', () => {
    expect(swSrc).toContain('onNeedRefresh')
    expect(swSrc).not.toMatch(/location\.reload/) // 手動 reload 直呼びは無し
    // D-109: updateSW(true) は存在するが applyUpdate 内 (バナー明示タップ経路) のみ。onNeedRefresh 本体は撃たない。
    expect(swSrc).toContain('export function applyUpdate')
    const m = swSrc.match(/onNeedRefresh\s*\(\)\s*\{([\s\S]*?)\}/)
    expect(m).toBeTruthy()
    expect(m[1]).toContain('markNeedRefresh')          // フラグを立てるだけ
    expect(m[1]).not.toMatch(/updateSW\s*\(\s*true\s*\)/) // 自動適用しない
  })

  it('AC2/AC5: main.jsx の preloadError が handlePreloadError 経由 (生 location.reload 直呼び廃止)', () => {
    expect(mainSrc).toContain('handlePreloadError')
    expect(mainSrc).toContain("addEventListener('vite:preloadError'")
    // 生 reload の直呼びが preloadError ハンドラに残っていない
    expect(mainSrc).not.toContain("sessionStorage.setItem('chunk-reload'")
    expect(mainSrc).not.toMatch(/vite:preloadError[\s\S]{0,160}window\.location\.reload/)
  })

  it('AC1(D-109更新): registerType prompt 維持 + skipWaiting/clientsClaim 除去、precache系は保全', () => {
    const viteSrc = readFileSync(resolve(__dirname, '../../../vite.config.js'), 'utf-8')
    expect(viteSrc).toContain("registerType: 'prompt'")
    expect(viteSrc).not.toContain("registerType: 'autoUpdate'")
    // D-109: 層3 skipWaiting/clientsClaim を workbox オプションから除去 (行頭のオプション記述が無いこと。コメント言及は可)
    expect(viteSrc).not.toMatch(/^\s*skipWaiting:\s*true/m)
    expect(viteSrc).not.toMatch(/^\s*clientsClaim:\s*true/m)
    // precache/フォールバック系は保全
    expect(viteSrc).toContain('cleanupOutdatedCaches: true')
    expect(viteSrc).toContain("navigateFallback: '/index.html'")
  })
})
