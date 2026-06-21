// @vitest-environment happy-dom
// SPEC-COLLECTION-EXPORT-TAB-PLACE-01: 集金タブに集金抽出タイルを追加
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import AdminCollectionHubPage from '../../admin/pages/AdminCollectionHubPage'

function wrap() {
  return render(<MemoryRouter><AdminCollectionHubPage /></MemoryRouter>)
}

beforeEach(() => { vi.clearAllMocks() })

describe('AdminCollectionHubPage 集金抽出タイル (SPEC-COLLECTION-EXPORT-TAB-PLACE-01)', () => {
  it('when_rendered_should_show_shukin_chushutsu_tile', () => {
    // AC1: 集金タブに 集金抽出 タイルが存在する
    wrap()
    expect(screen.getByTestId('collection-hub-tile-集金抽出')).toBeTruthy()
  })

  it('when_shukin_chushutsu_tile_clicked_should_navigate_to_collection_export', async () => {
    // AC2: タップで /admin/reports/collections へ遷移
    wrap()
    await userEvent.click(screen.getByTestId('collection-hub-tile-集金抽出'))
    expect(mockNavigate).toHaveBeenCalledWith('/admin/reports/collections')
  })

  it('when_rendered_should_show_impl_badge_on_shukin_chushutsu', () => {
    // AC4: 実装済バッジが付いている (既存タイルと同一スタイル)
    wrap()
    const tile = screen.getByTestId('collection-hub-tile-集金抽出')
    const badge = tile.querySelector('span')
    expect(badge.textContent).toBe('実装済')
    expect(badge.className).toContain('bg-green-500')
  })

  it('when_rendered_should_still_show_existing_three_tiles', () => {
    // 既存タイル 3 件が残っていること (regression guard)
    wrap()
    expect(screen.getByTestId('collection-hub-tile-集金帳票')).toBeTruthy()
    expect(screen.getByTestId('collection-hub-tile-集金フラグ編集')).toBeTruthy()
    expect(screen.getByTestId('collection-hub-tile-集金履歴')).toBeTruthy()
  })

  it('when_rendered_should_show_xlsx_desc', () => {
    // AC1: desc が「集金データのxlsx出力」
    wrap()
    const tile = screen.getByTestId('collection-hub-tile-集金抽出')
    expect(tile.textContent).toContain('集金データのxlsx出力')
  })
})
