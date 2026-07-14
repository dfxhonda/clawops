// @vitest-environment happy-dom
// HOTFIX-COLLECTION-DENOM-INPUT-DEAD-01 (D-052) regression test.
//
// P0 outage: tapping a 金種 (denomination) NumpadField did nothing — activate() set
// currentField, but the same pointerDown bubbled to the page-root handleOutsideTap which
// cleared it in the same React batch, because denom fields carry NO dataTabindex and the
// old guard only exempted [data-tabindex] / numpad-footer.
//
// Fix: NumpadField inputs carry data-numpad-field="1" (F1) and handleOutsideTap exempts
// [data-numpad-field] first (F2). This test renders the REAL CollectionInputPage + REAL
// NumpadField so it exercises both F1 and F2 — reverting either makes AC1 fail.
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

// NOTE: NumpadField / NumpadFooterPanel are intentionally NOT mocked — the fix lives there.

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

async function openDenomRow() {
  render(<MemoryRouter><CollectionInputPage /></MemoryRouter>)
  fireEvent.click(screen.getByTestId('store-picker-btn'))
  fireEvent.click(screen.getByTestId('collection-load-button'))
  await waitFor(() => screen.getByTestId('collection-table'))
  // open the denom-inline row for booth B01
  fireEvent.click(screen.getByTestId('booth-amount-B01'))
  await waitFor(() => screen.getByTestId('denom-inline-B01'))
}

beforeEach(() => { vi.clearAllMocks() })

describe('HOTFIX-COLLECTION-DENOM-INPUT-DEAD-01 denom field numpad', () => {
  it('AC1: pointerDown on a denom field opens the numpad (currentField survives root outside-tap) and digits update the value', async () => {
    await openDenomRow()
    const denomField = screen.getByTestId('denom-input-bill_10000-B01')

    // tapping the denom field must activate the numpad, NOT be swallowed by handleOutsideTap
    fireEvent.pointerDown(denomField)
    expect(screen.getByTestId('numpad-active-label').textContent).toContain('入力中')

    // pressing a digit key updates the denom value + subtotal
    fireEvent.pointerDown(document.querySelector('[data-numpad-key="1"]'))
    await waitFor(() => {
      expect(screen.getByTestId('denom-input-bill_10000-B01').value).toBe('1')
    })
    expect(screen.getByTestId('denom-subtotal-B01').textContent).toContain('10,000')
  })

  it('AC2: tapping outside any field still clears the active numpad (outside-tap close unchanged)', async () => {
    await openDenomRow()
    fireEvent.pointerDown(screen.getByTestId('denom-input-bill_10000-B01'))
    expect(screen.getByTestId('numpad-active-label').textContent).toContain('入力中')

    // tap a non-field element (page header) -> currentField cleared
    fireEvent.pointerDown(screen.getByText('集金入力'))
    await waitFor(() => {
      expect(screen.getByTestId('numpad-active-label').textContent).toContain('タップして選択')
    })
  })
})
