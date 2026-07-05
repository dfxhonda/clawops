// @vitest-environment happy-dom
// SPEC-UI-LANDSCAPE-SIDEHEADER-01
// DOM-level checks (media-query visual gating is covered by Playwright at real
// viewports). Both the normal PageHeader and the vertical strip render in the DOM;
// CSS decides which is visible per orientation/height.
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const COMPONENT_SRC = readFileSync(
  resolve(process.cwd(), 'src/components/LandscapeSideHeader.jsx'),
  'utf-8'
)

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../../shared/ui/moduleColors', () => ({
  MODULE_COLORS: { admin: '#3b82f6' },
}))

import LandscapeSideHeader from '../../components/LandscapeSideHeader'

function wrap({ onBack = vi.fn(), hideHome = false } = {}) {
  const result = render(
    <MemoryRouter>
      <LandscapeSideHeader module="admin" title="売上予測" onBack={onBack} hideHome={hideHome} />
    </MemoryRouter>
  )
  return { onBack, ...result }
}

beforeEach(() => { mockNavigate.mockReset() })

describe('LandscapeSideHeader', () => {
  it('renders the vertical strip with title in vertical-rl writing mode', () => {
    wrap()
    const strip = screen.getByTestId('landscape-side-header')
    expect(strip).toBeTruthy()
    const title = strip.querySelector('p')
    expect(title?.textContent).toBe('売上予測')
    expect(title?.style.writingMode).toBe('vertical-rl')
  })

  // happy-dom's CSSOM drops calc()/env() from inline styles, so assert at source
  // level (env safe-area is exercised for real in the Playwright/device pass).
  it('applies env(safe-area-inset-left) to the strip padding (source-check)', () => {
    expect(COMPONENT_SRC).toContain('env(safe-area-inset-left)')
  })

  it('gates the strip on the landscape-short variant, hidden by default (source-check)', () => {
    expect(COMPONENT_SRC).toContain('hidden landscape-short:flex')
    expect(COMPONENT_SRC).toContain('landscape-short:hidden')
  })

  it('back button in the strip calls onBack', () => {
    const { onBack } = wrap()
    fireEvent.click(screen.getByTestId('side-header-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('home button navigates to /launcher when hideHome is false', () => {
    wrap({ hideHome: false })
    fireEvent.click(screen.getByTestId('side-header-home'))
    expect(mockNavigate).toHaveBeenCalledWith('/launcher')
  })

  it('omits the home button when hideHome is true', () => {
    wrap({ hideHome: true })
    expect(screen.queryByTestId('side-header-home')).toBeNull()
  })

  it('still renders the normal PageHeader content (portrait/desktop path present in DOM)', () => {
    wrap()
    // title appears in both the PageHeader (top) and the strip -> at least 2
    expect(screen.getAllByText('売上予測').length).toBeGreaterThanOrEqual(2)
  })

  it('strip tap targets are >= 44px (w-11 h-11)', () => {
    wrap()
    const back = screen.getByTestId('side-header-back')
    expect(back.className).toContain('w-11')
    expect(back.className).toContain('h-11')
  })
})
