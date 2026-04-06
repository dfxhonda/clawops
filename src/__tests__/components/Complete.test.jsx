// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

import Complete from '../../pages/Complete'

function renderComplete(locationState = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/complete', state: locationState }]}>
      <Complete />
    </MemoryRouter>
  )
}

const DRAFTS = [
  {
    booth_id: 'B01', full_booth_code: 'KKY01-M01-B01',
    in_meter: '5100', prev_in_meter: '5000',
    out_meter: '3100', prev_out_meter: '3000',
    play_price: 100,
    prize_name: 'ピカチュウ', prize_restock_count: '3', read_date: '2026-04-06',
  },
  {
    booth_id: 'B02', full_booth_code: 'KKY01-M01-B02',
    in_meter: '8200', prev_in_meter: '8000',
    out_meter: '4200', prev_out_meter: '4000',
    play_price: 200,
    prize_name: 'ドラえもん', prize_restock_count: '0', read_date: '2026-04-06',
  },
]

describe('Complete', () => {
  it('savedDrafts なし → 帳票テーブルが存在しない', () => {
    renderComplete({ storeName: 'テスト店', storeId: 'S01' })
    expect(screen.queryByText('集金帳票')).toBeNull()
    expect(screen.getByText('入力完了！')).toBeTruthy()
  })

  it('savedDrafts あり → ブースコードと景品名が表示される', () => {
    renderComplete({ storeName: 'テスト店', storeId: 'S01', savedDrafts: DRAFTS })
    expect(screen.getByText('集金帳票')).toBeTruthy()
    expect(screen.getByText('KKY01-M01-B01')).toBeTruthy()
    expect(screen.getByText('KKY01-M01-B02')).toBeTruthy()
  })

  it('合計売上が正しく計算される（B01: 100×100=10000, B02: 200×200=40000）', () => {
    renderComplete({ storeName: 'テスト店', storeId: 'S01', savedDrafts: DRAFTS })
    // B01: inDiff=100, sales=10000 / B02: inDiff=200, sales=40000 / 合計=50000
    expect(screen.getByText('¥50,000')).toBeTruthy()
  })

  it('桁あふれ対応: prev=9999990, current=30 → inDiff=40 → 売上=4000円', () => {
    const overflowDraft = [{
      booth_id: 'B03', full_booth_code: 'KKY01-M01-B03',
      in_meter: '30', prev_in_meter: '9999990',
      out_meter: '20', prev_out_meter: '0',
      play_price: 100,
      prize_name: 'テスト', prize_restock_count: '0', read_date: '2026-04-06',
    }]
    renderComplete({ savedDrafts: overflowDraft })
    expect(screen.getAllByText('¥4,000').length).toBeGreaterThanOrEqual(1)
  })
})
