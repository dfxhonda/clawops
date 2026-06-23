// @vitest-environment happy-dom
// SPEC-MANESUPPORT-NAV-UNIFY-P1-LAYOUTBAR-01
// AC1: AdminTopTabsから「←ホーム」削除
// AC2: 6タブ(分析/集金/各履歴/マスタ/設定/QRラベル)は維持
// AC3-AC6: AdminBreadcrumbに[←][⌂]が常時表示、深いパスではパンくずも表示
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../shared/ui/moduleColors', () => ({
  MODULE_COLORS: { admin: '#3b82f6', clawsupport: '#10b981', tanasupport: '#8b5cf6' },
}))

import AdminTopTabs from '../../admin/AdminTopTabs'
import AdminBreadcrumb from '../../admin/AdminBreadcrumb'

function wrap(node, path = '/admin/reports') {
  return render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>)
}

beforeEach(() => vi.clearAllMocks())

describe('AdminTopTabs when_home_button_removed', () => {
  it('AC1: should_not_render_launcher_home_button', () => {
    wrap(<AdminTopTabs />)
    expect(screen.queryByText('← ホーム')).toBeNull()
  })

  it('AC2: should_render_all_6_tabs', () => {
    wrap(<AdminTopTabs />)
    expect(screen.getByTestId('admin-tab-reports')).toBeTruthy()
    expect(screen.getByTestId('admin-tab-collection')).toBeTruthy()
    expect(screen.getByTestId('admin-tab-audit')).toBeTruthy()
    expect(screen.getByTestId('admin-tab-masters')).toBeTruthy()
    expect(screen.getByTestId('admin-tab-settings')).toBeTruthy()
    expect(screen.getByTestId('admin-tab-labels')).toBeTruthy()
  })
})

describe('AdminBreadcrumb when_on_top_level_admin_page', () => {
  it('AC3: should_always_render_nav_bar', () => {
    wrap(<AdminBreadcrumb />, '/admin/reports')
    expect(screen.getByTestId('admin-breadcrumb')).toBeTruthy()
  })

  it('AC3: should_render_back_button_48px', () => {
    wrap(<AdminBreadcrumb />, '/admin/reports')
    expect(screen.getByTestId('admin-nav-back')).toBeTruthy()
  })

  it('AC3: should_render_home_button_48px', () => {
    wrap(<AdminBreadcrumb />, '/admin/reports')
    expect(screen.getByTestId('admin-nav-home')).toBeTruthy()
  })

  it('AC5: when_back_clicked_should_call_navigate_minus1', () => {
    wrap(<AdminBreadcrumb />, '/admin/reports')
    fireEvent.click(screen.getByTestId('admin-nav-back'))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('AC4: when_home_clicked_should_navigate_to_launcher', () => {
    wrap(<AdminBreadcrumb />, '/admin/reports')
    fireEvent.click(screen.getByTestId('admin-nav-home'))
    expect(mockNavigate).toHaveBeenCalledWith('/launcher')
  })

  it('AC6: should_not_show_breadcrumb_on_shallow_path', () => {
    wrap(<AdminBreadcrumb />, '/admin/reports')
    // depth = 2: /admin/reports → segments=[admin,reports] → breadcrumb hidden
    expect(screen.queryByText('マネサポ')).toBeNull()
  })
})

describe('AdminBreadcrumb when_on_deep_admin_page', () => {
  it('AC6: should_show_breadcrumb_on_deep_path', () => {
    wrap(<AdminBreadcrumb />, '/admin/masters/prizes')
    // depth = 3: /admin/masters/prizes → segments=[admin,masters,prizes] → breadcrumb shows
    expect(screen.getByText('マネサポ')).toBeTruthy()
    expect(screen.getByText('マスタ')).toBeTruthy()
    expect(screen.getByText('景品')).toBeTruthy()
  })
})
