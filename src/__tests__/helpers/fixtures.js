// ============================================
// テストデータファクトリ
// 結合テスト用の定型データ生成
// ============================================

let seq = 0
const nextId = (prefix) => `${prefix}-${++seq}`

export function resetFixtureIds() { seq = 0 }

/** prize_stocks 行（prize_masters join含む） */
export function makeStockRecord(overrides = {}) {
  return {
    stock_id: nextId('stk'),
    prize_id: 'PZ001',
    prize_masters: { prize_name: 'テスト景品A' },
    owner_type: 'location',
    owner_id: 'LOC01',
    quantity: 10,
    tags: '',
    updated_at: '2026-04-01T00:00:00Z',
    updated_by: 'STAFF01',
    last_counted_at: '',
    last_counted_by: '',
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

/** meter_readings 行 */
export function makeMeterReading(overrides = {}) {
  return {
    reading_id: nextId('rd'),
    booth_id: 'B001',
    full_booth_code: 'S01-M01-B001',
    read_time: '2026-04-01T12:00:00Z',
    in_meter: 1000,
    out_meter: 50,
    prize_restock_count: 0,
    prize_stock_count: 0,
    prize_name: 'テスト景品',
    set_a: '', set_c: '', set_l: '', set_r: '', set_o: '',
    note: '',
    source: 'manual',
    ...overrides,
  }
}

/** stock_movements 行 */
export function makeMovementRecord(overrides = {}) {
  return {
    movement_id: nextId('mv'),
    prize_id: 'PZ001',
    movement_type: 'transfer',
    from_owner_type: 'location',
    from_owner_id: 'LOC01',
    to_owner_type: 'staff',
    to_owner_id: 'STAFF01',
    quantity: 5,
    note: '',
    reason: '',
    adjustment_reason: '',
    tracking_number: '',
    created_at: '2026-04-01T12:00:00Z',
    created_by: 'STAFF01',
    ...overrides,
  }
}

/** Supabase auth session */
export function makeSession(overrides = {}) {
  const meta = {
    staff_id: 'STAFF01',
    name: 'テスト太郎',
    role: 'admin',
    ...overrides.user_metadata,
  }
  return {
    access_token: 'mock-token-abc',
    refresh_token: 'mock-refresh',
    user: {
      id: 'user-uuid-001',
      user_metadata: meta,
      ...overrides.user,
    },
    ...overrides,
  }
}
