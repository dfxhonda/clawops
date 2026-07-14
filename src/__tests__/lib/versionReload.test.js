// @vitest-environment node
// SPEC-PWA-LOGIN-VERSIONJSON-RELOAD-02 (D-062): checkVersionAndReload の依存注入テスト。
import { describe, it, expect, vi } from 'vitest'
import { checkVersionAndReload } from '../../lib/versionReload'

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: vi.fn(k => (map.has(k) ? map.get(k) : null)),
    setItem: vi.fn((k, v) => map.set(k, String(v))),
    removeItem: vi.fn(k => map.delete(k)),
    _map: map,
  }
}

const okFetch = sha => vi.fn(async () => ({ json: async () => ({ sha }) }))

function baseDeps(overrides = {}) {
  return {
    fetchImpl: okFetch('serverSHA'),
    storage: makeStorage(),
    reload: vi.fn(),
    getRegistration: vi.fn(async () => ({ update: vi.fn(async () => {}) })),
    currentSha: 'localSHA',
    waitForController: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('checkVersionAndReload (D-062)', () => {
  it('AC1: sha match -> no-op, no reload, guard key cleaned', async () => {
    const storage = makeStorage({ 'pwa-vreload:serverSHA': '1' })
    const deps = baseDeps({ fetchImpl: okFetch('serverSHA'), currentSha: 'serverSHA', storage })
    const r = await checkVersionAndReload(deps)
    expect(r).toBe('match')
    expect(deps.reload).not.toHaveBeenCalled()
    expect(storage.removeItem).toHaveBeenCalledWith('pwa-vreload:serverSHA')
  })

  it('AC1: sha mismatch -> reload once + guard set', async () => {
    const deps = baseDeps()
    const r = await checkVersionAndReload(deps)
    expect(r).toBe('reloaded')
    expect(deps.reload).toHaveBeenCalledTimes(1)
    expect(deps.storage.setItem).toHaveBeenCalledWith('pwa-vreload:serverSHA', '1')
  })

  it('AC1: same sha second time is guarded -> no reload', async () => {
    const storage = makeStorage({ 'pwa-vreload:serverSHA': '1' })
    const deps = baseDeps({ storage })
    const r = await checkVersionAndReload(deps)
    expect(r).toBe('guarded')
    expect(deps.reload).not.toHaveBeenCalled()
  })

  it('AC1: fetch failure -> error, no reload (offline safe)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deps = baseDeps({ fetchImpl: vi.fn(async () => { throw new Error('offline') }) })
    const r = await checkVersionAndReload(deps)
    expect(r).toBe('error')
    expect(deps.reload).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('AC1: missing sha in version.json -> error, no reload', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deps = baseDeps({ fetchImpl: vi.fn(async () => ({ json: async () => ({}) })) })
    const r = await checkVersionAndReload(deps)
    expect(r).toBe('error')
    expect(deps.reload).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('AC1: controllerchange never arrives -> still reloads after the wait resolves', async () => {
    // waitForController は timeout/controllerchange どちらでも resolve する。ここでは未着=timeout を模擬。
    const waitForController = vi.fn(async () => {})
    const deps = baseDeps({ waitForController })
    const r = await checkVersionAndReload(deps)
    expect(waitForController).toHaveBeenCalledTimes(1)
    expect(deps.reload).toHaveBeenCalledTimes(1)
    expect(r).toBe('reloaded')
  })

  it('AC1: registration.update rejection is swallowed, reload still fires', async () => {
    const deps = baseDeps({ getRegistration: vi.fn(async () => ({ update: vi.fn(async () => { throw new Error('sw') }) })) })
    const r = await checkVersionAndReload(deps)
    expect(r).toBe('reloaded')
    expect(deps.reload).toHaveBeenCalledTimes(1)
  })

  it('returns error when storage/fetch unavailable', async () => {
    const r = await checkVersionAndReload({ fetchImpl: undefined, storage: undefined })
    expect(r).toBe('error')
  })
})
