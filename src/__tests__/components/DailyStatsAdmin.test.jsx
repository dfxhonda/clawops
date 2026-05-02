// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// モック
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../lib/auth/AuthProvider', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../services/stats', () => ({
  triggerDailyStatsCompute: vi.fn(),
}))

import { useAuth } from '../../hooks/useAuth'
import { triggerDailyStatsCompute } from '../../services/stats'
import DailyStatsAdmin from '../../manesupport/pages/DailyStatsAdmin'

function renderPage() {
  return render(
    <MemoryRouter>
      <DailyStatsAdmin />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ role: 'admin' })
})

describe('DailyStatsAdmin', () => {
  it('staff ロールはホームへリダイレクト', () => {
    useAuth.mockReturnValue({ role: 'staff' })
    renderPage()
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('昨日の日付がデフォルトで入っている', () => {
    renderPage()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const expected = yesterday.toISOString().slice(0, 10)
    expect(screen.getByDisplayValue(expected)).toBeTruthy()
  })

  it('「集計実行」を押すと triggerDailyStatsCompute が呼ばれる', async () => {
    triggerDailyStatsCompute.mockResolvedValue({ count: 12 })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /集計実行/ }))
    await waitFor(() => expect(triggerDailyStatsCompute).toHaveBeenCalledOnce())
  })

  it('成功時に「N ブース分の集計が完了しました」が表示される', async () => {
    triggerDailyStatsCompute.mockResolvedValue({ count: 27 })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /集計実行/ }))
    await waitFor(() => expect(screen.getByText(/27 ブース分の集計が完了しました/)).toBeTruthy())
  })
})
