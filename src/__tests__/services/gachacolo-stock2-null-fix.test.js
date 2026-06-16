// SPEC-FIX-GACHACOLO-STOCK2-NULL-01
// Regression: stock_2/stock_3 were NULLed when zan='' (empty), even though 0 is a valid value.

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const patrolV2Src = readFileSync(resolve(__dirname, '../../services/patrolV2.js'), 'utf-8')
const usePatrolFormSrc = readFileSync(resolve(__dirname, '../../hooks/usePatrolForm.js'), 'utf-8')

describe('SPEC-FIX-GACHACOLO-STOCK2-NULL-01 usePatrolForm primary fix', () => {
  it('when_prevZan_is_null_should_produce_zero_string_not_empty', () => {
    // The ternary guard "prevZan != null ? ... : ''" must be gone
    expect(usePatrolFormSrc).not.toContain("prevZan != null ? String((prevZan")
    // Must always compute the sum
    expect(usePatrolFormSrc).toContain('zan: String((prevZan || 0) + (prevHo || 0))')
  })
})

describe('SPEC-FIX-GACHACOLO-STOCK2-NULL-01 _buildPayload secondary guard', () => {
  it('when_stock_2_zan_is_empty_string_should_default_to_0_not_null', () => {
    // Old: inp.outs[1].zan ? parseInt(...) : null
    // New: inp.outs[1].zan != null && inp.outs[1].zan !== '' ? parseInt(...) : 0
    expect(patrolV2Src).not.toMatch(/p\.stock_2\s*=\s*inp\.outs\[1\]\.zan\s*\?/)
    expect(patrolV2Src).toContain("p.stock_2 = inp.outs[1].zan != null && inp.outs[1].zan !== '' ? parseInt(inp.outs[1].zan) : 0")
  })

  it('when_stock_3_zan_is_empty_string_should_default_to_0_not_null', () => {
    expect(patrolV2Src).not.toMatch(/p\.stock_3\s*=\s*inp\.outs\[2\]\.zan\s*\?/)
    expect(patrolV2Src).toContain("p.stock_3 = inp.outs[2].zan != null && inp.outs[2].zan !== '' ? parseInt(inp.outs[2].zan) : 0")
  })
})

describe('SPEC-FIX-GACHACOLO-STOCK2-NULL-01 updatePatrolReading secondary guard', () => {
  it('when_update_stock_2_zan_is_empty_string_should_default_to_0_not_null', () => {
    expect(patrolV2Src).not.toMatch(/upd\.stock_2\s*=\s*formData\.outs\[1\]\.zan\s*\?/)
    expect(patrolV2Src).toContain("upd.stock_2 = formData.outs[1].zan != null && formData.outs[1].zan !== '' ? parseInt(formData.outs[1].zan) : 0")
  })

  it('when_update_stock_3_zan_is_empty_string_should_default_to_0_not_null', () => {
    expect(patrolV2Src).not.toMatch(/upd\.stock_3\s*=\s*formData\.outs\[2\]\.zan\s*\?/)
    expect(patrolV2Src).toContain("upd.stock_3 = formData.outs[2].zan != null && formData.outs[2].zan !== '' ? parseInt(formData.outs[2].zan) : 0")
  })
})

describe('SPEC-FIX-GACHACOLO-STOCK2-NULL-01 zan zero-value logic', () => {
  it('when_zan_is_zero_string_parseInt_produces_0_not_NaN', () => {
    // Sanity: '0' is truthy as a non-empty string, so parseInt('0')=0 is correct
    expect(parseInt('0')).toBe(0)
    expect(Number.isFinite(parseInt('0'))).toBe(true)
  })

  it('when_zan_is_empty_string_old_pattern_would_null_new_pattern_returns_0', () => {
    // Old pattern simulation
    const oldResult = ('' ? parseInt('') : null)
    expect(oldResult).toBeNull()
    // New pattern simulation
    const zan = ''
    const newResult = (zan != null && zan !== '') ? parseInt(zan) : 0
    expect(newResult).toBe(0)
  })

  it('when_zan_is_null_new_pattern_returns_0', () => {
    const zan = null
    const newResult = (zan != null && zan !== '') ? parseInt(zan) : 0
    expect(newResult).toBe(0)
  })

  it('when_zan_is_numeric_string_value_is_preserved', () => {
    const zan = '15'
    const newResult = (zan != null && zan !== '') ? parseInt(zan) : 0
    expect(newResult).toBe(15)
  })
})
