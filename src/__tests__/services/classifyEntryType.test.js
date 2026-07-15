// ============================================
// classifyEntryType: 巡回エントリ種別判定の業務ルール
// patrol.md: メーター変化→patrol / 景品・設定変化→replace / 集金日→collection
// (supabase は import 副作用回避のためモック。classifyEntryType自体は純関数)
// ============================================
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../lib/auth/orgConstants', () => ({ DFX_ORG_ID: 'test-org', CHANGE_ORG_ID: 'test-org' }))
vi.mock('../../lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))
vi.mock('../../lib/errorCodes', () => ({ ERR: {} }))

const { classifyEntryType } = await import('../../services/patrolCore')

const prevBase = {
  in_meter: 100, out_meter: 50,
  prize_name: 'クマ', set_a: '1', set_c: '2', set_l: '3', set_r: '4', set_o: '5',
}
const sameNext = {
  inMeter: '100', outMeter: '50',
  prizeName: 'クマ', setA: '1', setC: '2', setL: '3', setR: '4', setO: '5',
}

describe('classifyEntryType', () => {
  it('集金日は無条件 collection', () => {
    expect(classifyEntryType({ prev: prevBase, next: sameNext, isCollection: true })).toBe('collection')
    expect(classifyEntryType({ prev: null, next: sameNext, isCollection: true })).toBe('collection')
  })

  it('前回値が無ければ patrol', () => {
    expect(classifyEntryType({ prev: null, next: sameNext })).toBe('patrol')
  })

  it('INメーター変化で patrol', () => {
    expect(classifyEntryType({ prev: prevBase, next: { ...sameNext, inMeter: '120' } })).toBe('patrol')
  })

  it('OUTメーター変化で patrol', () => {
    expect(classifyEntryType({ prev: prevBase, next: { ...sameNext, outMeter: '60' } })).toBe('patrol')
  })

  it('メーター同値 + 景品名変化 → replace', () => {
    expect(classifyEntryType({ prev: prevBase, next: { ...sameNext, prizeName: 'ネコ' } })).toBe('replace')
  })

  it('メーター同値 + 設定変化 → replace', () => {
    expect(classifyEntryType({ prev: prevBase, next: { ...sameNext, setA: '9' } })).toBe('replace')
    expect(classifyEntryType({ prev: prevBase, next: { ...sameNext, setO: '0' } })).toBe('replace')
  })

  it('メーター同値 + 景品/設定とも同じ → patrol', () => {
    expect(classifyEntryType({ prev: prevBase, next: sameNext })).toBe('patrol')
  })

  it('未入力(空文字)メーターは null 扱いで前回と差→ patrol', () => {
    expect(classifyEntryType({ prev: prevBase, next: { ...sameNext, inMeter: '' } })).toBe('patrol')
  })
})
