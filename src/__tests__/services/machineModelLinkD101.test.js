// SPEC-MACHINE-MODEL-LINK-ADMIN-01 (D-101): 全店横断機械一覧・model_id紐付 (masters.js + MachineModelLinkPage.jsx)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

let mockSupabase
vi.mock('../../lib/supabase', () => ({ get supabase() { return mockSupabase } }))

beforeEach(() => {
  mockSupabase = { from: vi.fn(), auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: 'u' } } }, error: null })) } }
})

const { getAllMachinesForAdmin, updateMachineAdmin } = await import('../../services/masters')

// select→order→order チェーン (thenable)
function machinesChain(rows, capture) {
  const ret = { data: rows, error: null }
  const chain = {
    select: vi.fn(arg => { if (capture) capture.select = arg; return Object.assign(Promise.resolve(ret), chain) }),
    order:  vi.fn(() => Object.assign(Promise.resolve(ret), chain)),
    eq:     vi.fn((col, val) => { if (capture) (capture.eqs ??= []).push([col, val]); return Object.assign(Promise.resolve(ret), chain) }),
  }
  return chain
}
function modelsChain(models) {
  const ret = { data: models, error: null }
  const chain = { select: vi.fn(() => Object.assign(Promise.resolve(ret), chain)) }
  return chain
}

describe('AC1: getAllMachinesForAdmin 全店横断・非稼働含む・org無フィルタ', () => {
  it('is_active フィルタなし & organization_id フィルタなし & model JOIN', async () => {
    const cap = {}
    const mc = machinesChain([
      { machine_code: 'S1-M01', store_code: 'S1', model_id: 'md1', machine_name: 'A' },
      { machine_code: 'S1-M02', store_code: 'S1', model_id: null, machine_name: 'B' },
    ], cap)
    const mm = modelsChain([{ model_id: 'md1', model_name: 'バズクレ4', short_name: 'バズDX' }])
    mockSupabase.from = vi.fn(t => t === 'machines' ? mc : mm)

    const res = await getAllMachinesForAdmin()
    expect(cap.select).toBe('*')                         // 全カラム
    expect((cap.eqs ?? []).some(([c]) => c === 'is_active')).toBe(false)       // is_active 絞りなし
    expect((cap.eqs ?? []).some(([c]) => c === 'organization_id')).toBe(false) // org 絞りなし (RLS担保)
    expect(res[0].model_name).toBe('バズクレ4')          // JOIN 表示ラベル
    expect(res[0].short_name).toBe('バズDX')
    expect(res[1].model_name).toBeNull()                 // 未紐付けは null
    expect(res[1].short_name).toBeNull()
  })
})

