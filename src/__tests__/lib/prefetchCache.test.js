import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => globalThis.__pcSupabaseFrom?.(...args),
  },
}))

const { startPrefetch, getCache, clearCache } = await import('../../lib/prefetchCache')

function makeChain(data = []) {
  const c = {
    select: () => c,
    eq: () => c,
    order: () => c,
    limit: () => c,
    then(resolve) { resolve({ data, error: null }) },
  }
  return c
}

function makeFromFn(tableData = {}) {
  return (table) => makeChain(tableData[table] ?? [])
}

beforeEach(() => {
  clearCache()
  globalThis.__pcSupabaseFrom = makeFromFn()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('startPrefetch', () => {
  it('when_called_with_valid_staffId_sets_ready_true_after_completion', async () => {
    await startPrefetch('staff-001')
    const entry = getCache('staff-001')
    expect(entry?.ready).toBe(true)
  })

  it('when_called_with_null_staffId_does_nothing', async () => {
    await startPrefetch(null)
    expect(getCache(null)).toBeNull()
  })

  it('when_called_populates_all_five_data_arrays', async () => {
    globalThis.__pcSupabaseFrom = makeFromFn({
      stores: [{ store_code: 'S1', store_name: '久留米' }],
      machines: [{ machine_code: 'M1', machine_name: 'クレーン' }],
      booths: [{ booth_code: 'B1', booth_number: 1 }],
      booth_alerts: [{ alert_id: 'A1', resolved: false }],
      staff_stores: [{ store_code: 'S1' }],
    })
    await startPrefetch('staff-001')
    const entry = getCache('staff-001')
    expect(entry?.stores).toHaveLength(1)
    expect(entry?.machines).toHaveLength(1)
    expect(entry?.booths).toHaveLength(1)
    expect(entry?.booth_alerts).toHaveLength(1)
    expect(entry?.staff_stores).toHaveLength(1)
  })

  it('when_fetch_throws_ready_stays_false', async () => {
    globalThis.__pcSupabaseFrom = () => {
      throw new Error('network error')
    }
    await startPrefetch('staff-err')
    const entry = _getCacheRaw('staff-err')
    expect(entry?.ready).toBe(false)
  })
})

describe('getCache', () => {
  it('when_called_before_startPrefetch_returns_null', () => {
    expect(getCache('staff-001')).toBeNull()
  })

  it('when_called_with_null_returns_null', () => {
    expect(getCache(null)).toBeNull()
  })

  it('when_called_after_startPrefetch_returns_entry', async () => {
    await startPrefetch('staff-001')
    const entry = getCache('staff-001')
    expect(entry).not.toBeNull()
    expect(entry.ready).toBe(true)
  })

  it('when_called_after_TTL_expires_returns_null', async () => {
    vi.useFakeTimers()
    await startPrefetch('staff-001')
    vi.advanceTimersByTime(60001)
    expect(getCache('staff-001')).toBeNull()
  })

  it('when_called_within_TTL_returns_entry', async () => {
    vi.useFakeTimers()
    await startPrefetch('staff-001')
    vi.advanceTimersByTime(59999)
    expect(getCache('staff-001')).not.toBeNull()
  })
})

describe('clearCache', () => {
  it('when_called_removes_all_entries', async () => {
    await startPrefetch('staff-001')
    await startPrefetch('staff-002')
    clearCache()
    expect(getCache('staff-001')).toBeNull()
    expect(getCache('staff-002')).toBeNull()
  })
})

// internal helper for white-box test (fetch throws case)
function _getCacheRaw(staffId) {
  // Access module-level _cache via a re-import trick is not possible in ESM.
  // Instead test via getCache which returns the entry before checking ready.
  // For the throws case, ready=false means getCache still returns the entry
  // (it's not expired yet), so we can observe ready=false directly.
  return getCache(staffId)
}
