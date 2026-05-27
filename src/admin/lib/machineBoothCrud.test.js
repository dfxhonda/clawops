// @vitest-environment node
// J-ADMIN-MACHINE-BOOTH-CRUD-01: 自動採番ロジックの単体テスト (TDD 先行)
import { describe, it, expect } from 'vitest'
import { nextMachineCode, nextBoothCode, nextBoothNumber } from './machineBoothCrud'

describe('nextMachineCode', () => {
  it('when_no_machines_should_return_M01', () => {
    expect(nextMachineCode('KOS01', [])).toBe('KOS01-M01')
  })

  it('when_max_is_M11_should_return_M12_zero_padded', () => {
    const codes = ['KOS01-M01', 'KOS01-M02', 'KOS01-M10', 'KOS01-M11']
    expect(nextMachineCode('KOS01', codes)).toBe('KOS01-M12')
  })

  it('when_only_other_store_codes_present_should_return_M01', () => {
    expect(nextMachineCode('KOS01', ['KKY01-M03', 'KKY01-M04'])).toBe('KOS01-M01')
  })

  it('when_max_below_10_should_keep_two_digit_pad', () => {
    expect(nextMachineCode('ABC99', ['ABC99-M03'])).toBe('ABC99-M04')
  })
})

describe('nextBoothCode', () => {
  it('when_no_booths_should_return_B01', () => {
    expect(nextBoothCode('KKY01-M03', [])).toBe('KKY01-M03-B01')
  })

  it('when_max_is_B04_should_return_B05_zero_padded', () => {
    const codes = ['KKY01-M03-B01', 'KKY01-M03-B02', 'KKY01-M03-B04']
    expect(nextBoothCode('KKY01-M03', codes)).toBe('KKY01-M03-B05')
  })

  it('when_other_machine_booths_present_should_ignore_them', () => {
    expect(nextBoothCode('KKY01-M03', ['KKY01-M02-B09'])).toBe('KKY01-M03-B01')
  })
})

describe('nextBoothNumber', () => {
  it('when_no_booths_should_return_1', () => {
    expect(nextBoothNumber([])).toBe(1)
  })

  it('when_max_booth_number_is_4_should_return_5', () => {
    expect(nextBoothNumber([{ booth_number: 1 }, { booth_number: 4 }, { booth_number: 2 }])).toBe(5)
  })
})
