// @vitest-environment happy-dom
// SPEC-PAGEHEADER-LONG-TITLE-AUTOFIT-01 (D-061): title文字数によるfontクラス自動選択
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

import { PageHeader } from '../../shared/ui/PageHeader'

function renderHeader(props) {
  return render(
    <MemoryRouter>
      <PageHeader module="clawsupport" {...props} />
    </MemoryRouter>
  )
}

describe('SPEC-PAGEHEADER-LONG-TITLE-AUTOFIT-01: PageHeader title font auto-shrink', () => {
  it('when_title_is_15_chars_or_fewer_font_is_text_2xl', () => {
    const title = '123456789012345' // 15 chars
    renderHeader({ title })
    expect(screen.getByText(title).className).toContain('text-2xl')
  })

  it('when_title_is_16_to_19_chars_font_is_text_xl', () => {
    const title = '123456789012345678' // 18 chars
    renderHeader({ title })
    const el = screen.getByText(title)
    expect(el.className).toContain('text-xl')
    expect(el.className).not.toContain('text-2xl')
  })

  it('when_title_is_20_chars_or_more_font_is_text_lg', () => {
    const title = '12345678901234567890' // 20 chars
    renderHeader({ title })
    expect(screen.getByText(title).className).toContain('text-lg')
  })

  it('when_title_is_not_a_string_font_falls_back_to_text_2xl', () => {
    renderHeader({ title: 12345 })
    expect(screen.getByText('12345').className).toContain('text-2xl')
  })
})
