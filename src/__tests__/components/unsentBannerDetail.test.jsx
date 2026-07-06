// @vitest-environment happy-dom
// SPEC-LF1-IDEMPOTENT-SYNC-01 D7 / AC6: banner detail list + 再送
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

const refresh = vi.fn(async () => {})
const summary = {
  count: 2, storeCount: 1, refresh,
  records: [
    { localId: 'l1', booth_code: 'TST01-M01-B01', patrol_date: '2026-07-03', in_meter: 100, out_meter: 50, lastErrCode: 'ERR-METER-001' },
    { localId: 'l2', booth_code: 'TST01-M02-B01', patrol_date: '2026-07-06', in_meter: 200, out_meter: 60, lastErrCode: null },
  ],
}
vi.mock('../../hooks/useUnsentBanner', () => ({ useUnsentBanner: () => summary }))

const uploadAllUnsynced = vi.fn(async () => ({ uploaded: 2, failed: 0, skipped: 0 }))
vi.mock('../../services/storeSync', () => ({ uploadAllUnsynced: (...a) => uploadAllUnsynced(...a) }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ staffId: 's1' }) }))

import UnsentBanner from '../../components/UnsentBanner'

beforeEach(() => vi.clearAllMocks())

describe('UnsentBanner detail (AC6)', () => {
  it('tap opens a detail list of unsynced records', () => {
    const { getByTestId, queryByTestId, getAllByTestId, getByText } = render(<UnsentBanner />)
    expect(queryByTestId('unsent-detail')).toBeNull()
    fireEvent.click(getByTestId('unsent-banner'))
    expect(getByTestId('unsent-detail')).toBeTruthy()
    expect(getAllByTestId('unsent-row')).toHaveLength(2)
    // record fields rendered
    expect(getByText('TST01-M01-B01')).toBeTruthy()
    expect(getByText('2026-07-03')).toBeTruthy()
    expect(getByText('ERR-METER-001')).toBeTruthy()
  })

  it('再送 invokes uploadAllUnsynced then refreshes', async () => {
    const { getByTestId } = render(<UnsentBanner />)
    fireEvent.click(getByTestId('unsent-banner'))
    fireEvent.click(getByTestId('unsent-resend'))
    await waitFor(() => expect(uploadAllUnsynced).toHaveBeenCalledWith({ staff: { staffId: 's1' } }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('renders nothing when count is 0', () => {
    summary.count = 0
    const { container } = render(<UnsentBanner />)
    expect(container.firstChild).toBeNull()
    summary.count = 2
  })
})
