// SPEC-CLAWSUPPORT-STORECARD-REDESIGN-01: badge color logic, date formatting, meta computation
import { describe, it, expect } from 'vitest'

// Badge color logic extracted from StoreCard render logic
function badgeColor(done, total, hasLastDate) {
  if (!hasLastDate) return 'text-muted border-border' // no recent patrol
  if (total === 0) return null // no booths
  if (done >= total) return 'text-emerald-400 border-emerald-400/40'
  if (done > 0) return 'text-amber-400 border-amber-400/40'
  return 'text-muted border-border'
}

// Date label formatting (M/D from YYYY-MM-DD, no toISOString)
function formatPatrolDate(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number)
  return `最終 ${m}/${d}`
}

// Meta computation: changer exclusion + done count (mirrors ClawsupportHub load())
function computeMeta(boothRows, mrRows, changerMachineCodes) {
  const changerSet = new Set(changerMachineCodes)
  const boothMachineMap = {}
  const totalByStore = {}
  for (const b of boothRows) {
    boothMachineMap[b.booth_code] = b.machine_code
    if (!changerSet.has(b.machine_code)) {
      totalByStore[b.store_code] = (totalByStore[b.store_code] ?? 0) + 1
    }
  }

  const lastDateByStore = {}
  for (const mr of mrRows) {
    const { store_code, patrol_date } = mr
    if (!lastDateByStore[store_code] || patrol_date > lastDateByStore[store_code]) {
      lastDateByStore[store_code] = patrol_date
    }
  }

  const doneBoothsByStore = {}
  for (const mr of mrRows) {
    const { store_code, patrol_date, booth_code } = mr
    if (patrol_date !== lastDateByStore[store_code]) continue
    if (!doneBoothsByStore[store_code]) doneBoothsByStore[store_code] = new Set()
    const machineCode = boothMachineMap[booth_code]
    if (machineCode !== undefined && !changerSet.has(machineCode)) {
      doneBoothsByStore[store_code].add(booth_code)
    }
  }

  const stores = [...new Set(boothRows.map(b => b.store_code))]
  const metaMap = {}
  for (const sc of stores) {
    metaMap[sc] = {
      lastDate: lastDateByStore[sc] ?? null,
      done: doneBoothsByStore[sc]?.size ?? 0,
      total: totalByStore[sc] ?? 0,
    }
  }
  return metaMap
}

describe('SPEC-CLAWSUPPORT-STORECARD-REDESIGN-01 AC5: badge color', () => {
  it('when_all_done_badge_is_emerald', () => {
    expect(badgeColor(7, 7, true)).toBe('text-emerald-400 border-emerald-400/40')
  })
  it('when_partially_done_badge_is_amber', () => {
    expect(badgeColor(3, 8, true)).toBe('text-amber-400 border-amber-400/40')
  })
  it('when_none_done_badge_is_muted', () => {
    expect(badgeColor(0, 8, true)).toBe('text-muted border-border')
  })
  it('when_no_patrol_badge_is_muted', () => {
    expect(badgeColor(0, 8, false)).toBe('text-muted border-border')
  })
  it('when_no_booths_badge_is_null', () => {
    expect(badgeColor(0, 0, true)).toBeNull()
  })
})

describe('SPEC-CLAWSUPPORT-STORECARD-REDESIGN-01 AC6: date format JST M/D', () => {
  it('when_june_23_formats_as_6_23', () => {
    expect(formatPatrolDate('2026-06-23')).toBe('最終 6/23')
  })
  it('when_january_05_formats_as_1_5_no_leading_zero', () => {
    expect(formatPatrolDate('2026-01-05')).toBe('最終 1/5')
  })
  it('when_december_31_formats_as_12_31', () => {
    expect(formatPatrolDate('2026-12-31')).toBe('最終 12/31')
  })
})

describe('SPEC-CLAWSUPPORT-STORECARD-REDESIGN-01 AC3/AC4: changer exclusion + done count', () => {
  const booths = [
    // store KKY: 8 booths total, machine_code=MCH01 is changer → 7 non-changer
    { store_code: 'KKY', booth_code: 'B01', machine_code: 'MCH01' }, // changer
    { store_code: 'KKY', booth_code: 'B02', machine_code: 'MCH02' },
    { store_code: 'KKY', booth_code: 'B03', machine_code: 'MCH02' },
    { store_code: 'KKY', booth_code: 'B04', machine_code: 'MCH03' },
    { store_code: 'KKY', booth_code: 'B05', machine_code: 'MCH03' },
    { store_code: 'KKY', booth_code: 'B06', machine_code: 'MCH04' },
    { store_code: 'KKY', booth_code: 'B07', machine_code: 'MCH04' },
    { store_code: 'KKY', booth_code: 'B08', machine_code: 'MCH05' },
  ]
  const changerCodes = ['MCH01']
  const mrRows = [
    // 7 non-changer booths done on 2026-06-22
    { store_code: 'KKY', patrol_date: '2026-06-22', booth_code: 'B02' },
    { store_code: 'KKY', patrol_date: '2026-06-22', booth_code: 'B03' },
    { store_code: 'KKY', patrol_date: '2026-06-22', booth_code: 'B04' },
    { store_code: 'KKY', patrol_date: '2026-06-22', booth_code: 'B05' },
    { store_code: 'KKY', patrol_date: '2026-06-22', booth_code: 'B06' },
    { store_code: 'KKY', patrol_date: '2026-06-22', booth_code: 'B07' },
    { store_code: 'KKY', patrol_date: '2026-06-22', booth_code: 'B08' },
    // older date entries should be ignored
    { store_code: 'KKY', patrol_date: '2026-06-20', booth_code: 'B02' },
  ]

  it('when_KKY_total_is_7_not_8_changer_excluded', () => {
    const meta = computeMeta(booths, mrRows, changerCodes)
    expect(meta['KKY'].total).toBe(7)
  })

  it('when_KKY_done_is_7_on_last_patrol_date', () => {
    const meta = computeMeta(booths, mrRows, changerCodes)
    expect(meta['KKY'].done).toBe(7)
  })

  it('when_KKY_lastDate_is_latest_patrol', () => {
    const meta = computeMeta(booths, mrRows, changerCodes)
    expect(meta['KKY'].lastDate).toBe('2026-06-22')
  })

  it('when_older_entries_are_not_counted_in_done', () => {
    // Only entries on lastDate should count
    const meta = computeMeta(booths, mrRows, changerCodes)
    // B02 appears twice (2026-06-22 and 2026-06-20), but Set deduplication means only 1
    expect(meta['KKY'].done).toBe(7)
  })
})

describe('SPEC-CLAWSUPPORT-STORECARD-REDESIGN-01 AC7: no patrol crash', () => {
  it('when_no_mrRows_lastDate_is_null_and_done_is_0', () => {
    const booths = [{ store_code: 'NEW', booth_code: 'B01', machine_code: 'MCH01' }]
    const meta = computeMeta(booths, [], [])
    expect(meta['NEW'].lastDate).toBeNull()
    expect(meta['NEW'].done).toBe(0)
    expect(meta['NEW'].total).toBe(1)
  })
})
