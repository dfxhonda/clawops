// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { createMockSupabase } from '../helpers/supabaseMock'
import { makeSession, resetFixtureIds } from '../helpers/fixtures'
import { renderPage } from '../helpers/renderPage'

// --- Mocks ---
let mockSupabase
vi.mock('../../lib/supabase', () => ({ get supabase() { return mockSupabase } }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal()
  return { ...mod, useNavigate: () => mockNavigate }
})

vi.mock('../../lib/auth/AuthProvider', () => ({
  useAuth: () => ({ staffId: 'STAFF01', role: 'admin', name: 'テスト太郎' })
}))

// --- Setup ---
let InventoryReceive

beforeEach(async () => {
  resetFixtureIds()
  const { clearCache } = await import('../../services/utils')
  clearCache()

  mockSupabase = createMockSupabase({
    locations: [
      { location_id: 'LOC01', location_name: '本社倉庫', is_active: true, parent_location_id: null },
    ],
    prize_masters: [
      { prize_id: 'PZ001', prize_name: 'テスト景品A', status: 'active', jan_code: '123', original_cost: 100, supplier_id: null, category: null, size: null, default_case_quantity: null, notes: null, created_at: '2026-04-01', updated_at: '2026-04-01', aliases: null, order_date: null, expected_date: null },
    ],
    prize_orders: [
      { order_id: 'ORD01', prize_id: 'PZ001', prize_name_raw: 'テスト景品A', order_date: '2026-04-01', case_quantity: 10, arrived_at: null, received_quantity: null, status: 'ordered', unit_cost: 100, notes: '', created_at: '2026-04-01', supplier_id: null, case_count: '', case_cost: '', expected_date: '2026-04-06', destination: '' },
    ],
    prize_stocks: [],
    stock_movements: [],
    staff_public: [
      { staff_id: 'STAFF01', name: 'テスト太郎', is_active: true },
    ],
    audit_logs: [],
  }, makeSession())

  const mod = await import('../../pages/inventory/InventoryReceive')
  InventoryReceive = mod.default
})

describe('InventoryReceive', () => {
  it('手動入庫の必須項目未入力でエラーが表示される', async () => {
    const { user } = renderPage(InventoryReceive)
    await screen.findByText('📦 入庫チェック')

    // 手動入庫タブに切り替え
    await user.click(screen.getByText('手動入庫'))

    // 何も入力せずに送信
    await user.click(screen.getByText('入庫を記録する'))

    // エラー表示
    await screen.findByText(/景品・入庫先・数量を入力してください/)
  })

  it('入庫先未選択で入荷確認ボタンが無効化される', async () => {
    renderPage(InventoryReceive)
    await screen.findByText('📦 入庫チェック')

    // 発注リストタブ（デフォルト）に注文が表示される
    await screen.findByText('入荷確認')

    // 入庫先を選択していないので「入荷確認」ボタンが disabled
    const arrivalBtn = screen.getByText('入荷確認')
    expect(arrivalBtn).toBeDisabled()
  })

  it('手動入庫 + ReasonSelectでreason_codeがaudit_logsに流れる', async () => {
    const { user } = renderPage(InventoryReceive)
    await screen.findByText('📦 入庫チェック')

    // 入庫先を選択
    const locSelect = screen.getAllByRole('combobox')[0]
    await user.selectOptions(locSelect, 'LOC01')

    // 手動入庫タブに切り替え
    await user.click(screen.getByText('手動入庫'))

    // 景品を検索して選択
    const searchInput = screen.getByPlaceholderText('景品名・JANコードで検索...')
    await user.type(searchInput, 'テスト')

    // 検索結果から景品を選択（複数の「テスト景品A」があるのでボタン内のものをクリック）
    const prizeButtons = await screen.findAllByText('テスト景品A')
    // 最初のマッチ（検索結果の景品ボタン内のdiv.font-medium）をクリック
    await user.click(prizeButtons[0])

    // 数量を入力（NumberInputのtype=tel）
    const telInputs = document.querySelectorAll('input[type="tel"]')
    await user.type(telInputs[0], '5')

    // ReasonSelectでARRIVALを選択（最後のcombobox）
    await waitFor(() => expect(screen.getByText('変更理由')).toBeInTheDocument())
    const allSelects = screen.getAllByRole('combobox')
    const reasonSelect = allSelects[allSelects.length - 1]
    await user.selectOptions(reasonSelect, 'ARRIVAL')

    // 送信
    await user.click(screen.getByText('入庫を記録する'))

    // 成功メッセージ
    await screen.findByText(/入庫しました/)

    // audit_logs に reason_code が記録されている
    await waitFor(() => {
      const logs = mockSupabase._getTable('audit_logs')
      const arrivalLog = logs.find(l => l.reason_code === 'ARRIVAL')
      expect(arrivalLog).toBeTruthy()
    })
  })
})
