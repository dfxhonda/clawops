// @vitest-environment node
// SPEC-LF1-IDEMPOTENT-SYNC-01: storeSync D2 (mark synced on skipped) / D5 (Sentry visibility)
// / D6 (debounced trigger)
import { describe, it, expect, vi, beforeEach } from 'vitest'

const savePatrolReading = vi.fn()
vi.mock('../../services/patrolCore', () => ({ savePatrolReading: (...a) => savePatrolReading(...a) }))

const markRecordSynced = vi.fn()
const setRecordLastErrCode = vi.fn()
const getPatrolRecordsByStore = vi.fn()
vi.mock('../../lib/localStore/patrolRecords', () => ({
  getUnsyncedRecords: vi.fn(async () => []),
  markRecordSynced: (...a) => markRecordSynced(...a),
  setRecordLastErrCode: (...a) => setRecordLastErrCode(...a),
  getPatrolRecordsByStore: (...a) => getPatrolRecordsByStore(...a),
  putPatrolRecord: vi.fn(async () => {}),
}))

const loggerError = vi.fn()
vi.mock('../../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: (...a) => loggerError(...a) } }))

// SPEC-LF1-PROBE-SUPABASE-DIRECT-01: probe reads url/key off the resolved client instance.
vi.mock('../../lib/supabase', () => ({
  supabase: { supabaseUrl: 'https://proj.supabase.co', supabaseKey: 'anon-key-xyz' },
}))

const { uploadStoreRecords, makeDebouncedUploadAll, probeOnline, _resetInFlight } = await import('../../services/storeSync')

const rec = {
  localId: 'l1', synced: false, booth_code: 'TST01-M01-B01', store_code: 'TST01',
  machine_code: 'TST01-M01', in_meter: 100, out_meter: 50, patrol_date: '2026-07-08',
  createdLocally: '2026-07-08T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  _resetInFlight()
  getPatrolRecordsByStore.mockResolvedValue([rec])
  markRecordSynced.mockResolvedValue({})
  setRecordLastErrCode.mockResolvedValue({})
})

describe('D2: replay passes queued values + marks synced on skipped:duplicate (AC2)', () => {
  it('passes patrolDate/readingId/clientTimestamp and marks synced on ok:true skipped:duplicate', async () => {
    savePatrolReading.mockResolvedValue({ ok: true, skipped: 'duplicate' })
    const res = await uploadStoreRecords('TST01', { staff: { staffId: 's1' }, skipProbe: true })
    expect(savePatrolReading).toHaveBeenCalledWith(expect.objectContaining({
      patrolDate: '2026-07-08', readingId: 'l1', clientTimestamp: '2026-07-08T00:00:00Z',
    }))
    expect(markRecordSynced).toHaveBeenCalledWith('l1')
    expect(res.uploaded).toBe(1)
  })
})

describe('D5: failures go to Sentry (logger.error) with context (AC4)', () => {
  it('logs error with localId/booth_code/patrol_date/errCode and persists lastErrCode', async () => {
    savePatrolReading.mockResolvedValue({ ok: false, errCode: 'ERR-METER-001', message: 'boom' })
    const res = await uploadStoreRecords('TST01', { staff: { staffId: 's1' }, skipProbe: true })
    expect(res.failed).toBe(1)
    expect(loggerError).toHaveBeenCalledWith('ERR-LF1-SYNC-UPLOAD', expect.objectContaining({
      localId: 'l1', booth_code: 'TST01-M01-B01', patrol_date: '2026-07-08', errCode: 'ERR-METER-001',
    }))
    expect(setRecordLastErrCode).toHaveBeenCalledWith('l1', 'ERR-METER-001')
    // failed>0 summary also goes to logger.error
    expect(loggerError).toHaveBeenCalledWith('LF1_UPLOAD_DONE', expect.objectContaining({ failed: 1 }))
  })
})

describe('probeOnline hits Supabase directly, not same-origin (PROBE-SUPABASE-DIRECT-01 AC2)', () => {
  const okFetch = vi.fn(async () => ({ ok: true }))

  beforeEach(() => { vi.unstubAllGlobals() })

  it('fetches the Supabase auth health endpoint with the apikey header (not /version.json)', async () => {
    const fetcher = vi.fn(async () => ({ ok: true }))
    const res = await probeOnline({ fetcher })
    expect(res).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, opts] = fetcher.mock.calls[0]
    expect(url).toContain('https://proj.supabase.co')
    expect(url).toContain('/auth/v1/health')
    expect(url).not.toContain('version.json')
    expect(opts.headers.apikey).toBe('anon-key-xyz')
    expect(opts.cache).toBe('no-store')
  })

  it('non-2xx response -> false', async () => {
    const res = await probeOnline({ fetcher: vi.fn(async () => ({ ok: false, status: 302 })) })
    expect(res).toBe(false)
  })

  it('network error (fetch rejects) -> false', async () => {
    const res = await probeOnline({ fetcher: vi.fn(async () => { throw new Error('ECONNREFUSED') }) })
    expect(res).toBe(false)
  })

  it('navigator.onLine === false short-circuits without fetching', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const res = await probeOnline({ fetcher: okFetch })
    expect(res).toBe(false)
    expect(okFetch).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('D6: debounced uploadAll fires exactly once per burst (AC5)', () => {
  it('collapses a burst of triggers into one uploader call after debounceMs', () => {
    vi.useFakeTimers()
    const uploader = vi.fn().mockResolvedValue({})
    const trigger = makeDebouncedUploadAll({ getStaff: () => ({ staffId: 's1' }), debounceMs: 10000, uploader })
    trigger(); trigger(); trigger()
    expect(uploader).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10000)
    expect(uploader).toHaveBeenCalledTimes(1)
    expect(uploader).toHaveBeenCalledWith({ staff: { staffId: 's1' } })
    vi.useRealTimers()
  })
})
