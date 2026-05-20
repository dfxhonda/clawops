// ============================================
// patrolCore source field tests (fix-05)
// 手入力 → source='manual', OCR起点 → source='ocr'
// + savePatrolReading 主要パスのブランチカバレッジ
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockSupabase
let _orgId = 'test-org-id'

vi.mock('../../lib/supabase', () => ({
  get supabase() { return mockSupabase },
}))
vi.mock('../../lib/auth/orgConstants', () => ({
  get DFX_ORG_ID() { return _orgId },
}))
vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}))
vi.mock('../../lib/errorCodes', () => ({
  ERR: { METER_001: 'ERR-METER-001', METER_002: 'ERR-METER-002', AUTH_001: 'ERR-AUTH-001' },
}))

const { savePatrolReading, classifyEntryType, getTodayReadingsMap, getLastReadingForBooth } =
  await import('../../services/patrolCore')

function makeMockSupabase(existingPatrol = null) {
  const inserted = []
  const updated  = []

  function makeChain() {
    const chain = {
      select:      vi.fn(() => chain),
      eq:          vi.fn(() => chain),
      order:       vi.fn(() => chain),
      limit:       vi.fn(() => chain),
      in:          vi.fn(() => chain),
      maybeSingle: vi.fn(() => Promise.resolve({ data: existingPatrol })),
      insert: vi.fn((payload) => {
        inserted.push({ ...payload })
        const sub = {
          select: vi.fn(() => sub),
          single: vi.fn(() =>
            Promise.resolve({ data: { reading_id: payload.reading_id ?? 'mock-id' }, error: null })
          ),
        }
        return sub
      }),
      update: vi.fn((patch) => {
        updated.push({ ...patch })
        return { eq: vi.fn(() => Promise.resolve({ error: null })) }
      }),
    }
    return chain
  }

  return {
    from: vi.fn(() => makeChain()),
    _inserted: inserted,
    _updated: updated,
  }
}

beforeEach(() => {
  _orgId = 'test-org-id'
  mockSupabase = makeMockSupabase()
})

const BASE_ARGS = {
  boothCode:    'TEST-B01',
  storeCode:    'S01',
  machineCode:  'M01',
  inMeter:      '1000',
  outMeter:     '1010',
  prizeStock:   '100',
  prizeRestock: '0',
  staffId:      'STAFF01',
}

// ─── source field ───────────────────────────────────────────

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

  it('source=ocr でも ocr_confidence は保持', async () => {
    const res = await savePatrolReading({
      ...BASE_ARGS,
      optionalPatch: { source: 'ocr', photo_url: 'https://x.jpg', input_method: 'ocr', ocr_confidence: 0.85 },
    })
    expect(res.ok).toBe(true)
    expect(mockSupabase._inserted[0].ocr_confidence).toBe(0.85)
  })
})

// ─── AUTH guard ──────────────────────────────────────────────

describe('AUTH guard', () => {
  it('DFX_ORG_ID 未設定 → AUTH_001 エラー', async () => {
    _orgId = ''
    const res = await savePatrolReading({ ...BASE_ARGS })
    expect(res.ok).toBe(false)
    expect(res.errCode).toBe('ERR-AUTH-001')
  })
})

// ─── entryType=replace / collection ─────────────────────────

describe('entryType replace/collection → INSERT', () => {
  it('replace → 新規INSERT、組織ID付き', async () => {
    const res = await savePatrolReading({ ...BASE_ARGS, entryType: 'replace', optionalPatch: {} })
    expect(res.ok).toBe(true)
    expect(res.inserted).toBe(true)
    expect(mockSupabase._inserted[0].entry_type).toBe('replace')
    expect(mockSupabase._inserted[0].organization_id).toBe('test-org-id')
  })

  it('collection → 新規INSERT', async () => {
    const res = await savePatrolReading({ ...BASE_ARGS, entryType: 'collection', optionalPatch: {} })
    expect(res.ok).toBe(true)
    expect(res.inserted).toBe(true)
    expect(mockSupabase._inserted[0].entry_type).toBe('collection')
  })
})

// ─── existing patrol record → UPDATE / skip ──────────────────

describe('既存patrolレコードあり', () => {
  const existing = {
    reading_id: 'exist-id', in_meter: 1000, out_meter: 1010,
    prize_stock_count: 100, prize_restock_count: 0,
  }

  it('値変化あり → UPDATE', async () => {
    mockSupabase = makeMockSupabase(existing)
    const res = await savePatrolReading({ ...BASE_ARGS, inMeter: '2000', optionalPatch: {} })
    expect(res.ok).toBe(true)
    expect(res.updated).toBe(true)
  })

  it('値変化なし → skipped', async () => {
    mockSupabase = makeMockSupabase(existing)
    const res = await savePatrolReading({ ...BASE_ARGS, optionalPatch: {} })
    expect(res.ok).toBe(true)
    expect(res.skipped).toBe(true)
  })
})

