// @vitest-environment happy-dom
// SPEC-PWA-LOGIN-SW-UPDATE-01: version不一致時にupdateSW(true)でSW世代交代+reload
// SPEC-PWA-LOGIN-VERSION-RELOAD-01: login 成功 (verify-pin) or session 復元時に
// /version.json と BUILD_SHA を比較し、不一致なら session 中 1 回だけ reload。
// SPEC-LOGIN-VERSION-CHECK-SHA-FIX-01: 比較キーを buildNumber → sha に変更。
// loop guard: sessionStorage 'version_reload_done' (boolean flag、build 非依存)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// vite define を介さず buildInfo を直接 mock (useVersionCheck.shared.test.js と同パターン)。
// 本テスト中はクライアント BUILD_SHA = 'test-sha-abc' に固定。
vi.mock('../../lib/buildInfo', () => ({
  BUILD_NUMBER: '2000',
  BUILD_SHA: 'test-sha-abc',
  BUILD_VERSION: 'test',
  BUILD_TIME: '2026-06-02T00:00:00.000Z',
  buildLabel: () => 'build #2000',
}))

import { checkAndReloadIfStale } from '../../services/loginVersionCheck'

const STORAGE_KEY = 'version_reload_done'

function mockOkRes(body) {
  return { ok: true, status: 200, json: async () => body }
}

let warnSpy

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  sessionStorage.clear()
})

afterEach(() => {
  warnSpy?.mockRestore()
  vi.restoreAllMocks()
})

