// @vitest-environment happy-dom
// SPEC-PATROL-ROUTE-BUILDER-01 (D-106): 巡回ルート作成ページ 実描画 (取得→追加→おすすめ順→案内)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})
const getLocationMock = vi.fn()
vi.mock('../../shared/hooks/useGeolocation', () => ({ useGeolocation: () => ({ getLocation: getLocationMock }) }))
const saveMock = vi.fn(() => Promise.resolve())
vi.mock('../../lib/localStore/patrolRoute', () => ({
  saveRouteToday: (...a) => saveMock(...a),
  loadRouteToday: () => Promise.resolve([]),
}))

const STORES = [
  { store_code: 'NEAR', store_name: '近い店', lat: 33.51, lng: 130.41 },
  { store_code: 'FAR', store_name: '遠い店', lat: 34.9, lng: 131.9 },
  { store_code: 'NOGEO', store_name: '座標なし店', lat: null, lng: null },
]
vi.mock('../../lib/supabase', () => {
  const b = { select: () => b, eq: () => b, then: (cb) => Promise.resolve({ data: STORES, error: null }).then(cb) }
  return { supabase: { from: () => b } }
})

const PatrolRoutePage = (await import('../../clawsupport/pages/PatrolRoutePage')).default
const renderPage = () => render(<MemoryRouter><PatrolRoutePage /></MemoryRouter>)

beforeEach(() => { getLocationMock.mockReset(); saveMock.mockReset() })

describe('AC1/AC2/AC3/AC5: 取得→追加→おすすめ順→案内スタート', () => {
  it('座標なし店の追加は不可 (グレーアウト)', async () => {
    renderPage()
    await screen.findByTestId('route-candidate-NEAR')
    expect(screen.getByTestId('route-add-NOGEO').disabled).toBe(true)
    expect(screen.getByTestId('route-add-NEAR').disabled).toBe(false)
  })

  it('現在地取得→距離表示→2店追加→AIおすすめ順→案内スタートでGoogle maps URL', async () => {
    getLocationMock.mockResolvedValue({ lat: 33.5, lng: 130.4, accuracy: 20 })
    const openMock = vi.fn()
    window.open = openMock

    renderPage()
    await screen.findByTestId('route-candidate-NEAR')

    // 現在地取得
    fireEvent.click(screen.getByTestId('route-locate'))
    await waitFor(() => expect(getLocationMock).toHaveBeenCalled())

    // 2店を予定に追加 (遠い→近い の順で入れて、おすすめ順で並び替わるのを見る)
    fireEvent.click(screen.getByTestId('route-add-FAR'))
    await screen.findByTestId('route-item-FAR')
    fireEvent.click(screen.getByTestId('route-add-NEAR'))
    await screen.findByTestId('route-item-NEAR')

    // AIおすすめ順 (距離昇順)
    fireEvent.click(screen.getByTestId('route-recommend'))
    await waitFor(() => {
      const items = screen.getAllByTestId(/^route-item-/)
      expect(items[0].getAttribute('data-testid')).toBe('route-item-NEAR') // 近い順が先頭
    })

    // 案内スタート → Google maps dir URL を別タブで開く
    fireEvent.click(screen.getByTestId('route-start-navi'))
    expect(openMock).toHaveBeenCalledTimes(1)
    const url = openMock.mock.calls[0][0]
    expect(url).toContain('https://www.google.com/maps/dir/?api=1')
    expect(url).toContain('origin=33.5,130.4')
    expect(url).toContain('travelmode=driving')

    // 予定変更で idb 保存が呼ばれている
    expect(saveMock).toHaveBeenCalled()
  })

  it('削除で予定から外れる', async () => {
    getLocationMock.mockResolvedValue({ lat: 33.5, lng: 130.4, accuracy: 20 })
    renderPage()
    await screen.findByTestId('route-candidate-NEAR')
    fireEvent.click(screen.getByTestId('route-add-NEAR'))
    await screen.findByTestId('route-item-NEAR')
    fireEvent.click(screen.getByTestId('route-remove-NEAR'))
    await waitFor(() => expect(screen.queryByTestId('route-item-NEAR')).toBeNull())
  })
})