// ─── normalizeOptionalPatch branches ────────────────────────

describe('optionalPatch 正規化', () => {
  it('空文字は null に変換', async () => {
    const res = await savePatrolReading({ ...BASE_ARGS, optionalPatch: { prize_name: '' } })
    expect(res.ok).toBe(true)
    const row = mockSupabase._inserted[0]
    expect(row.prize_name).toBeNull()
  })

  it('null は null のまま', async () => {
    const res = await savePatrolReading({ ...BASE_ARGS, optionalPatch: { prize_name: null } })
    expect(res.ok).toBe(true)
    const row = mockSupabase._inserted[0]
    expect(row.prize_name).toBeNull()
  })
})

// ─── defaultsFromPrev → INSERT payload merge ─────────────────

describe('defaultsFromPrev merge', () => {
  it('prevから prize_name を引き継ぐ', async () => {
    const res = await savePatrolReading({
      ...BASE_ARGS,
      optionalPatch:    {},
      defaultsFromPrev: { prize_name: '旧景品A', prize_id: 'p1', set_a: '3' },
    })
    expect(res.ok).toBe(true)
    const row = mockSupabase._inserted[0]
    expect(row.prize_name).toBe('旧景品A')
    expect(row.set_a).toBe('3')
  })
})

// ─── classifyEntryType ───────────────────────────────────────

describe('classifyEntryType', () => {
  it('isCollection=true → collection', () => {
    expect(classifyEntryType({ prev: null, next: {}, isCollection: true })).toBe('collection')
  })
  it('prev=null → patrol', () => {
    expect(classifyEntryType({ prev: null, next: { inMeter: '100', outMeter: '100' } })).toBe('patrol')
  })
  it('メーター変化 → patrol', () => {
    const prev = { in_meter: 100, out_meter: 100, prize_name: 'A', set_a: '1', set_c: '', set_l: '', set_r: '', set_o: '' }
    expect(classifyEntryType({ prev, next: { inMeter: '200', outMeter: '100', prizeName: 'A', setA: '1', setC: '', setL: '', setR: '', setO: '' } })).toBe('patrol')
  })
  it('景品変更 → replace', () => {
    const prev = { in_meter: 100, out_meter: 100, prize_name: 'A', set_a: '', set_c: '', set_l: '', set_r: '', set_o: '' }
    expect(classifyEntryType({ prev, next: { inMeter: '100', outMeter: '100', prizeName: 'B', setA: '', setC: '', setL: '', setR: '', setO: '' } })).toBe('replace')
  })
  it('設定変更 → replace', () => {
    const prev = { in_meter: 100, out_meter: 100, prize_name: 'A', set_a: '1', set_c: '', set_l: '', set_r: '', set_o: '' }
    expect(classifyEntryType({ prev, next: { inMeter: '100', outMeter: '100', prizeName: 'A', setA: '2', setC: '', setL: '', setR: '', setO: '' } })).toBe('replace')
  })
  it('変化なし → patrol', () => {
    const prev = { in_meter: 100, out_meter: 100, prize_name: 'A', set_a: '1', set_c: '', set_l: '', set_r: '', set_o: '' }
    expect(classifyEntryType({ prev, next: { inMeter: '100', outMeter: '100', prizeName: 'A', setA: '1', setC: '', setL: '', setR: '', setO: '' } })).toBe('patrol')
  })
})

// ─── getTodayReadingsMap ──────────────────────────────────────

describe('getTodayReadingsMap', () => {
  it('空配列 → 空オブジェクト', async () => {
    const result = await getTodayReadingsMap([])
    expect(result).toEqual({})
  })

  it('コード一覧を渡すとmapを返す', async () => {
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(function() { return this }),
        in:     vi.fn(function() { return this }),
        eq:     vi.fn(function() { return this }),
        then: (resolve) => resolve({ data: [{ booth_code: 'B01', reading_id: 'r1', read_time: 't1' }] }),
      })),
    }
    const result = await getTodayReadingsMap(['B01'])
    expect(result['B01']).toEqual({ readingId: 'r1', readTime: 't1' })
  })
})

// ─── getLastReadingForBooth ───────────────────────────────────

describe('getLastReadingForBooth', () => {
  it('レコードなし → null', async () => {
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(function() { return this }),
        eq:     vi.fn(function() { return this }),
        order:  vi.fn(function() { return this }),
        limit:  vi.fn(function() { return this }),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
      })),
    }
    const result = await getLastReadingForBooth('B99')
    expect(result).toBeNull()
  })
})
