// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { validateMeterReading, is2BoothType } from './meterValidation'

const ok1 = { machine_code: 'M01', confidence: 0.95, meters: { in_meter: 10000, out_meter: 3000 } }

describe('validateMeterReading - 1ブース機', () => {
  it('正常値はvalid・警告なし・blockedなし', () => {
    const r = validateMeterReading(ok1, { in_meter: 9000 }, false)
    expect(r.valid).toBe(true)
    expect(r.warnings).toEqual([])
    expect(r.blocked).toBe(false)
  })

  it('IN < OUT は異常値でblocked', () => {
    const r = validateMeterReading({ machine_code: 'M01', confidence: 0.95, meters: { in_meter: 100, out_meter: 200 } }, null, false)
    expect(r.blocked).toBe(true)
    expect(r.warnings).toContain('IN < OUT（異常値）')
    expect(r.valid).toBe(false)
  })

  it('INが前回より減少で警告(blockedではない)', () => {
    const r = validateMeterReading(ok1, { in_meter: 12000 }, false)
    expect(r.warnings).toContain('INが前回より減少しています')
    expect(r.blocked).toBe(false)
  })

  it('読み取りnullフィールドを警告', () => {
    const r = validateMeterReading({ machine_code: 'M01', confidence: 0.95, meters: { in_meter: 1000, out_meter: null } }, null, false)
    expect(r.warnings.some(w => w.includes('読み取り失敗') && w.includes('out_meter'))).toBe(true)
  })

  it('machine_code欠落を警告', () => {
    const r = validateMeterReading({ confidence: 0.95, meters: { in_meter: 1000, out_meter: 500 } }, null, false)
    expect(r.warnings).toContain('機械コードが読み取れませんでした')
  })

  it('信頼度0.8未満で再撮影推奨', () => {
    const r = validateMeterReading({ machine_code: 'M01', confidence: 0.42, meters: { in_meter: 1000, out_meter: 500 } }, null, false)
    expect(r.warnings.some(w => w.includes('信頼度が低い'))).toBe(true)
  })
})

describe('validateMeterReading - 2ブース機', () => {
  const ok2 = {
    machine_code: 'B01', confidence: 0.95,
    meters: { left_in: 5000, left_out: 1000, right_in: 6000, right_out: 1500 },
  }
  it('正常値はvalid', () => {
    const r = validateMeterReading(ok2, { left_in: 4000, right_in: 5000 }, true)
    expect(r.valid).toBe(true)
    expect(r.blocked).toBe(false)
  })

  it('左右どちらかの IN < OUT でblocked', () => {
    const r = validateMeterReading({
      machine_code: 'B01', confidence: 0.95,
      meters: { left_in: 100, left_out: 200, right_in: 6000, right_out: 1500 },
    }, null, true)
    expect(r.blocked).toBe(true)
    expect(r.warnings).toContain('左側: IN < OUT（異常値）')
  })

  it('右側IN減少を警告', () => {
    const r = validateMeterReading(ok2, { left_in: 4000, right_in: 9000 }, true)
    expect(r.warnings).toContain('右側INが前回より減少しています')
  })

  it('nullフィールドを列挙して警告', () => {
    const r = validateMeterReading({
      machine_code: 'B01', confidence: 0.95,
      meters: { left_in: 5000, left_out: 1000, right_in: null, right_out: null },
    }, null, true)
    expect(r.warnings.some(w => w.includes('読み取り失敗') && w.includes('right_in') && w.includes('right_out'))).toBe(true)
  })
})

describe('is2BoothType', () => {
  it('2ブース機種はtrue', () => {
    for (const t of ['BUZZ_CRANE_4', 'BUZZ_CRANE_SLIM', 'SESAME_W', 'TRI_DECK']) {
      expect(is2BoothType(t)).toBe(true)
    }
  })
  it('それ以外/不明はfalse', () => {
    expect(is2BoothType('GACHA')).toBe(false)
    expect(is2BoothType(null)).toBe(false)
    expect(is2BoothType(undefined)).toBe(false)
  })
})
