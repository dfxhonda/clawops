// @vitest-environment happy-dom
// SPEC-PATROL-ROUTE-BUILDER-01 (D-106) + STORECARD-UNIFY-01 (D-107): 巡回ルート作成ページ 実描画。
// 店選択は KanaIndex + 共有 StoreCard (D-107)。取得→カナタブ→追加→おすすめ順→案内。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ staffId: 'S1' }) }))
const getLocationMock = vi.fn()
vi.mock('../../shared/hooks/useGeolocation', () => ({ useGeolocation: () => ({ getLocation: getLocationMock }) }))
const saveMock = vi.fn(() => Promise.resolve())
vi.mock('../../lib/localStore/patrolRoute', () => ({
  saveRouteToday: (...a) => saveMock(...a),
  loadRouteToday: () => Promise.resolve([]),
}))

// 全店 あ 行 (locality_kana カ行=ア始まり) にして KanaIndex 'あ' タブに集約
const STORES = [
  { store_code: 'NEAR', store_name: '近い店', lat: 33.51, lng: 130.41, locality_kana: 'アオイ' },
  { store_code: 'FAR', store_name: '遠い店', lat: 34.9, lng: 131.9, locality_kana: 'アサヒ' },
  { store_code: 'NOGEO', store_name: '座標なし店', lat: null, lng: null, locality_kana: 'アマミ' },
]
vi.mock('../../lib/supabase', () => {
  const mk = (data) => {
    const b = {
      select: () => b, eq: () => b, delete: () => b,
      upsert: () => Promise.resolve({ error: null }),
      then: (cb) => Promise.resolve({ data, error: null }).then(cb),
    }
    return b
  }
  return {
    supabase: {
      from: (t) => t === 'stores' ? mk(STORES) : mk([]),
      rpc: () => Promise.resolve({ data: [], error: null }),
    },
  }
})

const PatrolRoutePage = (await import('../../clawsupport/pages/PatrolRoutePage')).default
const renderPage = () => render(<MemoryRouter><PatrolRoutePage /></MemoryRouter>)

beforeEach(() => { getLocationMock.mockReset(); saveMock.mockReset() })

async function openAtab() {
  renderPage()
  await waitFor(() => expect(screen.getByText('あ')).toBeTruthy()) // KanaIndex カナタブ (AC3)
  fireEvent.click(screen.getByText('あ'))
  await screen.findByTestId('store-card-NEAR')
}

describe('D-107 AC3/AC4: KanaIndex + StoreCard 店選択、距離併存', () => {
  it('カナタブ表示、座標なし店は追加されない (タップ無効)', async () => {
    getLocationMock.mockResolvedValue({ lat: 33.5, lng: 130.4, accuracy: 20 })
    await openAtab()
    fireEvent.click(screen.getByTestId('route-locate'))
    await waitFor(() => expect(getLocationMock).toHaveBeenCalled())
    // 座標なし店をタップ → 予定に入らない
    fireEvent.click(screen.getByTestId('store-card-NOGEO'))
    await waitFor(() => {})
    expect(screen.queryByTestId('route-item-NOGEO')).toBeNull()
  })

  it('タップで追加、AIおすすめ順で距離昇順、案内スタートで maps URL', async () => {
    getLocationMock.mockResolvedValue({ lat: 33.5, lng: 130.4, accuracy: 20 })
    const openMock = vi.fn(); window.open = openMock
    await openAtab()
    fireEvent.click(screen.getByTestId('route-locate'))
    await waitFor(() => expect(getLocationMock).toHaveBeenCalled())

    fireEvent.click(screen.getByTestId('store-card-FAR'))
    await screen.findByTestId('route-item-FAR')
    fireEvent.click(screen.getByTestId('store-card-NEAR'))
    await screen.findByTestId('route-item-NEAR')

    fireEvent.click(screen.getByTestId('route-recommend'))
    await waitFor(() => {
      const items = screen.getAllByTestId(/^route-item-/)
      expect(items[0].getAttribute('data-testid')).toBe('route-item-NEAR')
    })

    fireEvent.click(screen.getByTestId('route-start-navi'))
    expect(openMock).toHaveBeenCalledTimes(1)
    const url = openMock.mock.calls[0][0]
    expect(url).toContain('https://www.google.com/maps/dir/?api=1')
    expect(url).toContain('origin=33.5,130.4')
    expect(url).toContain('travelmode=driving')
    expect(saveMock).toHaveBeenCalled()
  })

  it('追加した店は候補(カナ一覧)から除外される', async () => {
    await openAtab()
    fireEvent.click(screen.getByTestId('store-card-NEAR'))
    await screen.findByTestId('route-item-NEAR')
    await waitFor(() => expect(screen.queryByTestId('store-card-NEAR')).toBeNull())
  })

  it('削除で予定から外れる', async () => {
    await openAtab()
    fireEvent.click(screen.getByTestId('store-card-NEAR'))
    await screen.findByTestId('route-item-NEAR')
    fireEvent.click(screen.getByTestId('route-remove-NEAR'))
    await waitFor(() => expect(screen.queryByTestId('route-item-NEAR')).toBeNull())
  })
})
