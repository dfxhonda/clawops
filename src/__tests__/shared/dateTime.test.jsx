// @vitest-environment happy-dom
// DateTime shared UI component — format branches + null guard
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import DateTime from '../../shared/ui/DateTime'

const ISO = '2026-06-29T10:00:00+09:00'

describe('DateTime', () => {
  it('when_value_null_should_render_nothing', () => {
    const { container } = render(<DateTime value={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('when_invalid_date_should_render_nothing', () => {
    const { container } = render(<DateTime value="not-a-date" />)
    expect(container.firstChild).toBeNull()
  })

  it('when_format_date_should_render_span', () => {
    const { container } = render(<DateTime value={ISO} format="date" />)
    expect(container.querySelector('span')).toBeTruthy()
  })

  it('when_format_short_should_render_span', () => {
    const { container } = render(<DateTime value={ISO} format="short" />)
    expect(container.querySelector('span')).toBeTruthy()
  })

  it('when_format_time_should_render_span', () => {
    const { container } = render(<DateTime value={ISO} format="time" />)
    expect(container.querySelector('span')).toBeTruthy()
  })

  it('when_format_datetime_should_render_span', () => {
    const { container } = render(<DateTime value={ISO} format="datetime" />)
    expect(container.querySelector('span')).toBeTruthy()
  })

  it('when_format_full_default_should_render_span', () => {
    const { container } = render(<DateTime value={ISO} />)
    expect(container.querySelector('span')).toBeTruthy()
  })
})
