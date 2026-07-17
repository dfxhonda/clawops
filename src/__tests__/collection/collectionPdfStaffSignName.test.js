// @vitest-environment happy-dom
// SPEC-COLLECTION-PDF-STAFF-SIGN-NAME-01: staff署名欄に担当者名大書き
// SPEC-COLLECTION-STAFF-NAME-SEPARATION-01 (D-090): フォールバックは collection.collected_by_name (旧 updated_by 廃止)
// AC1: collectedByName undefined → collection.collected_by_name にフォールバック
// AC2: staffName を fontSize>=14 で大書き
// AC3: null/undefined の場合は 弊社担当 ラベルのみ (クラッシュなし)
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockText, mockSetFontSize, mockDoc } = vi.hoisted(() => {
  const mockText = vi.fn()
  const mockSetFontSize = vi.fn()
  const mockDoc = {
    setFontSize: mockSetFontSize,
    text: mockText,
    setDrawColor: vi.fn(),
    setFont: vi.fn(),
    line: vi.fn(),
    rect: vi.fn(),
    addPage: vi.fn(),
    addFileToVFS: vi.fn(),
    addFont: vi.fn(),
    addImage: vi.fn(),
    getImageProperties: vi.fn(() => ({ width: 100, height: 100 })),
  }
  return { mockText, mockSetFontSize, mockDoc }
})

vi.mock('jspdf', () => ({ jsPDF: vi.fn(function () { return mockDoc }) }))

vi.mock('../../collection/lib/imageUtil', () => ({
  fetchAsDataURL: vi.fn(url => Promise.resolve(`data:image/jpeg;base64,fake-${url}`)),
}))

import { buildCollectionSlip } from '../../collection/lib/collectionPdf'

const BASE = {
  collection: { collection_id: 'test-001', collected_at: '2026-06-21', collected_by_name: '本田', updated_by: 'STAFF-03' },
  store: { store_name: 'Test Store', store_name_official: 'Test Store Ltd' },
  booths: [],
  total: 10000,
  advanceTotal: 0,
  staffSignatureDataUrl: null,
  customerSignatureDataUrl: null,
  issuer: null,
}

beforeEach(() => { vi.clearAllMocks() })

describe('SPEC-COLLECTION-PDF-STAFF-SIGN-NAME-01 staff signature name rendering', () => {
  it('when_collectedByName_undefined_should_resolve_name_from_collection_collected_by_name', async () => {
    await buildCollectionSlip({ ...BASE, collectedByName: undefined })
    const textCalls = mockText.mock.calls.map(c => c[0])
    expect(textCalls).toContain('本田')
    // D-090: 監査カラム updated_by の値 (staffId) は担当欄に出さない
    expect(textCalls).not.toContain('STAFF-03')
  })

  it('when_collectedByName_provided_should_use_it_over_collected_by_name', async () => {
    await buildCollectionSlip({ ...BASE, collectedByName: '山田' })
    const textCalls = mockText.mock.calls.map(c => c[0])
    expect(textCalls).toContain('山田')
    expect(textCalls).not.toContain('本田')
  })

  it('when_name_present_should_render_with_fontSize_ge_14', async () => {
    await buildCollectionSlip({ ...BASE, collectedByName: '本田' })
    const largeSizes = mockSetFontSize.mock.calls.map(c => c[0]).filter(s => s >= 14)
    expect(largeSizes.length).toBeGreaterThan(0)
  })

  it('when_name_present_should_render_centered', async () => {
    await buildCollectionSlip({ ...BASE, collectedByName: '本田' })
    const centeredCall = mockText.mock.calls.find(c => c[0] === '本田' && c[3]?.align === 'center')
    expect(centeredCall).toBeDefined()
  })

  it('when_staffName_null_should_render_label_without_crash', async () => {
    await buildCollectionSlip({
      ...BASE,
      collectedByName: undefined,
      collection: { collection_id: 'test-001', collected_at: '2026-06-21', updated_by: null },
    })
    const textCalls = mockText.mock.calls.map(c => c[0])
    expect(textCalls).toContain('弊社担当')
  })

  it('when_staffName_null_should_not_render_null_or_undefined_as_text', async () => {
    await buildCollectionSlip({
      ...BASE,
      collectedByName: undefined,
      collection: { collection_id: 'test-001', collected_at: '2026-06-21', updated_by: null },
    })
    const textCalls = mockText.mock.calls.map(c => c[0])
    expect(textCalls).not.toContain('null')
    expect(textCalls).not.toContain('undefined')
  })

  it('when_collectedByName_set_updated_by_also_set_should_prefer_collectedByName', async () => {
    // collectedByName takes priority over updated_by
    await buildCollectionSlip({ ...BASE, collectedByName: '鈴木', collection: { ...BASE.collection, updated_by: '本田' } })
    const textCalls = mockText.mock.calls.map(c => c[0])
    expect(textCalls).toContain('鈴木')
    expect(textCalls).not.toContain('本田')
  })
})
