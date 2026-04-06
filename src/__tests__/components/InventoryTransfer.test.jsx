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
let InventoryTransfer

beforeEach(async () => {
  resetFixtureIds()
  const { clearCache } = await import('../../services/utils')
  clearCache()

  mockSupabase = createMockSupabase({
    locations: [
      { location_id: 'LOC01', location_name: '本社倉庫', is_active: true, parent_location_id: null },
      { location_id: 'LOC02', location_name: '支店倉庫', is_active: true, parent_location_id: null },
    ],
    prize_stocks: [
      makeStockRecord({ owner_type: 'location', owner_id: 'LOC01', quantity: 20 }),
    ],
    stock_movements: [],
    staff_public: [
      { staff_id: 'STAFF01', name: 'テスト太郎', is_active: true },
    ],
    audit_logs: [],
  }, makeSession())

  const mod = await import('../../pages/inventory/InventoryTransfer')
  InventoryTransfer = mod.default
})

describe('InventoryTransfer', () => {
  it('必須項目未入力でエラーが表示される', async () => {
    const { user } = renderPage(InventoryTransfer)
    await screen.findByText('🚚 在庫移管')

    // 拠点間を選択
    await user.click(screen.getByText('🏢→🏢'))

    // 移動元を選択
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[0], 'LOC01')

    // 景品を選択
    await screen.findByText('テスト景品A')
    await user.click(screen.getByText('テスト景品A'))

    // 移動先セレクトが表示されるまで待つ
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))

    // 移動先を選択せずに送信
    await user.click(screen.getByText('移管を実行する'))

    await screen.findByText(/景品・移動先・数量を入力してください/)
  })

  it('在庫不足エラーで再試行ボタンが機能する', async () => {
    // 在庫を少なくする
    mockSupabase._getTable('prize_stocks')[0].quantity = 3

    const { user } = renderPage(InventoryTransfer)
    await screen.findByText('🚚 在庫移管')

    // loc2loc
    await user.click(screen.getByText('🏢→🏢'))
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[0], 'LOC01')

    await screen.findByText('テスト景品A')
    await user.click(screen.getByText('テスト景品A'))

    // 移動先セレクトが表示される
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    const destSelect = screen.getAllByRole('combobox')[1]
    await user.selectOptions(destSelect, 'LOC02')

    // 数量を在庫超過に変更（NumberInputはtype=telだがdisplayValueで取得）
    const qtyInput = screen.getByDisplayValue('3')
    await user.clear(qtyInput)
    await user.type(qtyInput, '99')

    // 送信
    await user.click(screen.getByText('移管を実行する'))

    // エラー表示
    await screen.findByText(/在庫不足/)

    // 再試行ボタンクリック
    await user.click(screen.getByText('再試行'))

    // 同じ条件なのでエラーが再表示される
    await screen.findByText(/在庫不足/)
  })

  it('ReasonSelectのreason_codeがaudit_logsに流れる', async () => {
    const { user } = renderPage(InventoryTransfer)
    await screen.findByText('🚚 在庫移管')

    // loc2staff（担当車向け）
    await user.click(screen.getByText('🏢→🚗'))

    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[0], 'LOC01')

    await screen.findByText('テスト景品A')
    await user.click(screen.getByText('テスト景品A'))

    // 担当者名を直接テキスト入力（staffListが空なのでテキスト入力を使う）
    const staffInput = await screen.findByPlaceholderText('または新しい担当者名を入力')
    await user.type(staffInput, 'テスト太郎')

    // ReasonSelect で「移管」を選択
    // ReasonSelectのセレクトは「変更理由」ラベルの下にある
    await waitFor(() => expect(screen.getByText('変更理由')).toBeInTheDocument())
    // comboboxの中からReasonSelectのものを特定（最後のselect）
    const allSelects = screen.getAllByRole('combobox')
    const reasonSelect = allSelects[allSelects.length - 1]
    await user.selectOptions(reasonSelect, 'TRANSFER')

    // 送信
    await user.click(screen.getByText('移管を実行する'))

    // 成功メッセージ
    await screen.findByText(/を移管しました/)

    // audit_logs に reason_code が記録されている
    await waitFor(() => {
      const logs = mockSupabase._getTable('audit_logs')
      const transferLog = logs.find(l => l.reason_code === 'TRANSFER')
      expect(transferLog).toBeTruthy()
    })
  })
})
