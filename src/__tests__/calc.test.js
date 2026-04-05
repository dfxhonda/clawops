import { describe, it, expect } from 'vitest'
import {
  calcSales,
  calcPayoutRate,
  calcMeterDiff,
  validateTransfer,
  checkInventoryDiff,
  hasRequiredRole,
  isDuplicateSubmission,
  isToday,
  calcInventoryStats,
} from '../services/calc'

// ============================================
// calcSales
// ============================================
describe('calcSales', () => {
  it('正常: IN差分 × 単価', () => {
    expect(calcSales(150, 100, 100)).toBe(5000)
  })
  it('単価指定なしでデフォルト100', () => {
    expect(calcSales(110, 100)).toBe(1000)
  })
  it('差分が負なら0', () => {
    expect(calcSales(50, 100, 100)).toBe(0)
  })
  it('null値は0扱い', () => {
    expect(calcSales(null, null, 100)).toBe(0)
  })
})

// ============================================
// calcPayoutRate
// ============================================
describe('calcPayoutRate', () => {
  it('正常: OUT差分 / IN差分', () => {
    expect(calcPayoutRate(200, 100, 80, 50)).toBeCloseTo(0.3)
  })
  it('IN差分0なら0', () => {
    expect(calcPayoutRate(100, 100, 80, 50)).toBe(0)
  })
  it('IN差分負なら0', () => {
    expect(calcPayoutRate(50, 100, 80, 50)).toBe(0)
  })
})

// ============================================
// calcMeterDiff
// ============================================
describe('calcMeterDiff', () => {
  it('通常の差分', () => {
    expect(calcMeterDiff(500, 200)).toBe(300)
  })
  it('桁あふれ: 7桁メーターで9999990→30は40', () => {
    expect(calcMeterDiff(30, 9999990, 7)).toBe(40)
  })
  it('null入力はnull', () => {
    expect(calcMeterDiff(null, 100)).toBeNull()
    expect(calcMeterDiff(100, null)).toBeNull()
  })
  it('数値でない文字列はnull', () => {
    expect(calcMeterDiff('abc', 100)).toBeNull()
  })
  it('文字列数値は正常処理', () => {
    expect(calcMeterDiff('500', '200')).toBe(300)
  })
})

// ============================================
// validateTransfer
// ============================================
describe('validateTransfer', () => {
  it('正常な移動', () => {
    const result = validateTransfer({ fromQuantity: 10, transferQuantity: 5 })
    expect(result.valid).toBe(true)
  })
  it('在庫不足', () => {
    const result = validateTransfer({ fromQuantity: 3, transferQuantity: 5 })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/在庫不足/)
  })
  it('数量0は不正', () => {
    const result = validateTransfer({ fromQuantity: 10, transferQuantity: 0 })
    expect(result.valid).toBe(false)
  })
  it('負数は不正', () => {
    const result = validateTransfer({ fromQuantity: 10, transferQuantity: -1 })
    expect(result.valid).toBe(false)
  })
})

// ============================================
// checkInventoryDiff
// ============================================
describe('checkInventoryDiff', () => {
  it('一致', () => {
    expect(checkInventoryDiff(10, 10)).toEqual({ status: 'match', diff: 0 })
  })
  it('不足', () => {
    expect(checkInventoryDiff(10, 7)).toEqual({ status: 'shortage', diff: -3 })
  })
  it('過剰', () => {
    expect(checkInventoryDiff(10, 12)).toEqual({ status: 'excess', diff: 2 })
  })
})

// ============================================
// hasRequiredRole
// ============================================
describe('hasRequiredRole', () => {
  it('admin は全ロールを満たす', () => {
    expect(hasRequiredRole('admin', 'admin')).toBe(true)
    expect(hasRequiredRole('admin', 'staff')).toBe(true)
  })
  it('staff は admin を満たさない', () => {
    expect(hasRequiredRole('staff', 'admin')).toBe(false)
  })
  it('manager は patrol を満たす', () => {
    expect(hasRequiredRole('manager', 'patrol')).toBe(true)
  })
  it('patrol は manager を満たさない', () => {
    expect(hasRequiredRole('patrol', 'manager')).toBe(false)
  })
  it('未知ロールは0扱い', () => {
    expect(hasRequiredRole('unknown', 'staff')).toBe(false)
  })
})

// ============================================
// isDuplicateSubmission
// ============================================
describe('isDuplicateSubmission', () => {
  it('初回送信はfalse', () => {
    expect(isDuplicateSubmission(null)).toBe(false)
  })
  it('クールダウン内はtrue', () => {
    expect(isDuplicateSubmission(Date.now() - 1000, 3000)).toBe(true)
  })
  it('クールダウン後はfalse', () => {
    expect(isDuplicateSubmission(Date.now() - 5000, 3000)).toBe(false)
  })
})

// ============================================
// isToday
// ============================================
describe('isToday', () => {
  it('今日の日付で始まる文字列はtrue', () => {
    expect(isToday('2026-04-05T10:00:00Z', '2026-04-05')).toBe(true)
  })
  it('昨日の日付はfalse', () => {
    expect(isToday('2026-04-04T23:59:59Z', '2026-04-05')).toBe(false)
  })
  it('空文字列はfalse', () => {
    expect(isToday('', '2026-04-05')).toBe(false)
  })
  it('nullはfalse', () => {
    expect(isToday(null, '2026-04-05')).toBe(false)
  })
})

// ============================================
// calcInventoryStats
// ============================================
describe('calcInventoryStats', () => {
  it('空データで集計', () => {
    const result = calcInventoryStats({ locations: [], stocks: [], movements: [] })
    expect(result.locationCount).toBe(0)
    expect(result.staffStockTotal).toBe(0)
    expect(result.locStockTotal).toBe(0)
    expect(result.todayMovements).toBe(0)
    expect(result.totalMovements).toBe(0)
  })
  it('正常データで集計', () => {
    const result = calcInventoryStats({
      locations: [
        { id: '1', parent_location_id: null },
        { id: '2', parent_location_id: '1' },
      ],
      stocks: [
        { owner_type: 'staff', quantity: 5 },
        { owner_type: 'staff', quantity: 3 },
        { owner_type: 'location', quantity: 10 },
      ],
      movements: [
        { created_at: new Date().toISOString() },
        { created_at: '2020-01-01T00:00:00Z' },
      ],
    })
    expect(result.locationCount).toBe(1)
    expect(result.subLocationCount).toBe(1)
    expect(result.staffStockItems).toBe(2)
    expect(result.staffStockTotal).toBe(8)
    expect(result.locStockItems).toBe(1)
    expect(result.locStockTotal).toBe(10)
    expect(result.todayMovements).toBe(1)
    expect(result.totalMovements).toBe(2)
  })
})
