// @vitest-environment node
// J-COLLECTION-01: 集金計算/ID生成の純関数テスト (TDD 先行)
import { describe, it, expect } from 'vitest'
import { DENOMINATIONS, genCollectionId, boothTotal, grandTotal, denominationSummary } from './collectionCalc'

describe('DENOMINATIONS', () => {
  it('when_listed_should_be_6_denoms_万から五十', () => {
    expect(DENOMINATIONS.map(d => d.unit)).toEqual([10000, 5000, 1000, 500, 100, 50])
  })
})

describe('genCollectionId', () => {
  it('when_date_string_should_format_store_yyyymmdd_seq', () => {
    expect(genCollectionId('SMD01', '2026-04-14', 1)).toBe('SMD01-20260414-01')
  })
  it('when_seq_two_digits_should_not_pad_beyond', () => {
    expect(genCollectionId('KKY01', '2026-05-27', 12)).toBe('KKY01-20260527-12')
  })
})

describe('boothTotal', () => {
  it('when_empty_should_be_0', () => {
    expect(boothTotal({})).toBe(0)
  })
  it('when_mixed_denoms_should_sum_unit_times_count', () => {
    // 万1 + 千2 + 五百3 = 10000 + 2000 + 1500 = 13500
    expect(boothTotal({ bill_10000: 1, bill_1000: 2, coin_500: 3 })).toBe(13500)
  })
})

describe('grandTotal', () => {
  it('when_two_booths_should_sum_each_boothTotal', () => {
    const booths = [{ bill_10000: 1 }, { bill_1000: 5 }]
    expect(grandTotal(booths)).toBe(15000)
  })
})

describe('denominationSummary', () => {
  it('when_aggregating_should_total_counts_and_subtotals_per_denom', () => {
    const booths = [
      { bill_10000: 1, coin_100: 2 },
      { bill_10000: 2, coin_100: 3 },
    ]
    const s = denominationSummary(booths)
    const man = s.rows.find(r => r.unit === 10000)
    const hyaku = s.rows.find(r => r.unit === 100)
    expect(man.count).toBe(3)
    expect(man.subtotal).toBe(30000)
    expect(hyaku.count).toBe(5)
    expect(hyaku.subtotal).toBe(500)
    expect(s.total).toBe(30500)
  })
})
