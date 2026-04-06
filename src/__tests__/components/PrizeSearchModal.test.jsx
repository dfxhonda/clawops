// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PrizeSearchModal from '../../components/PrizeSearchModal'

const PRIZES = [
  { prize_id: 'P001', prize_name: 'ピカチュウぬいぐるみ', image_url: 'sgp/P001.jpg' },
  { prize_id: 'P002', prize_name: 'ドラえもんフィギュア', image_url: null },
  { prize_id: 'P003', prize_name: 'ルフィキーホルダー', image_url: 'sgp/P003.jpg' },
]

const VEHICLE_STOCKS = [
  { prize_id: 'P001', quantity: 5, stock_id: 'S01', prize_name: 'ピカチュウぬいぐるみ' },
]

function renderModal(props = {}) {
  const onSelect = props.onSelect || vi.fn()
  const onClose = props.onClose || vi.fn()
  render(
    <PrizeSearchModal
      prizes={PRIZES}
      vehicleStocks={VEHICLE_STOCKS}
      onSelect={onSelect}
      onClose={onClose}
      {...props}
    />
  )
  return { onSelect, onClose }
}

describe('PrizeSearchModal', () => {
  it('検索inputに入力するとカードが絞り込まれる', () => {
    renderModal()
    expect(screen.getAllByRole('button', { name: /ぬいぐるみ|フィギュア|キーホルダー/i }).length).toBe(3)
    const input = screen.getByPlaceholderText('景品名で検索...')
    fireEvent.change(input, { target: { value: 'ドラえもん' } })
    expect(screen.getByRole('button', { name: /ドラえもん/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /ピカチュウ/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /ルフィ/ })).toBeNull()
  })

  it('「車載のみ」トグルONで vehicleStocks にない景品が非表示になる', () => {
    renderModal()
    const toggle = screen.getByRole('button', { name: /車載のみ/ })
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: /ピカチュウ/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /ドラえもん/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /ルフィ/ })).toBeNull()
  })

  it('カードをクリックすると onSelect(prize_name) が呼ばれる', () => {
    const onSelect = vi.fn()
    renderModal({ onSelect })
    fireEvent.click(screen.getByRole('button', { name: /ドラえもん/ }))
    expect(onSelect).toHaveBeenCalledWith('ドラえもんフィギュア')
  })

  it('image_url=null の景品でもクラッシュしない（「画像なし」表示）', () => {
    renderModal()
    // image_url=null の景品(P002)は img タグが存在しない
    const imgs = document.querySelectorAll('img[alt="ドラえもんフィギュア"]')
    expect(imgs.length).toBe(0)
    // 3枚全カードが描画されていることを確認（クラッシュなし）
    expect(screen.getAllByText(/ぬいぐるみ|フィギュア|キーホルダー/).length).toBe(3)
  })
})
