// @vitest-environment happy-dom
// SPEC-PATROL-BOOTHUI-3FIXES-01 AC1/AC2: ClawsupportHub re-fetches badge on lf1-changed

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ staffId: 'staff-1' }) }))
vi.mock('../../lib/sentry', () => ({ Sentry: { addBreadcrumb: vi.fn() } }))
vi.mock('../../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('../../services/storeSync', () => ({
  uploadAllUnsynced: vi.fn().mockResolvedValue({ uploaded: 0, failed: 0, skipped: 0 }),
}))
vi.mock('../../hooks/useUnsentBanner', () => ({ notifyLfChange: vi.fn() }))
vi.mock('../../shared/ui/PageHeader', () => ({ PageHeader: () => null }))
vi.mock('../../shared/ui/KanaIndex', () => ({ default: () => null }))
vi.mock('../../shared/ui/DateTime', () => ({ default: () => null }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => {
      const b = {}
      b.select = vi.fn(() => b)
      b.eq = vi.fn(() => b)
      b.order = vi.fn().mockResolvedValue({ data: [] })
      return b
    }),
    rpc: vi.fn().mockResolvedValue({
      data: [{ store_code: 'S1', last_patrol_date: '2026-07-02', done_booths: 3, total_booths: 5 }],
    }),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}))

import ClawsupportHub from '../../clawsupport/pages/ClawsupportHub'
import { supabase } from '../../lib/supabase'

beforeEach(() => vi.clearAllMocks())

describe('SPEC-PATROL-BOOTHUI-3FIXES-01 AC1/AC2: ClawsupportHub stale-badge fix', () => {
  it('AC2: on_mount_should_fetch_store_patrol_progress', async () => {
    render(<MemoryRouter><ClawsupportHub /></MemoryRouter>)
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('store_patrol_progress'))
  })

  it('AC1: when_lf1_changed_fires_after_mount_should_re_fetch_progress', async () => {
    render(<MemoryRouter><ClawsupportHub /></MemoryRouter>)
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(1))

    await act(async () => {
      window.dispatchEvent(new CustomEvent('clawops-lf1-changed'))
    })

    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(2))
    expect(supabase.rpc).toHaveBeenLastCalledWith('store_patrol_progress')
  })
})
