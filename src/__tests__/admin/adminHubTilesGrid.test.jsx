// @vitest-environment happy-dom
// AdminHubTilesGrid: coming-soon tile toast + impl tile navigation
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))

import AdminHubTilesGrid from '../../admin/components/AdminHubTilesGrid'

afterEach(() => { cleanup(); mockNavigate.mockReset() })

const TILES = [
  { path: '/admin/masters', label: 'マスター', desc: 'Masters', impl: true },
  { path: '/admin/future', label: '未来機能', desc: 'Coming soon', impl: false },
]

describe('AdminHubTilesGrid', () => {
  it('when_impl_true_tile_clicked_should_navigate', () => {
    render(<AdminHubTilesGrid tiles={TILES} testid="hub" />)
    fireEvent.click(screen.getByTestId('hub-tile-マスター'))
    expect(mockNavigate).toHaveBeenCalledWith('/admin/masters')
  })

  it('when_impl_false_tile_clicked_should_show_coming_soon_toast', async () => {
    render(<AdminHubTilesGrid tiles={TILES} testid="hub" />)
    fireEvent.click(screen.getByTestId('hub-tile-未来機能'))
    await waitFor(() => screen.getByTestId('hub-coming-soon-toast'))
    expect(screen.getByText('現在開発中です')).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
