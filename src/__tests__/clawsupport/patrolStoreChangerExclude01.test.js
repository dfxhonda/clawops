// SPEC-PATROL-STORE-HEADER-4FIX-01 FIX_4: changer ブースを doneCnt/totalCnt 母数から除外
import { describe, it, expect } from 'vitest'

// PatrolStorePage の isChanger/doneCnt/totalCnt ロジックを純関数として抽出して検証。
// changer は coin_changer_events に直行し booth_code を持たないため todayMap に乗らない
// (DIAG-PATROL-DONE-COUNT-OFF-BY-ONE-01)。母数に含めると永遠に totalCnt-1 で止まる。
function computeDoneTotals(machines, todayMap) {
  const isChanger = m =>
    (Array.isArray(m.machine_models)
      ? m.machine_models[0]?.type_id
      : m.machine_models?.type_id) === 'changer'
  const changerBoothCodes = new Set(
    machines.filter(isChanger).flatMap(m => m.booths.map(b => b.booth_code))
  )
  const doneCnt = Object.keys(todayMap).filter(bc => !changerBoothCodes.has(bc)).length
  const totalCnt = machines.filter(m => !isChanger(m)).reduce((s, m) => s + m.booths.length, 0)
  return { doneCnt, totalCnt }
}

const MACHINES = [
  {
    machine_code: 'KOS01-M01',
    machine_models: { type_id: 'crane' },
    booths: [{ booth_code: 'KOS01-M01-B01' }, { booth_code: 'KOS01-M01-B02' }],
  },
  {
    machine_code: 'KOS01-M02',
    machine_models: { type_id: 'crane' },
    booths: [{ booth_code: 'KOS01-M02-B01' }],
  },
  {
    machine_code: 'KOS01-M12',
    machine_models: { type_id: 'changer' },
    booths: [{ booth_code: 'KOS01-M12-B01' }],
  },
]

describe('SPEC-PATROL-STORE-HEADER-4FIX-01 FIX_4 changer exclusion', () => {
  it('when_all_non_changer_booths_in_todayMap_should_doneCnt_equal_totalCnt', () => {
    const todayMap = {
      'KOS01-M01-B01': true,
      'KOS01-M01-B02': true,
      'KOS01-M02-B01': true,
    }
    const { doneCnt, totalCnt } = computeDoneTotals(MACHINES, todayMap)
    expect(totalCnt).toBe(3)
    expect(doneCnt).toBe(3)
  })

  it('when_changer_booth_in_todayMap_should_not_count_it_in_doneCnt', () => {
    const todayMap = {
      'KOS01-M01-B01': true,
      'KOS01-M01-B02': true,
      'KOS01-M02-B01': true,
      'KOS01-M12-B01': true,
    }
    const { doneCnt, totalCnt } = computeDoneTotals(MACHINES, todayMap)
    expect(totalCnt).toBe(3)
    expect(doneCnt).toBe(3)
  })

  it('when_no_non_changer_booths_done_should_doneCnt_be_zero', () => {
    const { doneCnt, totalCnt } = computeDoneTotals(MACHINES, {})
    expect(totalCnt).toBe(3)
    expect(doneCnt).toBe(0)
  })

  it('when_machine_models_is_array_should_read_first_element_type_id', () => {
    const machines = [
      {
        machine_code: 'KOS01-M99',
        machine_models: [{ type_id: 'changer', model_name: 'テスト' }],
        booths: [{ booth_code: 'KOS01-M99-B01' }],
      },
      {
        machine_code: 'KOS01-M01',
        machine_models: [{ type_id: 'crane' }],
        booths: [{ booth_code: 'KOS01-M01-B01' }],
      },
    ]
    const todayMap = { 'KOS01-M01-B01': true }
    const { doneCnt, totalCnt } = computeDoneTotals(machines, todayMap)
    expect(totalCnt).toBe(1)
    expect(doneCnt).toBe(1)
  })
})
