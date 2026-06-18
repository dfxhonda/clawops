// SPEC-MODEL-MASTER-SUPERSET-01: width_mm/depth_mm/height_mm passthrough in masters.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockSupabase

vi.mock('../../lib/supabase', () => ({
  get supabase() { return mockSupabase },
}))

function makeChain(returnVal) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq:     vi.fn(() => chain),
    order:  vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(returnVal)),
    then:   (cb) => Promise.resolve(returnVal).then(cb),
  }
  return Object.assign(Promise.resolve(returnVal), chain)
}

beforeEach(() => {
  mockSupabase = {
    from: vi.fn(() => makeChain({ data: [], error: null })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: 'test-user' } } }, error: null })),
    },
  }
})

const { getMachineModels, addMachineModel, updateMachineModel } = await import('../../services/masters')

describe('SPEC-MODEL-MASTER-SUPERSET-01 dimension fields', () => {
  it('when_getMachineModels_called_should_select_width_mm_depth_mm_height_mm', async () => {
    const chain = {
      select: vi.fn(() => Object.assign(Promise.resolve({ data: [], error: null }), chain)),
      order: vi.fn(() => Object.assign(Promise.resolve({ data: [], error: null }), chain)),
    }
    mockSupabase.from = vi.fn(() => chain)

    await getMachineModels()

    expect(chain.select).toHaveBeenCalledOnce()
    const selectArg = chain.select.mock.calls[0][0]
    expect(selectArg).toContain('width_mm')
    expect(selectArg).toContain('depth_mm')
    expect(selectArg).toContain('height_mm')
    expect(selectArg).toContain('created_at')
  })

  it('when_addMachineModel_with_dimensions_should_pass_numeric_values', async () => {
    let modelInsertPayload = null
    const modelChain = {
      insert: vi.fn(row => { modelInsertPayload = row; return Object.assign(Promise.resolve({ data: { model_id: 'new-id', model_name: 'テスト機種' }, error: null }), modelChain) }),
      select: vi.fn(() => Object.assign(Promise.resolve({ data: { model_id: 'new-id', model_name: 'テスト機種' }, error: null }), modelChain)),
      single: vi.fn(() => Promise.resolve({ data: { model_id: 'new-id', model_name: 'テスト機種' }, error: null })),
    }
    modelChain.then = (cb) => Promise.resolve({ data: { model_id: 'new-id', model_name: 'テスト機種' }, error: null }).then(cb)

    const auditChain = {
      insert: vi.fn(() => Object.assign(Promise.resolve({ data: null, error: null }), auditChain)),
      select: vi.fn(() => Object.assign(Promise.resolve({ data: null, error: null }), auditChain)),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    }
    auditChain.then = (cb) => Promise.resolve({ data: null, error: null }).then(cb)

    mockSupabase.from = vi.fn(table =>
      table === 'machine_models' ? modelChain : auditChain
    )

    await addMachineModel({
      model_name: 'テスト機種',
      type_id: 'crane',
      width_mm: '900',
      depth_mm: '850',
      height_mm: '1800',
      power_w: '350',
    })

    expect(modelInsertPayload).not.toBeNull()
    expect(modelInsertPayload.width_mm).toBe(900)
    expect(modelInsertPayload.depth_mm).toBe(850)
    expect(modelInsertPayload.height_mm).toBe(1800)
  })

  it('when_addMachineModel_with_empty_dimensions_should_set_null', async () => {
    let modelInsertPayload = null
    const modelChain = {
      insert: vi.fn(row => { modelInsertPayload = row; return Object.assign(Promise.resolve({ data: { model_id: 'new-id2', model_name: 'テスト機種2' }, error: null }), modelChain) }),
      select: vi.fn(() => Object.assign(Promise.resolve({ data: { model_id: 'new-id2', model_name: 'テスト機種2' }, error: null }), modelChain)),
      single: vi.fn(() => Promise.resolve({ data: { model_id: 'new-id2', model_name: 'テスト機種2' }, error: null })),
    }
    modelChain.then = (cb) => Promise.resolve({ data: { model_id: 'new-id2', model_name: 'テスト機種2' }, error: null }).then(cb)
    const auditChain = { insert: vi.fn(() => Object.assign(Promise.resolve({ data: null, error: null }), auditChain2)), select: vi.fn(() => Object.assign(Promise.resolve({ data: null, error: null }), auditChain2)), single: vi.fn(() => Promise.resolve({ data: null, error: null })) }
    const auditChain2 = auditChain
    auditChain.then = (cb) => Promise.resolve({ data: null, error: null }).then(cb)
    mockSupabase.from = vi.fn(table => table === 'machine_models' ? modelChain : auditChain)

    await addMachineModel({
      model_name: 'テスト機種2',
      type_id: 'gacha',
      width_mm: '',
      depth_mm: '',
      height_mm: '',
    })

    expect(modelInsertPayload).not.toBeNull()
    expect(modelInsertPayload.width_mm).toBeNull()
    expect(modelInsertPayload.depth_mm).toBeNull()
    expect(modelInsertPayload.height_mm).toBeNull()
  })

  it('when_updateMachineModel_with_dimensions_should_pass_numeric_values', async () => {
    let modelUpdatePayload = null
    const modelChain = {
      update: vi.fn(row => { modelUpdatePayload = row; return Object.assign(Promise.resolve({ data: { model_id: 'model-123', model_name: '更新機種' }, error: null }), modelChain) }),
      eq:     vi.fn(() => Object.assign(Promise.resolve({ data: { model_id: 'model-123', model_name: '更新機種' }, error: null }), modelChain)),
      select: vi.fn(() => Object.assign(Promise.resolve({ data: { model_id: 'model-123', model_name: '更新機種' }, error: null }), modelChain)),
      single: vi.fn(() => Promise.resolve({ data: { model_id: 'model-123', model_name: '更新機種' }, error: null })),
    }
    modelChain.then = (cb) => Promise.resolve({ data: { model_id: 'model-123', model_name: '更新機種' }, error: null }).then(cb)
    const auditChain = { insert: vi.fn(() => Object.assign(Promise.resolve({ data: null, error: null }), auditChain)), select: vi.fn(() => Object.assign(Promise.resolve({ data: null, error: null }), auditChain)), single: vi.fn(() => Promise.resolve({ data: null, error: null })) }
    auditChain.then = (cb) => Promise.resolve({ data: null, error: null }).then(cb)
    mockSupabase.from = vi.fn(table => table === 'machine_models' ? modelChain : auditChain)

    await updateMachineModel('model-123', {
      model_name: '更新機種',
      type_id: 'crane',
      width_mm: '1000',
      depth_mm: '900',
      height_mm: '2000',
    })

    expect(modelUpdatePayload).not.toBeNull()
    expect(modelUpdatePayload.width_mm).toBe(1000)
    expect(modelUpdatePayload.depth_mm).toBe(900)
    expect(modelUpdatePayload.height_mm).toBe(2000)
  })
})
