// @vitest-environment node
// 巡回保存ゲート: INのみで保存可、OUT/在庫は任意 (IN専用ライド機の保存不可バグ回帰防止)
import { describe, it, expect } from 'vitest'
import { patrolCanSave } from './patrolCanSave'

describe('patrolCanSave', () => {
  it('when_in_only_should_true (OUT/在庫が無くても保存可)', () => {
    expect(patrolCanSave('86470')).toBe(true)
  })
  it('when_in_empty_should_false', () => {
    expect(patrolCanSave('')).toBe(false)
  })
  it('when_in_null_should_false', () => {
    expect(patrolCanSave(null)).toBe(false)
    expect(patrolCanSave(undefined)).toBe(false)
  })
})
