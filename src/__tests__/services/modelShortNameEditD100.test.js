// SPEC-MODEL-SHORTNAME-EDIT-01 (D-100): machine_models.short_name の編集UI配線 (masters.js + ModelList.jsx)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

let mockSupabase
vi.mock('../../lib/supabase', () => ({ get supabase() { return mockSupabase } }))

beforeEach(() => {
  mockSupabase = {
    from: vi.fn(() => {
      const chain = {
        select: vi.fn(() => Object.assign(Promise.resolve({ data: [], error: null }), chain)),
        order:  vi.fn(() => Object.assign(Promise.resolve({ data: [], error: null }), chain)),
      }
      return chain
    }),
    auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: 'u' } } }, error: null })) },
  }
})

const { getMachineModels, addMachineModel, updateMachineModel } = await import('../../services/masters')

function modelChainCapturing(op, sink) {
  const ret = { data: { model_id: 'mid', model_name: 'M' }, error: null }
  const chain = {
    [op]:   vi.fn(row => { sink.payload = row; return Object.assign(Promise.resolve(ret), chain) }),
    eq:     vi.fn(() => Object.assign(Promise.resolve(ret), chain)),
    select: vi.fn(() => Object.assign(Promise.resolve(ret), chain)),
    single: vi.fn(() => Promise.resolve(ret)),
  }
  chain.then = cb => Promise.resolve(ret).then(cb)
  return chain
}
function auditChain() {
  const chain = {
    insert: vi.fn(() => Object.assign(Promise.resolve({ data: null, error: null }), chain)),
    select: vi.fn(() => Object.assign(Promise.resolve({ data: null, error: null }), chain)),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  }
  chain.then = cb => Promise.resolve({ data: null, error: null }).then(cb)
  return chain
}

describe('AC3: getMachineModels が short_name を SELECT する', () => {
  it('select 引数に short_name が含まれる (無いと画面に出ない)', async () => {
    const chain = {
      select: vi.fn(() => Object.assign(Promise.resolve({ data: [], error: null }), chain)),
      order:  vi.fn(() => Object.assign(Promise.resolve({ data: [], error: null }), chain)),
    }
    mockSupabase.from = vi.fn(() => chain)
    await getMachineModels()
    expect(chain.select.mock.calls[0][0]).toContain('short_name')
  })
})

describe('AC1/AC4: addMachineModel が short_name を通す (空→null)', () => {
  it('short_name 入力あり → insert payload に載る', async () => {
    const sink = {}
    const mc = modelChainCapturing('insert', sink)
    const ac = auditChain()
    mockSupabase.from = vi.fn(t => t === 'machine_models' ? mc : ac)
    await addMachineModel({ model_name: 'M', type_id: 'crane', short_name: 'バズクレDX' })
    expect(sink.payload.short_name).toBe('バズクレDX')
  })
  it('short_name 空 → null (必須バリデーションなし、既存保存フロー不変)', async () => {
    const sink = {}
    const mc = modelChainCapturing('insert', sink)
    const ac = auditChain()
    mockSupabase.from = vi.fn(t => t === 'machine_models' ? mc : ac)
    await addMachineModel({ model_name: 'M', type_id: 'crane', short_name: '' })
    expect(sink.payload.short_name).toBeNull()
  })
  it('short_name 未指定 → null (undefined でも壊れない)', async () => {
    const sink = {}
    const mc = modelChainCapturing('insert', sink)
    const ac = auditChain()
    mockSupabase.from = vi.fn(t => t === 'machine_models' ? mc : ac)
    await addMachineModel({ model_name: 'M', type_id: 'crane' })
    expect(sink.payload.short_name).toBeNull()
  })
})

describe('AC1/AC2/AC4: updateMachineModel が short_name を通す', () => {
  it('short_name 更新 → update payload に載る', async () => {
    const sink = {}
    const mc = modelChainCapturing('update', sink)
    const ac = auditChain()
    mockSupabase.from = vi.fn(t => t === 'machine_models' ? mc : ac)
    await updateMachineModel('mid', { model_name: 'M', type_id: 'crane', short_name: 'ミニクレ' })
    expect(sink.payload.short_name).toBe('ミニクレ')
  })
  it('short_name 空 → null', async () => {
    const sink = {}
    const mc = modelChainCapturing('update', sink)
    const ac = auditChain()
    mockSupabase.from = vi.fn(t => t === 'machine_models' ? mc : ac)
    await updateMachineModel('mid', { model_name: 'M', type_id: 'crane', short_name: '' })
    expect(sink.payload.short_name).toBeNull()
  })
})

describe('AC1/AC2/AC3: ModelList.jsx UI 配線 (単票 + グリッド)', () => {
  const src = readFileSync(resolve(__dirname, '../../manesupport/pages/ModelList.jsx'), 'utf-8')
  it('EMPTY_FORM と openEdit に short_name (プリフィル素地)', () => {
    expect(src).toMatch(/EMPTY_FORM[\s\S]*short_name:\s*''/)
    expect(src).toContain("short_name:       m.short_name      || ''")
  })
  it('単票フォームに short_name 入力欄 (handleChange 経由)', () => {
    expect(src).toContain("handleChange('short_name'")
  })
  it('グリッド編集モードに 短縮名 列 (setGCell 経由 + ヘッダ)', () => {
    expect(src).toContain('短縮名')
    expect(src).toContain("setGCell(row.model_id, 'short_name'")
  })
  it('AC4安全: setGCell base に short_name シード (未編集行の null 上書き防止)', () => {
    // base に short_name を含むことで、別セルだけ編集→保存でも short_name が温存される
    expect(src).toMatch(/base = prev\[id\] \?\? \{[\s\S]*short_name:\s*row\?\.short_name/)
    expect(src).toMatch(/patch = \{[\s\S]*short_name:\s*ge\.short_name/)
  })
})
