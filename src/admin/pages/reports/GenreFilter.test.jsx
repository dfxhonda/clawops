// @vitest-environment happy-dom
// GenreFilter: 機種別フィルタ (crane/gacha/changer/other/all)
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import GenreFilter from './GenreFilter'

afterEach(() => cleanup())

describe('GenreFilter', () => {
  it('when_crane_is_active_should_render_with_accent_style', () => {
    render(<GenreFilter value="crane" onChange={vi.fn()} />)
    expect(screen.getByTestId('genre-crane').className).toContain('bg-accent')
  })

  it('when_inactive_genre_should_not_have_accent_style', () => {
    render(<GenreFilter value="crane" onChange={vi.fn()} />)
    expect(screen.getByTestId('genre-gacha').className).not.toContain('bg-accent')
  })

  it('when_genre_button_clicked_should_call_onChange_with_key', () => {
    const onChange = vi.fn()
    render(<GenreFilter value="crane" onChange={onChange} />)
    fireEvent.click(screen.getByTestId('genre-all'))
    expect(onChange).toHaveBeenCalledWith('all')
  })

  it('when_disabled_should_not_invoke_onChange', () => {
    const onChange = vi.fn()
    render(<GenreFilter value="crane" onChange={onChange} disabled />)
    fireEvent.click(screen.getByTestId('genre-gacha'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('when_disabledReason_provided_should_render_reason_text', () => {
    render(<GenreFilter value="all" onChange={vi.fn()} disabled disabledReason="集金は機種別非対応" />)
    expect(screen.getByText('集金は機種別非対応')).toBeTruthy()
  })

  it('when_rendered_should_have_all_5_genre_buttons', () => {
    render(<GenreFilter value="all" onChange={vi.fn()} />)
    expect(screen.getByTestId('genre-all')).toBeTruthy()
    expect(screen.getByTestId('genre-crane')).toBeTruthy()
    expect(screen.getByTestId('genre-gacha')).toBeTruthy()
    expect(screen.getByTestId('genre-changer')).toBeTruthy()
    expect(screen.getByTestId('genre-other')).toBeTruthy()
  })
})
