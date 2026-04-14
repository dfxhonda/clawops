// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../services/readings', () => ({
  saveReading: vi.fn(),
}))

import { saveReading } from '../../services/readings'
import DraftList from '../../patrol/pages/DraftList'

function renderDraftList(locationState = {}, sessionDrafts = []) {
  sessionStorage.setItem('clawops_drafts', JSON.stringify(sessionDrafts))
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/drafts', state: locationState }]}>
      <DraftList />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('DraftList', () => {
  it('空のドラフトリストが表示される', () => {
    renderDraftList()
    expect(screen.getByText('下書きデータがありません')).toBeTruthy()
  })

  it('handleSaveAll 成功後に /complete に navigate される', async () => {
    saveReading.mockResolvedValue({})
    const drafts = [
      {
        booth_id: 'B01', full_booth_code: 'KKY01-M01-B01',
        in_meter: '5100', out_meter: '3100', read_date: '2026-04-06',
        prize_name: 'テスト', prize_restock_count: '0',
      },
    ]
    renderDraftList({ storeName: 'テスト店', storeId: 'S01' }, drafts)

    fireEvent.click(screen.getByRole('button', { name: /一括保存/ }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/complete', expect.objectContaining({
        state: expect.objectContaining({
          storeName: 'テスト店',
          storeId: 'S01',
          savedDrafts: expect.arrayContaining([
            expect.objectContaining({ booth_id: 'B01' })
          ]),
        }),
      }))
    })
  })
})
