// @vitest-environment happy-dom
// M2 Stage 1: StocktakeInput (新スキーマ) のスモークテスト
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ locationId: 'KRM02' }),
  }
})

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    staffId: 'staff-test-001',
    staffRole: 'manager',
    isLoggedIn: true,
    loading: false,
  }),
}))

vi.mock('../../tanasupport/stocktake/api', () => ({
  getOrCreateMonthSession: vi.fn().mockResolvedValue({
    session_id: 'sess-test-001',
    month: '2026-05-01',
    status: 'open',
  }),
  getLocationPrizes: vi.fn().mockResolvedValue([
    { prize_id: 'P001', prize_name: 'テスト景品A', theoretical_count: 5 },
  ]),
  getOwnerItemsMap: vi.fn().mockResolvedValue({}),
  upsertItem: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { location_name: '久留米倉庫' },
        error: null,
      }),
    }),
  },
}))

vi.mock('../../shared/ui/PageHeader', () => ({
  PageHeader: ({ title }) => <div data-testid="page-header">{title}</div>,
}))

import StocktakeInput from '../../tanasupport/stocktake/StocktakeInput'

describe('StocktakeInput (M2 Stage 1)', () => {
  it('ロード後に景品リストが表示される', async () => {
    render(<StocktakeInput />)
    await waitFor(() => {
      expect(screen.getByTestId('stocktake-input')).toBeInTheDocument()
    }, { timeout: 3000 })
    await waitFor(() => {
      expect(screen.getByText('テスト景品A')).toBeInTheDocument()
    })
  })

  it('入力欄が表示される', async () => {
    render(<StocktakeInput />)
    await waitFor(() => {
      expect(screen.getByTestId('prize-input-P001')).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})
