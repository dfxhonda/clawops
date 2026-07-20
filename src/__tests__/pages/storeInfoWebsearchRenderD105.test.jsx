// @vitest-environment happy-dom
// SPEC-STORE-INFO-WEBSEARCH-01 (D-105): 店舗情報Web検索の実描画フロー (検索→候補→反映)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ staffId: 'S1', staffName: '太郎' }) }))
vi.mock('../../services/audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }))
vi.mock('../../admin/components/StoreCrudDrawer', () => ({ default: () => null }))

const invokeMock = vi.fn()
const ROW = {
  store_code: 'KKY01', store_name: '本店', store_name_official: '', brand_name: 'DFX', store_type: 'donki',
  phone: '', address: '福岡', region: '九州', locality: '福岡市', locality_kana: 'フクオカシ',
  lat: 33.5, lng: 130.4, is_active: true, opened_at: null, closed_at: null, is_collection_day: false, notes: null,
}
vi.mock('../../lib/supabase', () => {
  const makeBuilder = () => {
    const b = {
      select: () => b, or: () => b, eq: () => b, in: () => b, order: () => b,
      insert: () => b, update: () => b, delete: () => b,
      maybeSingle: () => Promise.resolve({ data: ROW, error: null }),
      then: (cb) => Promise.resolve({ data: [ROW], error: null }).then(cb),
    }
    return b
  }
  return { supabase: { from: () => makeBuilder(), functions: { invoke: (...a) => invokeMock(...a) } } }
})

const AdminStoreListPage = (await import('../../admin/pages/AdminStoreListPage')).default

const renderPage = () => render(<MemoryRouter><AdminStoreListPage /></MemoryRouter>)

beforeEach(() => { invokeMock.mockReset() })

describe('AC2/AC3: 検索→候補表示→反映 (B方式) 実描画', () => {
  it('店名入力→検索ボタン→候補パネル→反映でformにlat/lng等が入る (store_code/nameは温存)', async () => {
    invokeMock.mockResolvedValue({
      data: { store: {
        store_name_official: '株式会社DFX本店', brand_name: null, address: '福岡県福岡市中央区',
        phone: '092-000-0000', region: '九州', locality: '福岡市', locality_kana: 'フクオカシ', lat: 33.59, lng: 130.4,
      } },
      error: null,
    })

    renderPage()
    // 新規登録モーダルを開く
    fireEvent.click(await screen.findByText(/新規追加/))
    await screen.findByTestId('store-list-modal')

    // 店名+コード入力
    fireEvent.change(screen.getByTestId('store-edit-name'), { target: { value: '本店' } })
    fireEvent.change(screen.getByTestId('store-edit-code'), { target: { value: 'KKY01' } })

    // 検索ボタン押下
    fireEvent.click(screen.getByTestId('store-info-search-button'))
    expect(invokeMock).toHaveBeenCalledWith('store-info-search', { body: { storeName: '本店', address: undefined } })

    // 候補パネル表示 → 目視値
    const panel = await screen.findByTestId('store-candidate')
    expect(panel.textContent).toContain('株式会社DFX本店')
    expect(panel.textContent).toContain('33.59')

    // 反映
    fireEvent.click(screen.getByTestId('store-candidate-apply'))
    await waitFor(() => expect(screen.queryByTestId('store-candidate')).toBeNull())

    // form に lat/lng が入る、store_code/name は温存
    expect(screen.getByTestId('store-edit-lat').value).toBe('33.59')
    expect(screen.getByTestId('store-edit-lng').value).toBe('130.4')
    expect(screen.getByTestId('store-edit-name').value).toBe('本店')   // 上書きされない
    expect(screen.getByTestId('store-edit-code').value).toBe('KKY01')  // 上書きされない
    expect(screen.getByTestId('store-edit-name-official').value).toBe('株式会社DFX本店')

    // 保存 (handleSave: lat/lng 数値化 + latLngVerified→gps_verified_at 打刻経路をカバー)
    fireEvent.click(screen.getByTestId('store-list-save-button'))
    await waitFor(() => expect(screen.queryByTestId('store-list-modal')).toBeNull())
  })

  it('検索失敗時は候補を出さない (alert)', async () => {
    invokeMock.mockResolvedValue({ data: { store: null }, error: null })
    const alertMock = vi.fn()
    const prevAlert = window.alert
    window.alert = alertMock
    renderPage()
    fireEvent.click(await screen.findByText(/新規追加/))
    await screen.findByTestId('store-list-modal')
    fireEvent.change(screen.getByTestId('store-edit-name'), { target: { value: 'なぞ店' } })
    fireEvent.click(screen.getByTestId('store-info-search-button'))
    await waitFor(() => expect(alertMock).toHaveBeenCalled())
    expect(screen.queryByTestId('store-candidate')).toBeNull()
    window.alert = prevAlert
  })
})
