// @vitest-environment happy-dom
// J-STOCKTAKE-MVP-fix-01: 個数入力UI(多段加算・保存して次へ・締め活性)の挙動
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import StocktakeCountSession from './StocktakeCountSession'

const saveCount = vi.fn()
let mockHook

vi.mock('./useStocktakeCount', () => ({
  useStocktakeCount: () => mockHook,
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ staffId: 'staff-1' }),
}))

function renderSession() {
  render(
    <MemoryRouter initialEntries={['/tanasupport/stocktake/count/location/wh-1']}>
      <Routes>
        <Route path="/tanasupport/stocktake/count/:ownerType/:ownerCode" element={<StocktakeCountSession />} />
        <Route path="/tanasupport/stocktake/count" element={<div>HUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const PRIZES = [
  { prize_id: 'A', prize_name: 'ぬいぐるみA', theoretical_count: 10 },
  { prize_id: 'B', prize_name: 'ぬいぐるみB', theoretical_count: 5 },
]

beforeEach(() => {
  saveCount.mockReset()
  mockHook = { loading: false, error: null, prizes: PRIZES, countsMap: {}, saveCount }
})

describe('StocktakeCountSession 多段加算', () => {
  it('when_未入力SKUタップ_should_テンキーシート表示', () => {
    renderSession()
    fireEvent.click(screen.getByTestId('stocktake-prize-A'))
    expect(screen.getByTestId('stocktake-numpad-sheet')).toBeTruthy()
    cleanup()
  })

  it('when_50入力_should_合計に50表示', () => {
    renderSession()
    fireEvent.click(screen.getByTestId('stocktake-prize-A'))
    const sheet = screen.getByTestId('stocktake-numpad-sheet')
    fireEvent.pointerDown(within(sheet).getByText('5'))
    fireEvent.pointerDown(within(sheet).getByText('0'))
    expect(screen.getByTestId('stocktake-running-total').textContent).toBe('50')
    cleanup()
  })

  it('when_50を加算後25入力_should_合計75表示', () => {
    renderSession()
    fireEvent.click(screen.getByTestId('stocktake-prize-A'))
    const sheet = screen.getByTestId('stocktake-numpad-sheet')
    fireEvent.pointerDown(within(sheet).getByText('5'))
    fireEvent.pointerDown(within(sheet).getByText('0'))
    fireEvent.click(screen.getByTestId('stocktake-add-batch'))
    fireEvent.pointerDown(within(sheet).getByText('2'))
    fireEvent.pointerDown(within(sheet).getByText('5'))
    expect(screen.getByTestId('stocktake-running-total').textContent).toBe('75')
    cleanup()
  })

  it('when_保存して次へ_should_saveCountが合計値で呼ばれる', () => {
    renderSession()
    fireEvent.click(screen.getByTestId('stocktake-prize-A'))
    const sheet = screen.getByTestId('stocktake-numpad-sheet')
    fireEvent.pointerDown(within(sheet).getByText('3'))
    fireEvent.click(screen.getByTestId('stocktake-save-next'))
    expect(saveCount).toHaveBeenCalledWith('A', 3, 10)
    cleanup()
  })

  it('when_全SKU入力済_should_締めるボタン活性', () => {
    mockHook = {
      loading: false, error: null, prizes: PRIZES,
      countsMap: { A: { actual_count: 1 }, B: { actual_count: 2 } }, saveCount,
    }
    renderSession()
    expect(screen.getByTestId('stocktake-close-button').disabled).toBe(false)
    cleanup()
  })
})
