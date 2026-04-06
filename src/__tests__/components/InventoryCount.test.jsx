// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { createMockSupabase } from '../helpers/supabaseMock'
import { makeStockRecord, makeSession, resetFixtureIds } from '../helpers/fixtures'
import { renderPage } from '../helpers/renderPage'

// --- Mocks ---
let mockSupabase
vi.mock('../../lib/supabase', () => ({ get supabase() { return mockSupabase } }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal()
  return { ...mod, useNavigate: () => mockNavigate }
})

// --- Setup ---
let InventoryCount

beforeEach(async () => {
  resetFixtureIds()
  const { clearCache } = await import('../../services/utils')
  clearCache()

  mockSupabase = createMockSupabase({
    locations: [
      { location_id: 'LOC01', location_name: '本社倉庫', is_active: true, parent_location_id: null },
    ],
    prize_stocks: [
      makeStockRecord({ prize_id: 'PZ001', owner_type: 'location', owner_id: 'LOC01', quantity: 10 }),
      makeStockRecord({ prize_id: 'PZ002', prize_masters: { prize_name: 'テスト景品B' }, owner_type: 'location', owner_id: 'LOC01', quantity: 5 }),
    ],
    stock_movements: [],
    staff_public: [
      { staff_id: 'STAFF01', name: 'テスト太郎', is_active: true },
    ],
    audit_logs: [],
  }, makeSession())

  const mod = await import('../../pages/inventory/InventoryCount')
  InventoryCount = mod.default
})

describe('InventoryCount', () => {
  it('実数未入力で保存ボタンが無効化される', async () => {
    const { user } = renderPage(InventoryCount)
    await screen.findByText('📋 実在庫カウント')

    // 拠点を選択
    const locSelect = screen.getAllByRole('combobox')[0]
    await user.selectOptions(locSelect, 'LOC01')

    // 在庫リストが表示される
    await screen.findByText('テスト景品A')

    // 何も入力していない状態でボタンが disabled
    const saveBtn = screen.getByText(/棚卸し結果を保存する/)
    expect(saveBtn).toBeDisabled()
    expect(saveBtn).toHaveTextContent('0件')
  })

  it('全て理論値で埋める → 棚卸し完了', async () => {
    const { user } = renderPage(InventoryCount)
    await screen.findByText('📋 実在庫カウント')

    // 拠点を選択
    const locSelect = screen.getAllByRole('combobox')[0]
    await user.selectOptions(locSelect, 'LOC01')

    await screen.findByText('テスト景品A')

    // 「全て理論値で埋める」ボタン
    await user.click(screen.getByText('全て理論値で埋める'))

    // ReasonSelectが表示される（入力済みで表示条件を満たす）
    await waitFor(() => expect(screen.getByText('変更理由')).toBeInTheDocument())

    // 保存
    const saveBtn = screen.getByText(/棚卸し結果を保存する/)
    await user.click(saveBtn)

    // 成功メッセージ
    await screen.findByText(/件の棚卸し完了/)
  })

  it('reason_codeがcountStockからaudit_logsに流れる', async () => {
    const { user } = renderPage(InventoryCount)
    await screen.findByText('📋 実在庫カウント')

    // 拠点を選択
    const locSelect = screen.getAllByRole('combobox')[0]
    await user.selectOptions(locSelect, 'LOC01')

    await screen.findByText('テスト景品A')

    // クイック同値ボタンで1つ目の景品だけ入力（=10）
    const quickBtn = screen.getByText('=10')
    await user.click(quickBtn)

    // ReasonSelectが表示される
    await waitFor(() => expect(screen.getByText('変更理由')).toBeInTheDocument())

    // COUNT_DIFF を選択（最後のcomboboxがReasonSelect）
    const allSelects = screen.getAllByRole('combobox')
    const reasonSelect = allSelects[allSelects.length - 1]
    await user.selectOptions(reasonSelect, 'COUNT_DIFF')

    // 保存
    const saveBtn = screen.getByText(/棚卸し結果を保存する/)
    await user.click(saveBtn)

    // 成功メッセージ
    await screen.findByText(/件の棚卸し完了/)

    // audit_logs に reason_code が記録されている
    await waitFor(() => {
      const logs = mockSupabase._getTable('audit_logs')
      const countLog = logs.find(l => l.reason_code === 'COUNT_DIFF')
      expect(countLog).toBeTruthy()
    })
  })
})
