// SPEC-COLLECTION-STAFF-NAME-SEPARATION-01 (D-090) AC3:
// saveCollection は表示名を collected_by_name に、staffId を updated_by(純監査) に分離して書く。
import { describe, it, expect, vi, beforeEach } from 'vitest'

const inserts = []

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table) {
    const b = {
      select() { return b },
      eq() { return b },
      order() { return Promise.resolve({ data: [], error: null }) },
      in() { return Promise.resolve({ data: [], error: null }) },
      single() { return Promise.resolve({ data: null, error: null }) },
      maybeSingle() { return Promise.resolve({ data: null, error: null }) },
      insert(payload) { inserts.push({ table, payload }); return Promise.resolve({ error: null }) },
      update() { return { eq: () => Promise.resolve({ error: null }) } },
      // count-head クエリ (.select(...).eq().eq()) の await 用
      then(resolve) { return Promise.resolve(resolve({ count: 0, data: [], error: null })) },
    }
    return b
  }
  return { supabase: { from: (t) => makeBuilder(t) } }
})

const { saveCollection } = await import('../../services/collections')

beforeEach(() => { inserts.length = 0 })

describe('AC3: saveCollection 担当名/監査カラム分離', () => {
  it('collected_by_name=表示名 / updated_by=staffId / collected_by=staffId', async () => {
    await saveCollection({
      storeCode: 'KKY01',
      collectedAt: '2026-07-01',
      prevCollectionDate: '2026-06-01',
      collectedBy: 'STAFF-03',
      collectedByName: '本田',
      booths: [],
      rowData: {},
      notes: null,
    })
    const colInsert = inserts.find(i => i.table === 'cash_collections')
    expect(colInsert).toBeTruthy()
    // 表示名は専用カラムへ
    expect(colInsert.payload.collected_by_name).toBe('本田')
    // 監査カラム updated_by は staffId (表示名を流用しない)
    expect(colInsert.payload.updated_by).toBe('STAFF-03')
    expect(colInsert.payload.updated_by).not.toBe('本田')
    expect(colInsert.payload.collected_by).toBe('STAFF-03')
  })
})