describe('AC2/AC4/AC6: updateMachineAdmin ホワイトリスト + NOT NULL保護 + 監査列破棄', () => {
  function capchain(sink) {
    const before = { data: { machine_code: 'S1-M01', machine_name: '旧' }, error: null }
    const ret = { data: [{ machine_code: 'S1-M01' }], error: null }
    const chain = {
      select: vi.fn(() => Object.assign(Promise.resolve(before), chain)),
      update: vi.fn(u => { sink.upd = u; return Object.assign(Promise.resolve(ret), chain) }),
      eq:     vi.fn(() => Object.assign(Promise.resolve(ret), chain)),
      single: vi.fn(() => Promise.resolve(before)),
    }
    chain.then = cb => Promise.resolve(ret).then(cb)
    return chain
  }
  function audit() {
    const chain = { insert: vi.fn(() => Object.assign(Promise.resolve({ data: null, error: null }), chain)), select: vi.fn(() => Object.assign(Promise.resolve({ data: null, error: null }), chain)), single: vi.fn(() => Promise.resolve({ data: null, error: null })) }
    chain.then = cb => Promise.resolve({ data: null, error: null }).then(cb)
    return chain
  }

  it('AC2: model_id を UPDATE に載せる', async () => {
    const sink = {}; const mc = capchain(sink); const ac = audit()
    mockSupabase.from = vi.fn(t => t === 'machines' ? mc : ac)
    await updateMachineAdmin('S1-M01', { model_id: 'md9' })
    expect(sink.upd.model_id).toBe('md9')
  })

  it('AC4: machine_name は patch に含まれる時だけ更新 (model_id 単独更新では触らない)', async () => {
    const sink = {}; const mc = capchain(sink); const ac = audit()
    mockSupabase.from = vi.fn(t => t === 'machines' ? mc : ac)
    await updateMachineAdmin('S1-M01', { model_id: 'md9' })
    expect('machine_name' in sink.upd).toBe(false) // 自動上書きなし
  })

  it('AC6: machine_code/store_code/organization_id/監査列は破棄 (ホワイトリスト外)', async () => {
    const sink = {}; const mc = capchain(sink); const ac = audit()
    mockSupabase.from = vi.fn(t => t === 'machines' ? mc : ac)
    await updateMachineAdmin('S1-M01', { model_id: 'md9', machine_code: 'HACK', store_code: 'X', organization_id: 'org', updated_by: 'evil', created_at: 't' })
    expect('machine_code' in sink.upd).toBe(false)
    expect('store_code' in sink.upd).toBe(false)
    expect('organization_id' in sink.upd).toBe(false)
    expect('updated_by' in sink.upd).toBe(false)
    expect('created_at' in sink.upd).toBe(false)
  })

  it('NOT NULL列(meter_unit_price/out_meter_count)は空値では触らない', async () => {
    const sink = {}; const mc = capchain(sink); const ac = audit()
    mockSupabase.from = vi.fn(t => t === 'machines' ? mc : ac)
    await updateMachineAdmin('S1-M01', { meter_unit_price: '', out_meter_count: '', floor: '' })
    expect('meter_unit_price' in sink.upd).toBe(false) // 空→スキップ(既存温存)
    expect('out_meter_count' in sink.upd).toBe(false)
    expect(sink.upd.floor).toBeNull()                  // nullable text は空→null
  })

  it('数値列は Number 変換, is_active は boolean', async () => {
    const sink = {}; const mc = capchain(sink); const ac = audit()
    mockSupabase.from = vi.fn(t => t === 'machines' ? mc : ac)
    await updateMachineAdmin('S1-M01', { billing_order: '3', meter_unit_price: '120', is_active: false })
    expect(sink.upd.billing_order).toBe(3)
    expect(sink.upd.meter_unit_price).toBe(120)
    expect(sink.upd.is_active).toBe(false)
  })

  it('編集キーが無ければ UPDATE 発行しない (null 返し)', async () => {
    const sink = {}; const mc = capchain(sink); const ac = audit()
    mockSupabase.from = vi.fn(t => t === 'machines' ? mc : ac)
    const r = await updateMachineAdmin('S1-M01', { machine_code: 'X', organization_id: 'o' })
    expect(r).toBeNull()
    expect(mc.update).not.toHaveBeenCalled()
  })
})

describe('AC1/AC3/AC5/AC6: UI + 配線 (ソース検査)', () => {
  const page = readFileSync(resolve(__dirname, '../../manesupport/pages/MachineModelLinkPage.jsx'), 'utf-8')
  it('AC2 model ドロップダウンは model_name 表示', () => {
    expect(page).toContain('m.model_name')
    expect(page).toContain("setCell(code, 'model_id'")
  })
  it('AC3 short_name は機種マスタ参照で導出 (machines へコピーしない)', () => {
    expect(page).toContain('shortNameFor')
    expect(page).toMatch(/modelById\[mid\]\?\.short_name/)
  })
  it('AC5 詳細列トグルで資産/保守系カラムが編集可', () => {
    expect(page).toContain('DETAIL_COLS')
    for (const k of ['lease_monthly', 'acquisition_cost', 'maintenance_status', 'floor_area_m2']) expect(page).toContain(k)
    expect(page).toContain('showDetail')
  })
  it('AC5 行単位保存 + 一括保存 両方ある', () => {
    expect(page).toContain('saveRow')
    expect(page).toContain('saveAll')
    expect(page).toContain('updateMachineAdmin')
  })
  it('AC6 machine_code は読取専用(ro), 監査列は列定義に無い', () => {
    expect(page).toMatch(/machine_code',\s*label: '機械コード', type: 'ro'/)
    for (const k of ['organization_id', 'created_at', 'updated_by']) {
      expect(page.includes(`key: '${k}'`)).toBe(false)
    }
  })
  it('FORBIDDEN: organization_id フィルタを付けない', () => {
    expect(page).not.toContain('organization_id')
  })
  it('未紐付けのみトグル (138台作業用)', () => {
    expect(page).toContain('unlinkedOnly')
  })
  it('AdminTop メニュー + App ルート登録', () => {
    const top = readFileSync(resolve(__dirname, '../../manesupport/pages/AdminTop.jsx'), 'utf-8')
    expect(top).toContain('/admin/machine-links')
    expect(top).toContain('機械モデル紐付')
    const app = readFileSync(resolve(__dirname, '../../App.jsx'), 'utf-8')
    expect(app).toContain('/admin/machine-links')
    expect(app).toContain('MachineModelLinkPage')
  })
})
