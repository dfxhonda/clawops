// @vitest-environment happy-dom
// SPEC-COLLECTION-PDF-RECEIPT-PACK-01: receipt grid packs photos with no gaps
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAddImage, mockDoc } = vi.hoisted(() => {
  const mockAddImage = vi.fn()
  const mockDoc = {
    setFontSize: vi.fn(), text: vi.fn(), setDrawColor: vi.fn(), setFont: vi.fn(),
    line: vi.fn(), rect: vi.fn(), addPage: vi.fn(), addFileToVFS: vi.fn(), addFont: vi.fn(),
    addImage: mockAddImage,
    getImageProperties: vi.fn(() => ({ width: 100, height: 100 })),
  }
  return { mockAddImage, mockDoc }
})

vi.mock('jspdf', () => ({ jsPDF: vi.fn(function () { return mockDoc }) }))

vi.mock('../../collection/lib/imageUtil', () => ({
  fetchAsDataURL: vi.fn(url => Promise.resolve(`data:image/jpeg;base64,fake-${url}`)),
}))

import { buildCollectionSlip } from '../../collection/lib/collectionPdf'

// Grid constants matching collectionPdf.js
const PT_TO_MM = 25.4 / 72
const RM = 20 * PT_TO_MM
const RG = 8 * PT_TO_MM
const COLS_GRID = 3
const ROWS_GRID = 4
const cellW = (210 - RM * 2 - RG * (COLS_GRID - 1)) / COLS_GRID
const cellH = (297 - RM * 2 - RG * (ROWS_GRID - 1)) / ROWS_GRID

const cellX = col => RM + col * (cellW + RG)
const cellY = row => RM + row * (cellH + RG)

const BASE = {
  collection: { collection_id: 'test-001', collected_at: '2026-06-21' },
  store: { store_name: 'Test Store', store_name_official: 'Test Store Ltd' },
  total: 10000,
  advanceTotal: 0,
  collectedByName: 'Tester',
  staffSignatureDataUrl: null,
  customerSignatureDataUrl: null,
  issuer: null,
}

function makeBooth(code, hasPhoto) {
  return {
    booth_code: code, machine_code: 'M1', machine_name: 'Machine 1', rental_code: 'R1',
    total: 100, advance_payment: 0, in_meter_current: 200, in_meter_prev: 100,
    receipt_photo_url: hasPhoto ? `http://example.com/${code}.jpg` : null,
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('SPEC-COLLECTION-PDF-RECEIPT-PACK-01 receipt grid packing', () => {
  it('when_mix_of_photo_and_no_photo_booths_should_pack_receipts_with_no_gaps', async () => {
    // booths: photo, NO PHOTO, photo, photo => 3 photos should land at cells 0,1,2
    const booths = [makeBooth('B01', true), makeBooth('B02', false), makeBooth('B03', true), makeBooth('B04', true)]
    await buildCollectionSlip({ ...BASE, booths })

    // addImage called exactly 3 times (one per photo booth)
    expect(mockAddImage.mock.calls).toHaveLength(3)

    // x-coordinates should be consecutive: col 0, col 1, col 2 (no gap at col 1)
    const xs = mockAddImage.mock.calls.map(c => c[2])
    expect(xs[0]).toBeCloseTo(cellX(0), 2)
    expect(xs[1]).toBeCloseTo(cellX(1), 2)
    expect(xs[2]).toBeCloseTo(cellX(2), 2)

    // all on the same row (row 0) since only 3 photos
    const ys = mockAddImage.mock.calls.map(c => c[3])
    expect(ys[0]).toBeCloseTo(cellY(0), 2)
    expect(ys[1]).toBeCloseTo(cellY(0), 2)
    expect(ys[2]).toBeCloseTo(cellY(0), 2)
  })

  it('when_no_photo_at_start_should_pack_remaining_photos_from_cell_0', async () => {
    // no-photo, no-photo, photo => photo should land at cell 0, not cell 2
    const booths = [makeBooth('B01', false), makeBooth('B02', false), makeBooth('B03', true)]
    await buildCollectionSlip({ ...BASE, booths })
    expect(mockAddImage.mock.calls).toHaveLength(1)
    expect(mockAddImage.mock.calls[0][2]).toBeCloseTo(cellX(0), 2)
  })

  it('when_no_booths_have_photos_should_not_call_addImage', async () => {
    const booths = [makeBooth('B01', false), makeBooth('B02', false)]
    await buildCollectionSlip({ ...BASE, booths })
    expect(mockAddImage.mock.calls).toHaveLength(0)
  })

  it('when_all_booths_have_photos_should_fill_consecutive_cells', async () => {
    const booths = [makeBooth('B01', true), makeBooth('B02', true), makeBooth('B03', true)]
    await buildCollectionSlip({ ...BASE, booths })
    expect(mockAddImage.mock.calls).toHaveLength(3)
    const xs = mockAddImage.mock.calls.map(c => c[2])
    expect(xs[0]).toBeCloseTo(cellX(0), 2)
    expect(xs[1]).toBeCloseTo(cellX(1), 2)
    expect(xs[2]).toBeCloseTo(cellX(2), 2)
  })
})
