import { describe, it, expect } from 'vitest'
import { fmtYen, fmtNum, fmtDiff, fmtRate } from '../utils/format'

describe('fmtYen', () => {
  it('null → —', () => { expect(fmtYen(null)).toBe('—') })
  it('undefined → —', () => { expect(fmtYen(undefined)).toBe('—') })
  it('空文字 → —', () => { expect(fmtYen('')).toBe('—') })
  it('NaN文字列 → —', () => { expect(fmtYen('abc')).toBe('—') })
  it('整数', () => { expect(fmtYen(1000)).toBe('¥1,000') })
  it('文字列数値', () => { expect(fmtYen('2500')).toBe('¥2,500') })
  it('負数', () => { expect(fmtYen(-500)).toBe('¥-500') })
  it('0', () => { expect(fmtYen(0)).toBe('¥0') })
  it('小数は四捨五入', () => { expect(fmtYen(1234.6)).toBe('¥1,235') })
})

describe('fmtNum', () => {
  it('null → —', () => { expect(fmtNum(null)).toBe('—') })
  it('空文字 → —', () => { expect(fmtNum('')).toBe('—') })
  it('NaN文字列 → —', () => { expect(fmtNum('xyz')).toBe('—') })
  it('正数', () => { expect(fmtNum(1234)).toBe('1,234') })
  it('文字列数値', () => { expect(fmtNum('9876')).toBe('9,876') })
  it('負数', () => { expect(fmtNum(-42)).toBe('-42') })
  it('0', () => { expect(fmtNum(0)).toBe('0') })
})

describe('fmtDiff', () => {
  it('null → —', () => { expect(fmtDiff(null)).toBe('—') })
  it('正数は+付き', () => { expect(fmtDiff(5)).toBe('+5') })
  it('0は+付き', () => { expect(fmtDiff(0)).toBe('+0') })
  it('負数は-付き', () => { expect(fmtDiff(-3)).toBe('-3') })
})

describe('fmtRate', () => {
  it('null → —', () => { expect(fmtRate(null)).toBe('—') })
  it('数値 → N.N%', () => { expect(fmtRate(12.3)).toBe('12.3%') })
  it('0 → 0.0%', () => { expect(fmtRate(0)).toBe('0.0%') })
})
