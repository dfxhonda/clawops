// @vitest-environment happy-dom
// SPEC-PATROL-VIEW-MODE-SWITCH-01: StoreTotalsHeader mode toggle + ラベル/値 切替
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StoreTotalsHeader from '../../clawsupport/components/StoreTotalsHeader'

// 共通 diffMap fixture (booth_code 2 件、IN/OUT/Stock 全モード値あり)
const diffMap = {
  'A-1': {
    prevIn: 100, currIn: 200, prevPerDay: 10, currPerDay: 20,
    prevOut: 30, currOut: 40, prevPayout: 30.0, currPayout: 20.0,
    prevIn_raw: 100, // unused, ignored
    prevStock: 50, currStock: 60, prevRestock: 5, currRestock: 8,
  },
  'A-2': {
    prevIn: 50, currIn: 100, prevPerDay: 5, currPerDay: 10,
    prevOut: 10, currOut: 30, prevPayout: 20.0, currPayout: 30.0,
    prevStock: 25, currStock: 40, prevRestock: 2, currRestock: 4,
  },
}

describe('StoreTotalsHeader', () => {
  it('when_mode_IN_should_render_IN_labels_and_summed_values', () => {
    render(<StoreTotalsHeader diffMap={diffMap} mode="IN" />)
    expect(screen.getByTestId('store-label-prevIn').textContent).toBe('前IN')
    expect(screen.getByTestId('store-label-currIn').textContent).toBe('今IN')
    expect(screen.getByTestId('store-label-prevPerDay').textContent).toBe('前/日')
    expect(screen.getByTestId('store-label-currPerDay').textContent).toBe('今/日')
    expect(screen.getByTestId('store-value-prevIn').textContent).toBe('150')
    expect(screen.getByTestId('store-value-currIn').textContent).toBe('300')
  })

  it('when_mode_OUT_should_render_OUT_labels_and_weighted_payout', () => {
    // SUM(prevOut)=40, SUM(prevIn)=150 → 26.7%
    // SUM(currOut)=70, SUM(currIn)=300 → 23.3%
    render(<StoreTotalsHeader diffMap={diffMap} mode="OUT" />)
    expect(screen.getByTestId('store-label-prevOut').textContent).toBe('前OUT')
    expect(screen.getByTestId('store-label-currPayout').textContent).toBe('今出率')
    expect(screen.getByTestId('store-value-prevOut').textContent).toBe('40')
    expect(screen.getByTestId('store-value-currOut').textContent).toBe('70')
    expect(screen.getByTestId('store-value-prevPayout').textContent).toBe('26.7%')
    expect(screen.getByTestId('store-value-currPayout').textContent).toBe('23.3%')
  })

  it('when_mode_STOCK_should_render_stock_labels_and_summed_values', () => {
    render(<StoreTotalsHeader diffMap={diffMap} mode="STOCK" />)
    expect(screen.getByTestId('store-label-prevStock').textContent).toBe('前在庫')
    expect(screen.getByTestId('store-label-currRestock').textContent).toBe('今補充')
    expect(screen.getByTestId('store-value-prevStock').textContent).toBe('75')
    expect(screen.getByTestId('store-value-currStock').textContent).toBe('100')
    expect(screen.getByTestId('store-value-prevRestock').textContent).toBe('7')
    expect(screen.getByTestId('store-value-currRestock').textContent).toBe('12')
  })

  it('when_onModeChange_provided_should_render_toggle_and_fire_callback', () => {
    const onModeChange = vi.fn()
    render(<StoreTotalsHeader diffMap={diffMap} mode="IN" onModeChange={onModeChange} />)
    expect(screen.getByTestId('patrol-view-mode-toggle')).toBeTruthy()
    fireEvent.click(screen.getByTestId('patrol-view-mode-btn-OUT'))
    expect(onModeChange).toHaveBeenCalledWith('OUT')
    fireEvent.click(screen.getByTestId('patrol-view-mode-btn-STOCK'))
    expect(onModeChange).toHaveBeenCalledWith('STOCK')
  })

  it('when_onModeChange_omitted_should_not_render_toggle', () => {
    render(<StoreTotalsHeader diffMap={diffMap} mode="IN" />)
    expect(screen.queryByTestId('patrol-view-mode-toggle')).toBeNull()
  })

  it('when_diffMap_missing_should_render_dash_for_all_cells', () => {
    render(<StoreTotalsHeader diffMap={{}} mode="IN" />)
    expect(screen.getByTestId('store-value-prevIn').textContent).toBe('−')
    expect(screen.getByTestId('store-value-currIn').textContent).toBe('−')
  })
})