describe('checkAndReloadIfStale (SPEC-PWA-LOGIN-VERSION-RELOAD-01)', () => {
  // AC-01: 古いPWAでログイン成功時、自動で1回reloadされ最新ビルドになる。guardにSHA保存
  it('when_server_sha_differs_should_set_guard_sha_and_reload_once', async () => {
    const fetchFn = vi.fn(async () => mockOkRes({ sha: 'newer-sha-xyz' }))
    const reload = vi.fn()
    const r = await checkAndReloadIfStale({ fetch: fetchFn, reload })
    expect(r.reloaded).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('newer-sha-xyz')
  })

  // AC-02a: guardのSHAと同じSHAが返った場合=swap未完、重複reloadしない(無限loop防止)
  it('when_guard_sha_equals_server_sha_should_not_reload', async () => {
    sessionStorage.setItem(STORAGE_KEY, 'newer-sha-xyz')
    const fetchFn = vi.fn(async () => mockOkRes({ sha: 'newer-sha-xyz' }))
    const reload = vi.fn()
    const r = await checkAndReloadIfStale({ fetch: fetchFn, reload })
    expect(r.reloaded).toBe(false)
    expect(r.reason).toBe('already-reloaded')
    expect(reload).not.toHaveBeenCalled()
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  // AC-02b: guardのSHAと異なる新SHAが来た場合=新コミット、再reload実行
  it('when_guard_sha_differs_from_server_sha_should_reload_with_new_sha', async () => {
    sessionStorage.setItem(STORAGE_KEY, 'old-sha-111')
    const fetchFn = vi.fn(async () => mockOkRes({ sha: 'newer-sha-xyz' }))
    const reload = vi.fn()
    const r = await checkAndReloadIfStale({ fetch: fetchFn, reload })
    expect(r.reloaded).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('newer-sha-xyz')
  })

  // AC-03: /version.json fetch失敗時はreloadされずログイン処理が続行する
  it('when_fetch_throws_should_not_reload_and_log_warn', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('network') })
    const reload = vi.fn()
    const r = await checkAndReloadIfStale({ fetch: fetchFn, reload })
    expect(r.reloaded).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    expect(warnSpy.mock.calls[0][0]).toContain('ERR-PWA-LOGIN-VERSION')
  })

  it('when_fetch_returns_non_ok_should_not_reload_and_log_warn', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    const reload = vi.fn()
    const r = await checkAndReloadIfStale({ fetch: fetchFn, reload })
    expect(r.reloaded).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    expect(warnSpy.mock.calls[0][0]).toContain('ERR-PWA-LOGIN-VERSION')
  })

  // AC-04: SHA一致時はreloadされない
  it('when_server_sha_matches_should_not_reload', async () => {
    const fetchFn = vi.fn(async () => mockOkRes({ sha: 'test-sha-abc' })) // BUILD_SHA と一致
    const reload = vi.fn()
    const r = await checkAndReloadIfStale({ fetch: fetchFn, reload })
    expect(r.reloaded).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('fetch_url_includes_cache_busting_timestamp_and_no_store_and_abort_signal', async () => {
    const fetchFn = vi.fn(async () => mockOkRes({ sha: 'test-sha-abc' }))
    const reload = vi.fn()
    await checkAndReloadIfStale({ fetch: fetchFn, reload, now: () => 1700000000000 })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/version.json?t=1700000000000')
    expect(init.cache).toBe('no-store')
    expect(init.signal).toBeDefined()
  })

  // AC6: data.sha 不在で reason 'no-sha'、reload しない
  it('when_response_missing_sha_should_not_reload', async () => {
    const fetchFn = vi.fn(async () => mockOkRes({ buildNumber: '999' })) // sha key なし
    const reload = vi.fn()
    const r = await checkAndReloadIfStale({ fetch: fetchFn, reload })
    expect(r.reloaded).toBe(false)
    expect(r.reason).toBe('no-sha')
    expect(reload).not.toHaveBeenCalled()
  })

  // SPEC-PWA-LOGIN-SW-UPDATE-01: updateSW(true) が呼ばれる (AC-01)
  it('when_updateSW_provided_and_mismatch_should_call_updateSW_not_plain_reload', async () => {
    const fetchFn = vi.fn(async () => mockOkRes({ sha: 'newer-sha-xyz' }))
    const reload = vi.fn()
    const updateSW = vi.fn(async () => {})
    const r = await checkAndReloadIfStale({ fetch: fetchFn, reload, updateSW })
    expect(r.reloaded).toBe(true)
    expect(updateSW).toHaveBeenCalledWith(true)
    expect(reload).not.toHaveBeenCalled()
  })

  // SPEC-PWA-LOGIN-SW-UPDATE-01: updateSW 失敗時 fallback (AC-03)
  it('when_updateSW_throws_should_fallback_to_plain_reload', async () => {
    const fetchFn = vi.fn(async () => mockOkRes({ sha: 'newer-sha-xyz' }))
    const reload = vi.fn()
    const updateSW = vi.fn(async () => { throw new Error('SW failed') })
    const r = await checkAndReloadIfStale({ fetch: fetchFn, reload, updateSW })
    expect(r.reloaded).toBe(true)
    expect(updateSW).toHaveBeenCalledWith(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  // SPEC-PWA-LOGIN-SW-UPDATE-01: updateSW 未提供時は fallback reload (後方互換)
  it('when_updateSW_not_provided_and_mismatch_should_call_plain_reload', async () => {
    const fetchFn = vi.fn(async () => mockOkRes({ sha: 'newer-sha-xyz' }))
    const reload = vi.fn()
    const r = await checkAndReloadIfStale({ fetch: fetchFn, reload })
    expect(r.reloaded).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  // SPEC-PWA-SW-UPDATEWIRE-GUARD-CLEAR-01: AC3 match時はguardをremoveItem
  it('when_server_sha_matches_should_call_removeItem_on_guard', async () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(null), // guard未設定扱いで早期returnを回避
      setItem: vi.fn(),
      removeItem: vi.fn(),
    }
    const fetchFn = vi.fn(async () => mockOkRes({ sha: 'test-sha-abc' })) // BUILD_SHA と一致
    const r = await checkAndReloadIfStale({ fetch: fetchFn, getStorage: () => storage })
    expect(r.reason).toBe('match')
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY)
  })

  // SPEC-PWA-SW-UPDATEWIRE-GUARD-CLEAR-01: AC4 mismatch時はsetItem維持(ループ防止、値はSHA)
  it('when_server_sha_differs_should_setItem_guard_sha_and_not_removeItem', async () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    }
    const fetchFn = vi.fn(async () => mockOkRes({ sha: 'newer-sha-xyz' }))
    const reload = vi.fn()
    const r = await checkAndReloadIfStale({ fetch: fetchFn, reload, getStorage: () => storage })
    expect(r.reloaded).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'newer-sha-xyz')
    expect(storage.removeItem).not.toHaveBeenCalled()
  })

  it('when_fetch_exceeds_timeout_should_abort_and_not_reload', async () => {
    // signal abort で reject する偽 fetch を作成、timeoutMs 30ms で確実に発火
    const fetchFn = vi.fn((_url, init) => new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => {
        const err = new Error('aborted')
        err.name = 'AbortError'
        reject(err)
      })
    }))
    const reload = vi.fn()
    const r = await checkAndReloadIfStale({ fetch: fetchFn, reload, timeoutMs: 30 })
    expect(r.reloaded).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
  })
})

