// ============================================
// patrolCore source field tests (fix-05)
// 手入力 → source='manual', OCR起点 → source='ocr'
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockSupabase
vi.mock('../../lib/supabase', () => ({
  get supabase() { return mockSupabase },
}))
vi.mock('../../lib/auth/orgConstants', () => ({
  DFX_ORG_ID: 'test-org-id',
}))
vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}))
vi.mock('../../lib/errorCodes', () => ({
  ERR: { METER_001: 'ERR-METER-001', METER_002: 'ERR-METER-002', AUTH_001: 'ERR-AUTH-001' },
}))

const { savePatrolReading } = await import('../../services/patrolCore')

function makeMockSupabase() {
  const inserted = []

  function makeChain() {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      in: vi.fn(() => chain),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
      insert: vi.fn((payload) => {
        inserted.push({ ...payload })
        const sub = {
          select: vi.fn(() => sub),
          single: vi.fn(() =>
            Promise.resolve({ data: { reading_id: 'mock-id' }, error: null })
          ),
        }
        return sub
      }),
    }
    return chain
  }

  return {
    from: vi.fn(() => makeChain()),
    _inserted: inserted,
  }
}

beforeEach(() => {
  mockSupabase = makeMockSupabase()
})

const BASE_ARGS = {
  boothCode: 'TEST-B01',
  storeCode: 'S01',
  machineCode: 'M01',
  inMeter: '1000',
  outMeter: '1010',
  prizeStock: '100',
  prizeRestock: '0',
  staffId: 'STAFF01',
}

describe('patrolCore source field', () => {
  it('手入力保存 → source=manual', async () => {
    const res = await savePatrolReading({ ...BASE_ARGS, optionalPatch: {} })
    expect(res.ok).toBe(true)
    const row = mockSupabase._inserted[0]
    expect(row.source).toBe('manual')
  })

  it('OCR起点保存 (optionalPatch.source=ocr) → source=ocr', async () => {
    const res = await savePatrolReading({
      ...BASE_ARGS,
      optionalPatch: {
        source:         'ocr',
        photo_url:      'https://example.com/photo.jpg',
        input_method:   'ocr',
        ocr_confidence: 0.92,
      },
    })
    expect(res.ok).toBe(true)
    const row = mockSupabase._inserted[0]
    expect(row.source).toBe('ocr')
    expect(row.input_method).toBe('ocr')
    expect(row.photo_url).toBe('https://example.com/photo.jpg')
  })

  it('source=ocr でも input_method/photo_url/ocr_confidence は保持', async () => {
    const res = await savePatrolReading({
      ...BASE_ARGS,
      optionalPatch: {
        source:         'ocr',
        photo_url:      'https://example.com/x.jpg',
        input_method:   'ocr',
        ocr_confidence: 0.85,
      },
    })
    expect(res.ok).toBe(true)
    const row = mockSupabase._inserted[0]
    expect(row.ocr_confidence).toBe(0.85)
    expect(row.photo_url).toBe('https://example.com/x.jpg')
  })
})
