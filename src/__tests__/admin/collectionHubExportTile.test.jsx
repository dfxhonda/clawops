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

  it('BADGE-CLEANUP-02: implemented tile shows NO badge (実装済/未実装/準備中 all absent)', () => {
    // SPEC-ADMIN-REPORTS-BADGE-CLEANUP-02 supersedes the old AC4 (which asserted a
    // 実装済 badge). Implemented is the normal state -> no badge. Only 準備中 (impl:false)
    // would render one, and all collection tiles are impl:true.
    wrap()
    const tile = screen.getByTestId('collection-hub-tile-集金抽出')
    expect(tile.querySelector('span')).toBeNull()
    expect(tile.textContent).not.toContain('実装済')
    expect(tile.textContent).not.toContain('未実装')
    expect(tile.textContent).not.toContain('準備中')
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
