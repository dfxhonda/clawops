// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
const testLogs = [
  {
    id: 1, staff_id: 'STAFF01', action: 'stock_transfer', target_table: 'stock_movements',
    target_id: '', detail: 'テスト景品A x5: location/LOC01 → staff/STAFF02',
    before_data: { from: { quantity: 20 }, to: { quantity: 3 } },
    after_data: { from: { quantity: 15 }, to: { quantity: 8 }, transferred: 5 },
    reason: '移管', reason_code: 'TRANSFER', reason_note: null,
    created_at: '2026-04-06T10:00:00Z',
  },
  {
    id: 2, staff_id: 'STAFF02', action: 'reading_create', target_table: 'meter_readings',
    target_id: 'B001', detail: 'メーター入力: IN=1500 OUT=80',
    before_data: null, after_data: null,
    reason: null, reason_code: null, reason_note: null,
    created_at: '2026-04-06T09:00:00Z',
  },
  {
    id: 3, staff_id: 'STAFF01', action: 'stock_count_adjust', target_table: 'prize_stocks',
    target_id: 'STK01', detail: '棚卸し: テスト景品B 理論値10 → 実数7 (差異-3)',
    before_data: { quantity: 10 }, after_data: { quantity: 7, diff: -3 },
    reason: '棚卸し差分', reason_code: 'COUNT_DIFF', reason_note: '箱破損分',
    created_at: '2026-04-05T15:00:00Z',
  },
]

let AuditLog

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

  const mod = await import('../../pages/AuditLog')
  AuditLog = mod.default
})

function renderWithRoutes(Component, authOverrides = {}) {
  Object.assign(mockAuth, authOverrides)
  const user = userEvent.setup()
  const result = render(
    <MemoryRouter initialEntries={['/admin/audit']}>
      <Routes>
        <Route path="/admin/audit" element={<ManagerRoute><Component /></ManagerRoute>} />
        <Route path="/" element={<div>HOME PAGE</div>} />
      </Routes>
    </MemoryRouter>
  )
  return { user, ...result }
}

describe('AuditLog 監査ログ画面', () => {
  it('staff ロールはホームへリダイレクト', () => {
    renderWithRoutes(AuditLog, { staffRole: 'staff' })
    expect(screen.queryByText('監査ログ')).not.toBeInTheDocument()
    expect(screen.getByText('HOME PAGE')).toBeInTheDocument()
  })

  it('manager ロールでログ一覧が表示される', async () => {
    renderWithRoutes(AuditLog)
    await screen.findByText('監査ログ')
    // ログが表示される
    await screen.findByText(/テスト景品A x5/)
    expect(screen.getAllByText(/メーター入力/).length).toBeGreaterThanOrEqual(2) // option + ログカード
  })

  it('action フィルタで結果が変わる', async () => {
    const { user } = renderWithRoutes(AuditLog)
    await screen.findByText(/テスト景品A x5/)

    // 全3件表示されている
    expect(screen.getByText('3件')).toBeInTheDocument()

    // action フィルタで stock_transfer のみに絞る
    const actionSelect = screen.getAllByRole('combobox').find(s =>
      s.querySelector('option[value="stock_transfer"]')
    )
    await user.selectOptions(actionSelect, 'stock_transfer')

    // フィルタ後は1件
    await waitFor(() => expect(screen.getByText('1件')).toBeInTheDocument())
  })

  it('差分表示が展開される', async () => {
    const { user } = renderWithRoutes(AuditLog)
    await screen.findByText(/テスト景品A x5/)

    // 最初のログ（stock_transfer）をクリックして展開
    const card = screen.getByText(/テスト景品A x5/).closest('[class*="cursor-pointer"]')
    await user.click(card)

    // 差分が表示される
    await screen.findByText('変更内容')
    // before→after の差分表示
    expect(screen.getByText(/transferred/)).toBeInTheDocument()
  })
})