// SPEC-PWA-SW-UPDATE-CONTROLLERCHANGE-01 (AC7)
describe('checkAndReloadIfStale / controllerchange pattern (SPEC-PWA-SW-UPDATE-CONTROLLERCHANGE-01)', () => {
  // AC1: controllerchange発火 → reload 1回のみ
  it('when_swContainer_controllerchange_fires_should_reload_once', async () => {
    let ccListener = null
    const sw = {
      addEventListener: vi.fn((event, fn) => { if (event === 'controllerchange') ccListener = fn }),
      removeEventListener: vi.fn(),
    }
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ sha: 'newer-sha-xyz' }) }))
    const reload = vi.fn()
    const updateSW = vi.fn(async () => { ccListener?.() })  // controllerchange発火をシミュレート
    const r = await checkAndReloadIfStale({ fetch: fetchFn, reload, updateSW, swContainer: sw })
    expect(r.reloaded).toBe(true)
    expect(sw.addEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function), { once: true })
    expect(updateSW).toHaveBeenCalledWith(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  // AC2: updateSW(true)はトリガーとして呼ばれる(reloadはcontrollerchangeに委ねる)
  it('when_swContainer_updateSW_should_be_called_with_true_as_trigger', async () => {
    let ccListener = null
    const sw = {
      addEventListener: vi.fn((event, fn) => { if (event === 'controllerchange') ccListener = fn }),
      removeEventListener: vi.fn(),
    }
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ sha: 'newer-sha-xyz' }) }))
    const reload = vi.fn()
    const updateSW = vi.fn(async () => { ccListener?.() })
    await checkAndReloadIfStale({ fetch: fetchFn, reload, updateSW, swContainer: sw })
    expect(updateSW).toHaveBeenCalledWith(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  // AC1 二重防止: controllerchangeが2回呼ばれてもreloadは1回のみ(refreshingフラグ)
  it('when_swContainer_controllerchange_fires_twice_should_reload_only_once', async () => {
    let ccListener = null
    const sw = {
      addEventListener: vi.fn((event, fn) => { if (event === 'controllerchange') ccListener = fn }),
      removeEventListener: vi.fn(),
    }
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ sha: 'newer-sha-xyz' }) }))
    const reload = vi.fn()
    const updateSW = vi.fn(async () => {
      ccListener?.()  // 1回目
      ccListener?.()  // 2回目(refreshingフラグで防止)
    })
    await checkAndReloadIfStale({ fetch: fetchFn, reload, updateSW, swContainer: sw })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  // AC3: controllerchangeが来ない場合はtimeout後にfallbackReload
  it('when_swContainer_controllerchange_does_not_fire_should_fallback_after_timeout', async () => {
    vi.useFakeTimers()
    try {
      const sw = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
      const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ sha: 'newer-sha-xyz' }) }))
      const reload = vi.fn()
      const updateSW = vi.fn(async () => {})  // controllerchangeを発火しない
      const promise = checkAndReloadIfStale({
        fetch: fetchFn, reload, updateSW, swContainer: sw, reloadTimeoutMs: 50,
      })
      await vi.runAllTimersAsync()
      const r = await promise
      expect(r.reloaded).toBe(true)
      expect(reload).toHaveBeenCalledTimes(1)
      expect(sw.removeEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function))
    } finally {
      vi.useRealTimers()
    }
  })

  // AC5: navigator.serviceWorker不在(swContainer=null) → fallbackReload縮退
  it('when_swContainer_null_should_use_fallback_reload', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ sha: 'newer-sha-xyz' }) }))
    const reload = vi.fn()
    const r = await checkAndReloadIfStale({ fetch: fetchFn, reload, swContainer: null })
    expect(r.reloaded).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  // AC9 (R3): reload発火直前にsessionStorage loginReloadReasonがセットされる(fallback path)
  it('when_mismatch_fallback_path_should_set_loginReloadReason_before_reload', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ sha: 'newer-sha-xyz' }) }))
    const reload = vi.fn()
    await checkAndReloadIfStale({ fetch: fetchFn, reload, swContainer: null })
    expect(sessionStorage.getItem('loginReloadReason')).toBe('新しいバージョンに更新しました')
  })

  // AC9 (R3): controllerchange pathでもloginReloadReasonがセットされる
  it('when_swContainer_controllerchange_fires_should_set_loginReloadReason', async () => {
    let ccListener = null
    const sw = {
      addEventListener: vi.fn((event, fn) => { if (event === 'controllerchange') ccListener = fn }),
      removeEventListener: vi.fn(),
    }
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ sha: 'newer-sha-xyz' }) }))
    const reload = vi.fn()
    const updateSW = vi.fn(async () => { ccListener?.() })
    await checkAndReloadIfStale({ fetch: fetchFn, reload, updateSW, swContainer: sw })
    expect(sessionStorage.getItem('loginReloadReason')).toBe('新しいバージョンに更新しました')
  })
})
