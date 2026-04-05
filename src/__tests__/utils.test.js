import { describe, it, expect } from 'vitest'
import { parseNum, isOldEnough, supName } from '../services/utils'

// ============================================
// parseNum
// ============================================
describe('parseNum', () => {
  it('通常の数値文字列', () => {
    expect(parseNum('123')).toBe(123)
  })
  it('カンマ付き数値', () => {
    expect(parseNum('1,234,567')).toBe(1234567)
  })
  it('小数', () => {
    expect(parseNum('3.14')).toBeCloseTo(3.14)
  })
  it('数値型はそのまま', () => {
    expect(parseNum(42)).toBe(42)
  })
  it('空文字列はNaN', () => {
    expect(parseNum('')).toBeNaN()
  })
  it('nullはNaN', () => {
    expect(parseNum(null)).toBeNaN()
  })
  it('undefinedはNaN', () => {
    expect(parseNum(undefined)).toBeNaN()
  })
  it('非数値文字列はNaN', () => {
    expect(parseNum('abc')).toBeNaN()
  })
})

// ============================================
// isOldEnough
// ============================================
describe('isOldEnough', () => {
  it('24時間以上前はtrue', () => {
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    expect(isOldEnough(old)).toBe(true)
  })
  it('1時間前はfalse', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    expect(isOldEnough(recent)).toBe(false)
  })
  it('nullはfalse', () => {
    expect(isOldEnough(null)).toBe(false)
  })
  it('不正な日付はfalse', () => {
    expect(isOldEnough('not-a-date')).toBe(false)
  })
})

// ============================================
// supName
// ============================================
describe('supName', () => {
  it('既知のサプライヤーコード', () => {
    expect(supName('SGP')).toBe('景品フォーム')
    expect(supName('PCH')).toBe('ピーチトイ')
  })
  it('未知のコードはそのまま返す', () => {
    expect(supName('XYZ')).toBe('XYZ')
  })
  it('空文字列は空文字列', () => {
    expect(supName('')).toBe('')
  })
  it('nullは空文字列', () => {
    expect(supName(null)).toBe('')
  })
})
