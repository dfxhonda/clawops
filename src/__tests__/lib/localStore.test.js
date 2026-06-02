// @vitest-environment happy-dom
// SPEC-LF1-STORE-LOCAL-CACHE-01: IndexedDB layer (db + patrolRecords) のユニット検証
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'

import { _resetDb } from '../../lib/localStore/db'
import {
  putPatrolRecord,
  getPatrolRecordsByBooth,
  getPatrolRecordsByStore,
  getUnsyncedRecords,
  getUnsyncedSummary,
  markRecordSynced,
  putStoreMeta,
  getStoreMeta,
} from '../../lib/localStore/patrolRecords'

beforeEach(async () => {
  await _resetDb()
})

describe('putPatrolRecord / get*', () => {
  it('putPatrolRecord_assigns_localId_and_default_synced_false', async () => {
    const saved = await putPatrolRecord({
      booth_code: 'MNK01-M01-B01',
      store_code: 'MNK01',
      patrol_date: '2026-06-02',
      in_meter: 1000,
    })
    expect(saved.localId).toBeTruthy()
    expect(saved.synced).toBe(false)
    expect(saved.syncedKey).toBe('false')
    expect(saved.updatedLocally).toBeTruthy()
  })

  it('getPatrolRecordsByBooth_returns_records_for_booth', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 2 })
    await putPatrolRecord({ booth_code: 'A-2', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 9 })
    const rs = await getPatrolRecordsByBooth('A-1')
    expect(rs).toHaveLength(2)
    expect(rs.every(r => r.booth_code === 'A-1')).toBe(true)
  })

  it('getPatrolRecordsByStore_returns_records_for_store', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    await putPatrolRecord({ booth_code: 'B-1', store_code: 'S2', patrol_date: '2026-06-02', in_meter: 5 })
    const rs = await getPatrolRecordsByStore('S1')
    expect(rs).toHaveLength(1)
    expect(rs[0].booth_code).toBe('A-1')
  })
})

describe('synced flag lifecycle', () => {
  it('newly_put_records_appear_in_getUnsyncedRecords', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    await putPatrolRecord({ booth_code: 'B-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 2 })
    const rs = await getUnsyncedRecords()
    expect(rs).toHaveLength(2)
  })

  it('markRecordSynced_flips_flag_and_removes_from_unsynced_list', async () => {
    const a = await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    const b = await putPatrolRecord({ booth_code: 'B-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 2 })
    const after = await markRecordSynced(a.localId)
    expect(after.synced).toBe(true)
    expect(after.syncedKey).toBe('true')
    expect(after.syncedAt).toBeTruthy()
    const unsynced = await getUnsyncedRecords()
    expect(unsynced).toHaveLength(1)
    expect(unsynced[0].localId).toBe(b.localId)
  })

  it('markRecordSynced_for_missing_localId_returns_null_no_crash', async () => {
    expect(await markRecordSynced('not-exist')).toBe(null)
  })

  it('getUnsyncedSummary_returns_count_and_storeCount', async () => {
    await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    await putPatrolRecord({ booth_code: 'A-2', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 1 })
    await putPatrolRecord({ booth_code: 'B-1', store_code: 'S2', patrol_date: '2026-06-02', in_meter: 1 })
    const s = await getUnsyncedSummary()
    expect(s.count).toBe(3)
    expect(s.storeCount).toBe(2)
  })

  it('AC_08_LF1_never_deletes_records_synced_or_unsynced', async () => {
    // putPatrolRecord で update した時、過去レコードは残存する (1 booth 複数回保存可)。
    const r1 = await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-01', in_meter: 100 })
    const r2 = await putPatrolRecord({ booth_code: 'A-1', store_code: 'S1', patrol_date: '2026-06-02', in_meter: 200 })
    await markRecordSynced(r1.localId)
    const allForBooth = await getPatrolRecordsByBooth('A-1')
    expect(allForBooth).toHaveLength(2)
    // synced+unsynced 両方残る
    expect(allForBooth.find(r => r.localId === r1.localId)?.synced).toBe(true)
    expect(allForBooth.find(r => r.localId === r2.localId)?.synced).toBe(false)
  })
})

describe('store meta', () => {
  it('putStoreMeta_and_getStoreMeta', async () => {
    await putStoreMeta('MNK01', { storeName: '南熊本店', machines: [{ machine_code: 'M01' }] })
    const got = await getStoreMeta('MNK01')
    expect(got.store_code).toBe('MNK01')
    expect(got.storeName).toBe('南熊本店')
    expect(got.machines).toEqual([{ machine_code: 'M01' }])
    expect(got.updatedAt).toBeTruthy()
  })

  it('getStoreMeta_returns_undefined_when_not_set', async () => {
    expect(await getStoreMeta('MISSING')).toBeUndefined()
  })

  it('null_storeCode_to_putStoreMeta_is_noop', async () => {
    await putStoreMeta(null, { storeName: 'x' })
    expect(await getStoreMeta(null)).toBe(null)
  })
})
