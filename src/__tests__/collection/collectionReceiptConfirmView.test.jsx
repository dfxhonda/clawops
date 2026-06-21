// @vitest-environment happy-dom
// SPEC-COLLECTION-RECEIPT-CONFIRM-VIEW-01: receipt confirm modal branching
// AC1: photo'd booth receipt btn → modal shows saved image
// AC2: re-shoot btn → file input .click() + modal closes
// AC3: back btn → modal closes, file input NOT triggered
// AC4: no-photo booth receipt btn → file input .click() directly (no modal)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ staffId: 'STAFF01', staffName: '本田' }),
}))

vi.mock('../../clawsupport/components/NumpadField', () => ({
  default: ({ testId, value, onChange }) => (
    <input data-testid={testId} value={value || ''} onChange={e => onChange(e.target.value)} />
  ),
  NumpadFooterPanel: () => null,
}))

vi.mock('../../components/StorePickerSheet', () => ({
  default: ({ onChange, disabled }) => (
    <button
      data-testid="store-picker-btn"
      disabled={disabled}
      onClick={() => onChange('TST01')}
    >テスト店選択</button>
  ),
}))

vi.mock('../../collection/components/SignatureCanvas', () => ({
  default: () => null,
  SIGNATURE_MIN_POINTS: 5,
}))

vi.mock('../../collection/lib/collectionPdf', () => ({
  buildCollectionSlip: vi.fn(async () => ({ save: vi.fn(), output: vi.fn(() => new Blob()) })),
  slipFileName: vi.fn(() => 'test.pdf'),
  ensureJpFont: vi.fn(async () => {}),
}))

vi.mock('../../collection/lib/imageUtil', () => ({
  compressImage: vi.fn(async f => f),
  fetchAsDataURL: vi.fn(async () => 'data:image/png;base64,mock'),
}))

vi.mock('../../services/collections', () => ({
  getActiveStores: vi.fn(async () => ({
    data: [{ store_code: 'TST01', store_name: 'テスト店' }],
    error: null,
  })),
  getActiveBoothsForStore: vi.fn(async () => ({
    data: [{
      booth_code: 'B01',
      booth_name: 'A1',
      machine_code: 'M01',
      machine_name: 'クレーン',
      rental_code: 'R2001',
      in_meter_prev_default: null,
      in_meter_current_default: null,
    }],
    error: null,
  })),
  nextCollectionId: vi.fn(async () => 'TST01-20260621-01'),
  getPrevCollectionMeters: vi.fn(async () => ({ data: {}, error: null })),
  uploadReceiptPhoto: vi.fn(async () => ({
    data: { url: 'https://example.com/receipt.jpg', path: 'receipts/r1.jpg' },
    error: null,
  })),
  saveCollection: vi.fn(async () => ({ data: { id: 'TST01-20260621-01' }, error: null })),
  getCollectionDetail: vi.fn(async () => ({ data: null, error: null })),
  deleteReceiptPhoto: vi.fn(async () => ({ error: null })),
  uploadCustomerSignature: vi.fn(async () => ({ data: { url: null, path: null }, error: null })),
  saveSignedPdf: vi.fn(async () => ({ data: {}, error: null })),
}))

import CollectionInputPage from '../../collection/CollectionInputPage'

const PHOTO_URL = 'https://example.com/receipt.jpg'

async function loadPage() {
  render(<MemoryRouter><CollectionInputPage /></MemoryRouter>)
  fireEvent.click(screen.getByTestId('store-picker-btn'))
  fireEvent.click(screen.getByTestId('collection-load-button'))
  await waitFor(() => screen.getByTestId('collection-table'))
}

async function simulatePhotoUpload() {
  const input = screen.getByTestId('booth-receipt-input-B01')
  const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })
  Object.defineProperty(input, 'files', { value: [file], writable: true })
  fireEvent.change(input)
  await waitFor(() => {
    const btn = screen.getByTestId('booth-receipt-btn-B01')
    expect(btn.querySelector('img')).toBeTruthy()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SPEC-COLLECTION-RECEIPT-CONFIRM-VIEW-01 receipt confirm modal', () => {
  it('when_booth_has_photo_and_receipt_btn_clicked_should_open_confirm_modal_with_image', async () => {
    await loadPage()
    await simulatePhotoUpload()
    fireEvent.click(screen.getByTestId('booth-receipt-btn-B01'))
    await waitFor(() => expect(screen.getByTestId('receipt-confirm-image')).toBeTruthy())
    expect(screen.getByTestId('receipt-confirm-image').src).toContain('receipt.jpg')
  })

  it('when_reshoot_clicked_should_close_modal_and_trigger_file_input_click', async () => {
    await loadPage()
    await simulatePhotoUpload()

    const input = screen.getByTestId('booth-receipt-input-B01')
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})

    fireEvent.click(screen.getByTestId('booth-receipt-btn-B01'))
    await waitFor(() => screen.getByTestId('receipt-confirm-reshoot'))
    fireEvent.click(screen.getByTestId('receipt-confirm-reshoot'))

    await waitFor(() => expect(screen.queryByTestId('receipt-confirm-image')).toBeNull())
    expect(clickSpy).toHaveBeenCalled()
  })

  it('when_back_clicked_should_close_modal_without_triggering_file_input', async () => {
    await loadPage()
    await simulatePhotoUpload()

    const input = screen.getByTestId('booth-receipt-input-B01')
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})

    fireEvent.click(screen.getByTestId('booth-receipt-btn-B01'))
    await waitFor(() => screen.getByTestId('receipt-confirm-back'))
    fireEvent.click(screen.getByTestId('receipt-confirm-back'))

    await waitFor(() => expect(screen.queryByTestId('receipt-confirm-image')).toBeNull())
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('when_booth_has_no_photo_and_receipt_btn_clicked_should_open_camera_directly', async () => {
    await loadPage()
    // No photo uploaded — booth starts with receipt_photo_url: null

    const input = screen.getByTestId('booth-receipt-input-B01')
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})

    fireEvent.click(screen.getByTestId('booth-receipt-btn-B01'))

    // Modal must NOT appear
    expect(screen.queryByTestId('receipt-confirm-image')).toBeNull()
    // File input must be triggered
    expect(clickSpy).toHaveBeenCalled()
  })
})
