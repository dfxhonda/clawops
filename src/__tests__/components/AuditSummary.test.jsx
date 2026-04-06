// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ManagerRoute } from '../../components/ProtectedRoute'
import { createMockSupabase } from '../helpers/supabaseMock'
import { makeSession, resetFixtureIds } from '../helpers/fixtures'

// --- Mutable mocks ---
let mockAuth = {}
let mockSupabase

vi.mock('../../lib/auth/AuthProvider', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }) => children,
}))

vi.mock('../../lib/supabase', () => ({ get supabase() { return mockSupabase } }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal()
  return { ...mod, useNavigate: () => mockNavigate }
})

// --- Test data ---
// stock_count_adjust×2 (2026-03 + 2026-04), stock_transfer×1 (2026-04), order_arrived×1 (2026-04)
const testLogs = [
  {
    id: 1, staff_id: 'STAFF01', action: 'stock_count_adjust', target_table: 'prize_stocks',
    target_id: 'STK01', detail: '棚卸し: テスト景品A', reason_code: 'COUNT_DIFF', reason_note: null,
    before_data: null, after_data: null, created_at: '2026-03-15T10:00:00Z',
  },
  {
    id: 2, staff_id: 'STAFF01', action: 'stock_count_adjust', target_table: 'prize_stocks',
    target_id: 'STK02', detail: '棚卸し: テスト景品B', reason_code: 'COUNT_DIFF', reason_note: null,
    before_data: null, after_data: null, created_at: '2026-04-01T10:00:00Z',
  },
  {
    id: 3, staff_id: 'STAFF02', action: 'stock_transfer', target_table: 'stock_movements',
    target_id: '', detail: 'テスト景品C x2: location/LOC01 → staff/STAFF02',
    reason_code: 'TRANSFER', reason_note: null, before_data: null, after_data: null,
    created_at: '2026-04-02T10:00:00Z',
  },
  {
    id: 4, staff_id: 'STAFF01', action: 'order_arrived', target_table: 'prize_orders',
    target_id: 'ORD01', detail: '入荷確認', reason_code: null, reason_note: null,
    before_data: null, after_data: null, created_at: '2026-04-03T10:00:00Z',
  },
]

let AuditSummary

beforeEach(async () => {
  resetFixtureIds()
  const { clearCache } = await import('../../services/utils')
  clearCache()

  mockAuth = {
    staffId: 'STAFF01', staffName: 'テスト太郎', staffRole: 'manager',
    isLoggedIn: true, loading: false, session: {}, accessToken: 'tok',
  }

  mockSupabase = createMockSupabase({
    audit_logs: testLogs.map(l => ({ ...l })),
    staff_public: [
      { staff_id: 'STAFF01', name: 'テスト太郎', is_active: true },
      { staff_id: 'STAFF02', name: 'テスト花子', is_active: true },
    ],
  }, makeSession())

  const mod = await import('../../pages/AuditSummary')
  AuditSummary = mod.default
})

function renderWithRoutes(Component, authOverrides = {}) {
  Object.assign(mockAuth, authOverrides)
  const user = userEvent.setup()
  const result = render(
    <MemoryRouter initialEntries={['/admin/audit-summary']}>
      <Routes>
        <Route path="/admin/audit-summary" element={<ManagerRoute><Component /></ManagerRoute>} />
        <Route path="/" element={<div>HOME PAGE</div>} />
      </Routes>
    </MemoryRouter>
  )
  return { user, ...result }
}

describe('AuditSummary 監査サマリ画面', () => {
  it('staff ロールはホームへリダイレクト', () => {
    renderWithRoutes(AuditSummary, { staffRole: 'staff' })
    expect(screen.queryByText('監査サマリ')).not.toBeInTheDocument()
    expect(screen.getByText('HOME PAGE')).toBeInTheDocument()
  })

  it('日付未入力で「期間を選択してください」が表示される', async () => {
    renderWithRoutes(AuditSummary)
    await screen.findByText('監査サマリ')
    expect(screen.getByText('期間を選択してください')).toBeInTheDocument()
    // 「表示する」ボタンは無効
    expect(screen.getByRole('button', { name: '表示する' })).toBeDisabled()
  })

  it('集計件数が正しく表示される', async () => {
    const { user } = renderWithRoutes(AuditSummary)
    await screen.findByText('監査サマリ')

    // 日付入力
    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-03-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-04-30' } })

    // 「表示する」ボタンが有効になったのを確認してクリック
    const btn = screen.getByRole('button', { name: '表示する' })
    await waitFor(() => expect(btn).not.toBeDisabled())
    await user.click(btn)

    // stock_count_adjust = 2
    await waitFor(() => {
      expect(screen.getByText('棚卸し差分')).toBeInTheDocument()
    })
    // カードに2が表示される
    const cards = screen.getAllByText('2')
    expect(cards.length).toBeGreaterThanOrEqual(1)
    // 移管=1, 入荷=1 のカード
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2)
  })

  it('月別タブで月ごとに分かれて表示される', async () => {
    renderWithRoutes(AuditSummary)
    await screen.findByText('監査サマリ')

    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-03-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-04-30' } })

    const btn = screen.getByRole('button', { name: '表示する' })
    await waitFor(() => expect(btn).not.toBeDisabled())
    fireEvent.click(btn)

    // 月別タブが表示される（デフォルトがアクティブ）
    await screen.findByText('月別')

    // 2つの月が表示される
    await waitFor(() => {
      expect(screen.getByText('2026-04')).toBeInTheDocument()
      expect(screen.getByText('2026-03')).toBeInTheDocument()
    })
  })
})
