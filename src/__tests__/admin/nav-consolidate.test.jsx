// @vitest-environment happy-dom
// J-NAV-CONSOLIDATE-01: ナビ統合 - PCH取込タブ削除 + クレサポ側集金タイル削除
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ storeCode: 'TEST01' }) }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { store_name: 'テスト店' } }) }),
      }),
    }),
  },
}))

vi.mock('../../services/patrol', () => ({
  getPatrolMachines:  vi.fn().mockResolvedValue([]),
  getTodayReadings:   vi.fn().mockResolvedValue({}),
}))

import AdminTopTabs from '../../admin/AdminTopTabs'
import AdminMastersHubPage from '../../admin/pages/AdminMastersHubPage'
import ClawsupportStoreDash from '../../clawsupport/pages/ClawsupportStoreDash'

function renderWithRouter(node, initialEntry = '/admin/masters') {
  return render(<MemoryRouter initialEntries={[initialEntry]}>{node}</MemoryRouter>)
}

beforeEach(() => { vi.clearAllMocks() })

describe('AdminTopTabs (マネサポ top nav) when_pch_intake_tab_removed', () => {
  it('should_not_render_import_tab_button', () => {
    renderWithRouter(<AdminTopTabs />)
    expect(screen.queryByTestId('admin-tab-import')).toBeNull()
  })

  it('should_still_render_collection_tab_button', () => {
    renderWithRouter(<AdminTopTabs />)
    expect(screen.getByTestId('admin-tab-collection')).toBeTruthy()
  })

  it('should_still_render_masters_tab_button', () => {
    renderWithRouter(<AdminTopTabs />)
    expect(screen.getByTestId('admin-tab-masters')).toBeTruthy()
  })
})

describe('AdminMastersHubPage when_pch_intake_kept_as_hub_card', () => {
  it('should_render_torikomi_hub_tile_as_consolidated_entry', () => {
    renderWithRouter(<AdminMastersHubPage />)
    expect(screen.getByTestId('hub-tile-取込')).toBeTruthy()
  })
})

describe('ClawsupportStoreDash (クレサポ店舗ダッシュ) when_collection_tile_removed', () => {
  it('should_not_render_collection_tile_label', () => {
    renderWithRouter(<ClawsupportStoreDash />, '/clawsupport/store/TEST01')
    // 集金タイル自体を消すので「集金」テキストノードが見つからないこと
    expect(screen.queryByText('集金')).toBeNull()
  })

  it('should_still_render_patrol_tile_label', () => {
    renderWithRouter(<ClawsupportStoreDash />, '/clawsupport/store/TEST01')
    expect(screen.getByText('巡回')).toBeTruthy()
  })
})
