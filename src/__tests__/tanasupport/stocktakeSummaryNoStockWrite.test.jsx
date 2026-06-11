// @vitest-environment happy-dom
// SPEC-STOCKTAKE-COMPLETED-NO-STOCKWRITE-01: handleApply が prize_stocks/stock_movements を叩かない
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import StocktakeSummary from '../../tanasupport/pages/StocktakeSummary'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const fromCalls = []
const mockSessionsUpdate = vi.fn()

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table) {
    const builder = {
      select() { return builder },
      eq()     { return builder },
      in()     { return builder },
      single() { return builder },
      maybeSingle() { return builder },
      order()  { return builder },
      limit()  { return builder },
      update(payload) {
        if (table === 'stocktake_sessions') mockSessionsUpdate(payload)
        return { eq: () => Promise.resolve({ error: null }) }
      },
      insert() { return Promise.resolve({ error: null }) },
      then(resolve) {
        if (table === 'stocktake_sessions') {
          return Promise.resolve({ data: {
            session_id: 'sess-1',
            status: 'in_progress',
            location_owner_type: 'staff',
            location_owner_id: 'staff-1',
            started_at: '2026-06-11T10:00:00Z',
            finished_at: null,
          }}).then(resolve)
        }
        if (table === 'stocktake_lines') {
          return Promise.resolve({ data: [
            { line_id: 'l1', prize_id: 'p1', system_quantity: 5, counted_quantity: 3, counted_by: 'staff-1', note: null },
          ]}).then(resolve)
        }
        if (table === 'prize_masters') {
          return Promise.resolve({ data: [{ prize_id: 'p1', prize_name: 'テスト景品' }] }).then(resolve)
        }
        if (table === 'staff') {
          return Promise.resolve({ data: { name: '田中' } }).then(resolve)
        }
        return Promise.resolve({ data: null }).then(resolve)
      },
    }
    return builder
  }
  return {
    supabase: {
      from: (table) => {
        fromCalls.push(table)
        return makeBuilder(table)
      },
    },
  }
})

function renderSummary() {
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('staff-1')
  return render(
    <MemoryRouter initialEntries={['/stock/session/sess-1/summary']}>
      <Routes>
        <Route path="/stock/session/:sessionId/summary" element={<StocktakeSummary />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  fromCalls.length = 0
  mockSessionsUpdate.mockClear()
  mockNavigate.mockClear()
})

describe('StocktakeSummary handleApply (SPEC-STOCKTAKE-COMPLETED-NO-STOCKWRITE-01)', () => {
  it('when_締めボタン押下_should_NOT_call_prize_stocks_or_stock_movements', async () => {
    renderSummary()
    await waitFor(() => expect(screen.queryByText('読み込み中...')).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: /棚卸を締める/ }))

    await waitFor(() => {
      const badCalls = fromCalls.filter(t => t === 'prize_stocks' || t === 'stock_movements')
      expect(badCalls).toHaveLength(0)
    })
  })

  it('when_締めボタン押下_should_update_stocktake_sessions_completed', async () => {
    renderSummary()
    await waitFor(() => expect(screen.queryByText('読み込み中...')).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: /棚卸を締める/ }))

    await waitFor(() => {
      expect(mockSessionsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' })
      )
    })
  })

  it('when_applied_should_show_締め済み_banner', async () => {
    renderSummary()
    await waitFor(() => expect(screen.queryByText('読み込み中...')).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: /棚卸を締める/ }))

    await waitFor(() => {
      expect(screen.getByText(/締め済み \(承認待ち\)/)).toBeTruthy()
    })
  })

  it('when_rendered_should_show_approval_note_under_button', async () => {
    renderSummary()
    await waitFor(() => expect(screen.queryByText('読み込み中...')).toBeNull())
    expect(screen.getByText(/在庫への反映は管理者承認時に行われます/)).toBeTruthy()
  })
})
