// @vitest-environment happy-dom
// SPEC-COLLECTION-HISTORY-SIGN-BUTTON-FIX-07: customer_signed_at を signed 判定軸に変更
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../services/collections', () => ({
  getCollectionHistory: vi.fn(),
  getCollectionDetail: vi.fn(),
  saveSignedPdf: vi.fn(),
  uploadCustomerSignature: vi.fn(),
}))

vi.mock('../../collection/lib/collectionPdf', () => ({
  buildCollectionSlip: vi.fn(async () => ({
    save: vi.fn(),
    output: vi.fn(() => new Blob()),
  })),
  slipFileName: vi.fn(() => 'test.pdf'),
  ensureJpFont: vi.fn(async () => {}),
}))

vi.mock('../../collection/lib/imageUtil', () => ({
  fetchAsDataURL: vi.fn(async () => 'data:image/png;base64,mock'),
}))

vi.mock('../../collection/components/SignatureCanvas', () => ({
  default: vi.fn(() => null),
}))

import { getCollectionHistory } from '../../services/collections'
import CollectionHistoryPage from '../../collection/CollectionHistoryPage'

function wrap(node) {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}

const BASE_ROW = {
  collection_id: 'TST01-20260621-01',
  store_code: 'TST01',
  store_name: 'テスト店',
  collected_at: '2026-06-21',
  status: 'confirmed',
  total: 10000,
  signed_pdf_url: null,
  customer_signed_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CollectionHistoryPage signed judgement (SPEC-COLLECTION-HISTORY-SIGN-BUTTON-FIX-07)', () => {
  it('when_customer_signed_at_set_and_signed_pdf_url_null_should_show_resign_not_blue', async () => {
    // AC1: 新フロー (customer_signed_at あり, signed_pdf_url NULL) → 再署名 (gray)
    getCollectionHistory.mockResolvedValue({
      data: [{ ...BASE_ROW, customer_signed_at: '2026-06-21T08:00:00Z', signed_pdf_url: null }],
      error: null,
    })
    wrap(<CollectionHistoryPage />)
    const btn = await waitFor(() => screen.getByTestId('sign-btn-TST01-20260621-01'))
    expect(btn.textContent).toBe('再署名')
    expect(btn.className).toContain('bg-gray-600')
    expect(btn.className).not.toContain('bg-blue-600')
  })

  it('when_customer_signed_at_set_should_show_signed_badge', async () => {
    // AC2: 新フロー → 署名済バッジ表示
    getCollectionHistory.mockResolvedValue({
      data: [{ ...BASE_ROW, customer_signed_at: '2026-06-21T08:00:00Z', signed_pdf_url: null }],
      error: null,
    })
    wrap(<CollectionHistoryPage />)
    await waitFor(() => {
      const badge = screen.getByTestId('signed-badge-TST01-20260621-01')
      expect(badge.textContent).toBe('署名済')
    })
  })

  it('when_customer_signed_at_null_should_show_blue_sign_button', async () => {
    // AC3: 未署名 → 先方署名 (blue)
    getCollectionHistory.mockResolvedValue({
      data: [{ ...BASE_ROW, customer_signed_at: null, signed_pdf_url: null }],
      error: null,
    })
    wrap(<CollectionHistoryPage />)
    const btn = await waitFor(() => screen.getByTestId('sign-btn-TST01-20260621-01'))
    expect(btn.textContent).toBe('先方署名')
    expect(btn.className).toContain('bg-blue-600')
  })

  it('when_customer_signed_at_null_should_not_show_signed_badge', async () => {
    // AC3: 未署名 → バッジなし
    getCollectionHistory.mockResolvedValue({
      data: [{ ...BASE_ROW, customer_signed_at: null, signed_pdf_url: null }],
      error: null,
    })
    wrap(<CollectionHistoryPage />)
    await waitFor(() => screen.getByTestId('sign-btn-TST01-20260621-01'))
    expect(screen.queryByTestId('signed-badge-TST01-20260621-01')).toBeNull()
  })

  it('when_both_customer_signed_at_and_signed_pdf_url_set_should_show_resign', async () => {
    // AC2: 旧フロー (両方あり) も 再署名
    getCollectionHistory.mockResolvedValue({
      data: [{ ...BASE_ROW, customer_signed_at: '2026-06-21T08:00:00Z', signed_pdf_url: 'https://example.com/signed.pdf' }],
      error: null,
    })
    wrap(<CollectionHistoryPage />)
    const btn = await waitFor(() => screen.getByTestId('sign-btn-TST01-20260621-01'))
    expect(btn.textContent).toBe('再署名')
    expect(btn.className).toContain('bg-gray-600')
  })

  it('when_signed_pdf_url_set_but_customer_signed_at_null_should_still_show_blue', async () => {
    // signed_pdf_url だけでは signed にならない (判定軸は customer_signed_at のみ)
    getCollectionHistory.mockResolvedValue({
      data: [{ ...BASE_ROW, customer_signed_at: null, signed_pdf_url: 'https://example.com/legacy.pdf' }],
      error: null,
    })
    wrap(<CollectionHistoryPage />)
    const btn = await waitFor(() => screen.getByTestId('sign-btn-TST01-20260621-01'))
    expect(btn.textContent).toBe('先方署名')
    expect(btn.className).toContain('bg-blue-600')
  })

  it('when_row_loaded_should_always_show_pdf_download_button', async () => {
    // AC4: PDF ダウンロードボタンは常時表示
    getCollectionHistory.mockResolvedValue({
      data: [{ ...BASE_ROW }],
      error: null,
    })
    wrap(<CollectionHistoryPage />)
    await waitFor(() => {
      expect(screen.getByTestId('download-pdf-TST01-20260621-01')).toBeTruthy()
    })
  })
})
