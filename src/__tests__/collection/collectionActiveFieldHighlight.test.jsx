// @vitest-environment happy-dom
// SPEC-COLLECTION-ACTIVE-FIELD-HIGHLIGHT-01 (D-054) regression test.
//
// Wires NumpadField isActive on the collection page and strengthens the active style
// (2px border + ring) via the opt-in strongActive prop. currentField.testId is the single
// source of truth for which field is active. Renders the REAL CollectionInputPage + REAL
// NumpadField so both F1 (style) and F2 (isActive wiring incl. testId in onRegister) are exercised.
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

// NumpadField / NumpadFooterPanel intentionally NOT mocked — the fix lives there.

vi.mock('../../components/StorePickerSheet', () => ({
  default: ({ onChange, disabled }) => (
    <button data-testid="store-picker-btn" disabled={disabled} onClick={() => onChange('TST01')}>テスト店選択</button>
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
  getActiveStores: vi.fn(async () => ({ data: [{ store_code: 'TST01', store_name: 'テスト店' }], error: null })),
  getActiveBoothsForStore: vi.fn(async () => ({
    data: [{
      booth_code: 'B01', booth_name: 'A1', machine_code: 'M01', machine_name: 'クレーン',
      rental_code: 'R2001', in_meter_prev_default: null, in_meter_current_default: null,
    }],
    error: null,
  })),
  nextCollectionId: vi.fn(async () => 'TST01-20260621-01'),
  getPrevCollectionMeters: vi.fn(async () => ({ data: {}, error: null })),
  uploadReceiptPhoto: vi.fn(async () => ({ data: { url: '', path: '' }, error: null })),
  saveCollection: vi.fn(async () => ({ data: { id: 'TST01-20260621-01' }, error: null })),
  getCollectionDetail: vi.fn(async () => ({ data: null, error: null })),
  deleteReceiptPhoto: vi.fn(async () => ({ error: null })),
  uploadCustomerSignature: vi.fn(async () => ({ data: { url: null, path: null }, error: null })),
  saveSignedPdf: vi.fn(async () => ({ data: {}, error: null })),
}))

import CollectionInputPage from '../../collection/CollectionInputPage'

// strongActive ring is unique to D-054 active fields -> a non-empty boxShadow means "highlighted".
const isHighlighted = el => el.style.boxShadow !== '' && el.style.border.includes('2px')

async function openDenomRow() {
  render(<MemoryRouter><CollectionInputPage /></MemoryRouter>)
  fireEvent.click(screen.getByTestId('store-picker-btn'))
  fireEvent.click(screen.getByTestId('collection-load-button'))
  await waitFor(() => screen.getByTestId('collection-table'))
  fireEvent.click(screen.getByTestId('booth-amount-B01'))
  await waitFor(() => screen.getByTestId('denom-inline-B01'))
}

const denomField = key => screen.getByTestId(`denom-input-${key}-B01`)

beforeEach(() => { vi.clearAllMocks() })

describe('SPEC-COLLECTION-ACTIVE-FIELD-HIGHLIGHT-01 active field highlight', () => {
  it('AC1: pointerDown highlights that field (2px+ring); activating another moves the highlight', async () => {
    await openDenomRow()
    expect(isHighlighted(denomField('bill_10000'))).toBe(false)

    fireEvent.pointerDown(denomField('bill_10000'))
    expect(isHighlighted(denomField('bill_10000'))).toBe(true)

    fireEvent.pointerDown(denomField('bill_5000'))
    expect(isHighlighted(denomField('bill_5000'))).toBe(true)
    // previous field reverts
    expect(isHighlighted(denomField('bill_10000'))).toBe(false)
  })

  it('AC2: tapping outside reverts all highlights and closes the numpad (D-052 stays green)', async () => {
    await openDenomRow()
    fireEvent.pointerDown(denomField('bill_10000'))
    expect(isHighlighted(denomField('bill_10000'))).toBe(true)

    fireEvent.pointerDown(screen.getByText('集金入力'))
    await waitFor(() => {
      expect(screen.getByTestId('numpad-active-label').textContent).toContain('タップして選択')
    })
    expect(isHighlighted(denomField('bill_10000'))).toBe(false)
  })
})
