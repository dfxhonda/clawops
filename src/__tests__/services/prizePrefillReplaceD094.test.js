// SPEC-PATROL-PRIZE-PREFILL-REPLACE-VISIBLE-FIX-01 (D-094):
// buildPrevFromRows (景品=最新any / メーター=patrol) + computeLocalStoreView の replace 除外。
import { describe, it, expect } from 'vitest'
import { buildPrevFromRows } from '../../services/prevBaseline'
import { computeLocalStoreView } from '../../clawsupport/state/localStoreView'

describe('D-094 buildPrevFromRows: 景品=最新any / メーター=patrol', () => {
  it('AC1/AC3: replace 最新の新景品を採用しつつ、メーター/在庫は patrol 最新から (replace の in_meter=0 を出さない)', () => {
    const rows = [
      { entry_type: 'replace', patrol_date: '2026-07-11', created_at: '2026-07-11T10:00:00Z', prize_name: 'トイストーリー', prize_id: 'P-NEW', in_meter: 0, prize_stock_count: 5 },
      { entry_type: 'patrol', patrol_date: '2026-07-10', created_at: '2026-07-10T09:00:00Z', prize_name: '旧景品', prize_id: 'P-OLD', in_meter: 1500, prize_stock_count: 20 },
    ]
    const prev = buildPrevFromRows(rows)
    expect(prev.prize_name).toBe('トイストーリー') // 景品 = 最新 (replace)
    expect(prev.prize_id).toBe('P-NEW')
    expect(prev.in_meter).toBe(1500) // メーター = patrol (replace の 0 ではない)
    expect(prev.prize_stock_count).toBe(20) // 在庫 = patrol
  })

  it('AC4: 入替連打 — 最新 replace の景品を採用 (0.5秒差2連replace)', () => {
    const rows = [
      { entry_type: 'replace', patrol_date: '2026-07-11', created_at: '2026-07-11T10:00:01Z', prize_name: '新景品2', in_meter: 0 },
      { entry_type: 'replace', patrol_date: '2026-07-11', created_at: '2026-07-11T10:00:00Z', prize_name: '新景品1', in_meter: 0 },
      { entry_type: 'patrol', patrol_date: '2026-07-10', created_at: '2026-07-10T09:00:00Z', prize_name: '旧景品', in_meter: 1500 },
    ]
    const prev = buildPrevFromRows(rows)
    expect(prev.prize_name).toBe('新景品2') // 最新 replace
    expect(prev.in_meter).toBe(1500) // メーターは patrol
  })

  it('rows 空 → null', () => {
    expect(buildPrevFromRows([])).toBeNull()
    expect(buildPrevFromRows(null)).toBeNull()
  })

  it('patrol 行なし (replace のみ) → 景品/メーター両方 replace から (degraded fallback、クラッシュしない)', () => {
    const prev = buildPrevFromRows([{ entry_type: 'replace', patrol_date: '2026-07-11', prize_name: 'x', in_meter: 0 }])
    expect(prev.prize_name).toBe('x')
    expect(prev.in_meter).toBe(0)
  })
})

describe('D-094 AC2: computeLocalStoreView は diff 集計から replace を除外 (FIX-05 維持)', () => {
  it('replace 行は diff に混入しない (patrol 限定)', () => {
    const records = [
      { booth_code: 'B-patrol', entry_type: 'patrol', patrol_date: '2026-07-10', created_at: '2026-07-10T09:00:00Z', in_meter: 1500, synced: true },
      { booth_code: 'B-patrol', entry_type: 'patrol', patrol_date: '2026-07-08', created_at: '2026-07-08T09:00:00Z', in_meter: 1000, synced: true },
      { booth_code: 'B-replace-only', entry_type: 'replace', patrol_date: '2026-07-11', created_at: '2026-07-11T10:00:00Z', in_meter: 0, synced: true },
    ]
    const { diffMap } = computeLocalStoreView(records, { meterUnitPriceMap: {}, today: '2026-07-18' })
    // patrol booth は summary を持つ、replace のみの booth は除外され summary なし
    expect(diffMap['B-patrol']).toBeTruthy()
    expect(diffMap['B-replace-only']).toBeUndefined()
  })
})
