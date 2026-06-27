// @vitest-environment happy-dom
// SPEC-NAV-HEADER-BACK-HOME-AND-FONTSIZE-01: PageHeaderアイコンボタン + フォントサイズ
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import { PageHeader } from '../../shared/ui/PageHeader'

function renderHeader(props) {
  return render(
    <MemoryRouter>
      <PageHeader module="clawsupport" title="テスト" {...props} />
    </MemoryRouter>
  )
}

describe('SPEC-NAV-HEADER-BACK-HOME-AND-FONTSIZE-01 F1: icon nav buttons', () => {
  it('when_onBack_is_provided_back_button_is_rendered', () => {
    renderHeader({ onBack: vi.fn() })
    expect(screen.getByTestId('header-back')).toBeTruthy()
  })

  it('when_onBack_is_not_provided_back_button_is_absent', () => {
    renderHeader({})
    expect(screen.queryByTestId('header-back')).toBeNull()
  })

  it('home_button_is_rendered_by_default', () => {
    renderHeader({})
    expect(screen.getByTestId('header-home')).toBeTruthy()
  })

  it('when_hideHome_is_true_home_button_is_absent', () => {
    renderHeader({ hideHome: true })
    expect(screen.queryByTestId('header-home')).toBeNull()
  })

  it('old_menuToLauncher_testid_header_launcher_menu_is_gone', () => {
    renderHeader({ onBack: vi.fn() })
    expect(screen.queryByTestId('header-launcher-menu')).toBeNull()
  })

  it('back_button_has_w12_h12_min_tap_area', () => {
    renderHeader({ onBack: vi.fn() })
    const btn = screen.getByTestId('header-back')
    expect(btn.className).toContain('w-12')
    expect(btn.className).toContain('h-12')
  })

  it('home_button_has_w12_h12_min_tap_area', () => {
    renderHeader({})
    const btn = screen.getByTestId('header-home')
    expect(btn.className).toContain('w-12')
    expect(btn.className).toContain('h-12')
  })
})

describe('SPEC-NAV-HEADER-BACK-HOME-AND-FONTSIZE-01 F2: PageHeader font sizes', () => {
  it('title_has_text_2xl_class', () => {
    renderHeader({ title: 'テストタイトル' })
    const title = screen.getByText('テストタイトル')
    expect(title.className).toContain('text-2xl')
  })

  it('subtitle_has_text_base_class', () => {
    renderHeader({ subtitle: 'サブタイトル' })
    const sub = screen.getByText('サブタイトル')
    expect(sub.className).toContain('text-base')
  })
})
