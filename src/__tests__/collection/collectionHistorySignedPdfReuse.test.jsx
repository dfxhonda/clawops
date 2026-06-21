// @vitest-environment happy-dom
// SPEC-COLLECTION-SIGNED-PDF-REUSE-01: downloadPdf branching for signed PDF reuse
// AC1: signed+url → window.open(signed_pdf_url), buildCollectionSlip NOT called
// AC2: signed+no-url → fallback to buildCollectionSlip
// AC3: unsigned → buildCollectionSlip
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

const { mockBuildCollectionSlip } = vi.hoisted(() => ({
  mockBuildCollectionSlip: vi.fn(async () => ({ save: vi.fn(), output: vi.fn(() => new Blob()) })),
}))

vi.mock('../../services/collections', () => ({
  getCollectionHistory: vi.fn(),
  getCollectionDetail: vi.fn(),
  saveSignedPdf: vi.fn(),
  uploadCustomerSignature: vi.fn(),
}))

vi.mock('../../collection/lib/collectionPdf', () => ({
  buildCollectionSlip: mockBuildCollectionSlip,
  slipFileName: vi.fn(() => 'test.pdf'),
  ensureJpFont: vi.fn(async () => {}),
}))

vi.mock('../../collection/lib/imageUtil', () => ({
  fetchAsDataURL: vi.fn(async () => 'data:image/png;base64,mock'),
}))

vi.mock('../../collection/components/SignatureCanvas', () => ({
  default: vi.fn(() => null),
}))

import { getCollectionHistory, getCollectionDetail } from '../../services/collections'
import CollectionHistoryPage from '../../collection/CollectionHistoryPage'

const SIGNED_URL = 'https://gedx.supabase.co/storage/v1/object/public/signed-pdfs/test.pdf'
const COL_ID = 'TST01-20260621-01'

function mkRow(overrides = {}) {
  return {
    collection_id: COL_ID,
    store_name: 'テスト店',
    collected_at: '2026-06-21',
    status: 'confirmed',
    total: 10000,
    signed_pdf_url: null,
    customer_signed_at: null,
    ...overrides,
  }
}

function mkDetail(colOverrides = {}) {
  return {
    data: {
      collection: {
        collection_id: COL_ID,
        customer_signed_at: null,
        signed_pdf_url: null,
        staff_signature_url: null,
        customer_signature_url: null,
        ...colOverrides,
      },
      store: { store_name: 'テスト店', store_name_official: 'テスト店' },
      booths: [],
      total: 10000,
      advanceTotal: 0,
      collectedByName: null,
      issuer: null,
    },
    error: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.open = vi.fn()
})

describe('SPEC-COLLECTION-SIGNED-PDF-REUSE-01 downloadPdf branching', () => {
  it('when_signed_with_url_should_open_stored_pdf_and_not_call_buildCollectionSlip', async () => {
    getCollectionHistory.mockResolvedValue({ data: [mkRow({ customer_signed_at: '2026-06-20T10:00:00+09:00', signed_pdf_url: SIGNED_URL })], error: null })
    getCollectionDetail.mockResolvedValue(mkDetail({ customer_signed_at: '2026-06-20T10:00:00+09:00', signed_pdf_url: SIGNED_URL }))

    render(<MemoryRouter><CollectionHistoryPage /></MemoryRouter>)
    const btn = await screen.findByTestId(`download-pdf-${COL_ID}`)
    fireEvent.click(btn)

    await waitFor(() => expect(window.open).toHaveBeenCalledWith(SIGNED_URL, '_blank', 'noopener'))
    expect(mockBuildCollectionSlip).not.toHaveBeenCalled()
  })

  it('when_signed_without_url_should_fallback_to_buildCollectionSlip', async () => {
    getCollectionHistory.mockResolvedValue({ data: [mkRow({ customer_signed_at: '2026-06-20T10:00:00+09:00', signed_pdf_url: null })], error: null })
    getCollectionDetail.mockResolvedValue(mkDetail({ customer_signed_at: '2026-06-20T10:00:00+09:00', signed_pdf_url: null }))

    render(<MemoryRouter><CollectionHistoryPage /></MemoryRouter>)
    const btn = await screen.findByTestId(`download-pdf-${COL_ID}`)
    fireEvent.click(btn)

    await waitFor(() => expect(mockBuildCollectionSlip).toHaveBeenCalled())
    expect(window.open).not.toHaveBeenCalled()
  })

  it('when_unsigned_should_call_buildCollectionSlip', async () => {
    getCollectionHistory.mockResolvedValue({ data: [mkRow()], error: null })
    getCollectionDetail.mockResolvedValue(mkDetail())

    render(<MemoryRouter><CollectionHistoryPage /></MemoryRouter>)
    const btn = await screen.findByTestId(`download-pdf-${COL_ID}`)
    fireEvent.click(btn)

    await waitFor(() => expect(mockBuildCollectionSlip).toHaveBeenCalled())
    expect(window.open).not.toHaveBeenCalled()
  })

  it('when_signed_with_url_buildCollectionSlip_must_never_be_called', async () => {
    // AC4: explicit guard — even if window.open somehow fails, buildCollectionSlip must not fire
    getCollectionHistory.mockResolvedValue({ data: [mkRow({ customer_signed_at: '2026-06-20T10:00:00+09:00', signed_pdf_url: SIGNED_URL })], error: null })
    getCollectionDetail.mockResolvedValue(mkDetail({ customer_signed_at: '2026-06-20T10:00:00+09:00', signed_pdf_url: SIGNED_URL }))

    render(<MemoryRouter><CollectionHistoryPage /></MemoryRouter>)
    const btn = await screen.findByTestId(`download-pdf-${COL_ID}`)
    fireEvent.click(btn)

    await waitFor(() => expect(window.open).toHaveBeenCalled())
    // After open, buildCollectionSlip must have been called 0 times total
    expect(mockBuildCollectionSlip.mock.calls).toHaveLength(0)
  })
})
