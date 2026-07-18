// SPEC-COLLECTION-PAST-EDIT-ADVANCE-01 (D-086): updateCollectionAdvanceNotes は
// cash_collection_booths を advance_payment/notes "のみ" 更新し、親 cash_collections の updated_at/updated_by を更新する。
import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateCalls = [] // { table, payload, eqCol, eqVal }

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table) {
    const builder = {
      _table: table,
      select() { return builder },
      order() { return Promise.resolve({ data: [], error: null }) },
      in() { return Promise.resolve({ data: [], error: null }) },
      update(payload) {
        return {
          eq(col, val) {
            updateCalls.push({ table, payload, eqCol: col, eqVal: val })
            return Promise.resolve({ error: null })
          },
        }
      },
      eq() { return builder },
    }
    return builder
  }
  return { supabase: { from: (t) => makeBuilder(t) } }
})

const { updateCollectionAdvanceNotes } = await import('../../services/collections')

beforeEach(() => { updateCalls.length = 0 })

describe('AC1/AC2/AC3: updateCollectionAdvanceNotes', () => {
  it('AC3: cash_collection_booths の update payload は advance_payment/notes のみ', async () => {
    await updateCollectionAdvanceNotes('c1', [{ id: 'c1-b1', advance_payment: '500', notes: 'memo' }], 'staff-9')
    const boothUpd = updateCalls.filter(u => u.table === 'cash_collection_booths')
    expect(boothUpd).toHaveLength(1)
    expect(Object.keys(boothUpd[0].payload).sort()).toEqual(['advance_payment', 'notes'])
    // メーター/集金額/金種/署名 列は一切含まれない
    for (const forbidden of ['total', 'in_meter_current', 'bill_10000', 'coin_500', 'collection_id', 'signature']) {
      expect(boothUpd[0].payload).not.toHaveProperty(forbidden)
    }
    expect(boothUpd[0].eqCol).toBe('id')
    expect(boothUpd[0].eqVal).toBe('c1-b1')
  })

  it('AC1: advance_payment を数値化、空欄→0 / notes を trim、空→null', async () => {
    await updateCollectionAdvanceNotes('c1', [
      { id: 'c1-b1', advance_payment: '1200', notes: '  手入れ  ' },
      { id: 'c1-b2', advance_payment: '', notes: '   ' },
    ], 'staff-9')
    const b = updateCalls.filter(u => u.table === 'cash_collection_booths')
    expect(b[0].payload).toEqual({ advance_payment: 1200, notes: '手入れ' })
    expect(b[1].payload).toEqual({ advance_payment: 0, notes: null })
  })

  it('AC2: 親 cash_collections に updated_at/updated_by を記録', async () => {
    await updateCollectionAdvanceNotes('c1', [{ id: 'c1-b1', advance_payment: '0', notes: '' }], 'staff-9')
    const parent = updateCalls.filter(u => u.table === 'cash_collections')
    expect(parent).toHaveLength(1)
    expect(parent[0].payload.updated_by).toBe('staff-9')
    expect(typeof parent[0].payload.updated_at).toBe('string')
    expect(Object.keys(parent[0].payload).sort()).toEqual(['updated_at', 'updated_by'])
    expect(parent[0].eqCol).toBe('collection_id')
    expect(parent[0].eqVal).toBe('c1')
  })

  it('AC3: 更新は cash_collection_booths と cash_collections の2テーブルのみ (他テーブル不変)', async () => {
    await updateCollectionAdvanceNotes('c1', [{ id: 'c1-b1', advance_payment: '5', notes: 'x' }], 'staff-9')
    const tables = new Set(updateCalls.map(u => u.table))
    expect(tables).toEqual(new Set(['cash_collection_booths', 'cash_collections']))
  })
})
