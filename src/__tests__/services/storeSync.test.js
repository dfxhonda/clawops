// @vitest-environment happy-dom
// SPEC-LF1-STORE-LOCAL-CACHE-01: storeSync (probeOnline + uploadStoreRecords) のユニット検証
import { describe, it, expect, vi, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'

import { _resetDb } from '../../lib/localStore/db'
import { putPatrolRecord, getPatrolRecordsByStore } from '../../lib/localStore/patrolRecords'

// savePatrolReading を mock
const saveMock = vi.fn()
vi.mock('../../services/patrolCore', () => ({
  savePatrolReading: (...args) => saveMock(...args),
}))

import { probeOnline, uploadStoreRecords, uploadAllUnsynced, _resetInFlight } from '../../services/storeSync'

beforeEach(async () => {
  await _resetDb()
  saveMock.mockReset()
  _resetInFlight()
})

describe('probeOnline', () => {
  it('returns_false_when_navigator_onLine_is_false', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const ok = await probeOnline()
    expect(ok).toBe(false)
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('returns_true_when_fetch_ok', async () => {
    const fetcher = vi.fn(async () => ({ ok: true }))
    const ok = await probeOnline({ fetcher })
    expect(ok).toBe(true)
    expect(fetcher).toHaveBeenCalledWith('/version.json?probe=1', expect.objectContaining({ cache: 'no-store' }))
  })

  it('returns_false_when_fetch_throws_and_logs', async () => {
    const fetcher = vi.fn(async () => { throw new Error('offline') })
    const ok = await probeOnline({ fetcher })
    expect(ok).toBe(false)
  })

  it('returns_false_when_fetch_returns_non_ok', async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 500 }))
    const ok = await probeOnline({ fetcher })
    expect(ok).toBe(false)
  })
})

describe('uploadStoreRecords', () => {
  it('uploads_each_unsynced_then_marks_synced', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    await putPatrolRecord({ booth_code: 'A-2', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 2 })
    saveMock.mockResolvedValue({ ok: true })
    const res = await uploadStoreRecords('S1', { skipProbe: true })
    expect(res.uploaded).toBe(2)
    expect(res.failed).toBe(0)
    expect(saveMock).toHaveBeenCalledTimes(2)
    const after = await getPatrolRecordsByStore('S1')
    expect(after.every(r => r.synced)).toBe(true)
  })

  it('failed_save_keeps_record_unsynced', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    saveMock.mockResolvedValue({ ok: false, errCode: 'ERR-X', message: 'boom' })
    const res = await uploadStoreRecords('S1', { skipProbe: true })
    expect(res.uploaded).toBe(0)
    expect(res.failed).toBe(1)
    const after = await getPatrolRecordsByStore('S1')
    expect(after[0].synced).toBe(false)
  })

  it('skipProbe_false_with_offline_skips_upload', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const res = await uploadStoreRecords('S1')
    expect(res.uploaded).toBe(0)
    expect(res.skipped).toBe(1)
    expect(saveMock).not.toHaveBeenCalled()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('empty_unsynced_returns_zero_no_save_call', async () => {
    const res = await uploadStoreRecords('S1', { skipProbe: true })
    expect(res.uploaded).toBe(0)
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('uploadAllUnsynced_iterates_all_stores', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    await putPatrolRecord({ booth_code: 'B-1', store_code: 'S2', patrol_date: '2026-06-02', in_meter: 1 })
    saveMock.mockResolvedValue({ ok: true })
    // probeOnline は navigator.onLine + fetch probe を見るが、テストでは固定して
    // uploadStoreRecords 単体テストと同じく確実な path を取るため fetch を成功 mock。
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))
    const res = await uploadAllUnsynced()
    expect(res.uploaded).toBe(2)
    vi.unstubAllGlobals()
  })

  // FIX3: store_code:null でも booth_code 逆引きで補完して送信
  it('when_store_code_null_and_booth_reversible_should_upload_via_derived_store', async () => {
    // booth_code 'MNK01-M01-B01' → store_code 'MNK01' を逆引き
    await putPatrolRecord({ booth_code: 'MNK01-M01-B01', store_code: null, patrol_date: '2026-06-08', in_meter: 100 })
    saveMock.mockResolvedValue({ ok: true })
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))
    const res = await uploadAllUnsynced()
    expect(res.uploaded).toBe(1)
    vi.unstubAllGlobals()
  })

  // FIX3: store_code:null かつ booth_code 逆引き不能なら引き続き skip
  it('when_store_code_null_and_booth_irreversible_should_skip', async () => {
    await putPatrolRecord({ booth_code: 'NODASH', store_code: null, patrol_date: '2026-06-08', in_meter: 200 })
    saveMock.mockResolvedValue({ ok: true })
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))
    const res = await uploadAllUnsynced()
    expect(res.uploaded).toBe(0)
    expect(saveMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('SPEC-LF1-SYNC-CONCURRENCY-GUARD-01: in-flight lock', () => {
  it('AC1: when_same_store_called_concurrently_should_call_save_once_per_record', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-07-02', in_meter: 1 })
    saveMock.mockResolvedValue({ ok: true })
    const [r1, r2] = await Promise.all([
      uploadStoreRecords('S1', { skipProbe: true }),
      uploadStoreRecords('S1', { skipProbe: true }),
    ])
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(r1).toEqual(r2)
  })

  it('AC2: when_different_stores_called_concurrently_should_upload_all', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-07-02', in_meter: 1 })
    await putPatrolRecord({ booth_code: 'B-1', store_code: 'S2', patrol_date: '2026-07-02', in_meter: 2 })
    saveMock.mockResolvedValue({ ok: true })
    const [r1, r2] = await Promise.all([
      uploadStoreRecords('S1', { skipProbe: true }),
      uploadStoreRecords('S2', { skipProbe: true }),
    ])
    expect(r1.uploaded).toBe(1)
    expect(r2.uploaded).toBe(1)
    expect(saveMock).toHaveBeenCalledTimes(2)
  })

  it('AC3: when_uploadAllUnsynced_and_uploadStoreRecords_concurrent_should_not_duplicate', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-07-02', in_meter: 1 })
    saveMock.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))
    await Promise.all([
      uploadAllUnsynced(),
      uploadStoreRecords('S1', { skipProbe: true }),
    ])
    expect(saveMock).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('AC4: when_upload_completes_subsequent_call_should_start_fresh', async () => {
    saveMock.mockResolvedValue({ ok: true })
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-07-02', in_meter: 1 })
    const r1 = await uploadStoreRecords('S1', { skipProbe: true })
    expect(r1.uploaded).toBe(1)
    expect(saveMock).toHaveBeenCalledTimes(1)
    // Lock must be released; second run with a new unsynced record must invoke save again
    await putPatrolRecord({ booth_code: 'A-2', store_code: 'S1', patrol_date: '2026-07-02', in_meter: 2 })
    const r2 = await uploadStoreRecords('S1', { skipProbe: true })
    expect(r2.uploaded).toBe(1)
    expect(saveMock).toHaveBeenCalledTimes(2)
  })
})
