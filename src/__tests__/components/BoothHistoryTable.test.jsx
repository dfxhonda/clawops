// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../../services/readings', () => ({
  getBoothHistory: vi.fn(),
}))

import BoothHistoryTable from '../../clawsupport/components/BoothHistoryTable'
import { getBoothHistory } from '../../services/readings'

// getBoothHistory は「新しい順（DESC）」を返す想定
// コンポーネントが内部で .reverse() して古い順に並べ直す
function makeRow(overrides) {
  return {
    reading_id: 'r-default',
    patrol_date: '2026-05-04',
    read_time: '2026-05-04T12:00:00+09:00',
    in_meter: 50000,
    out_meter: 45000,
    prize_stock_count: null,
    prize_restock_count: null,
    prize_name: 'テスト景品',
    entry_type: 'new_patrol',
    play_price: 200,
    ...overrides,
  }
}

describe('BoothHistoryTable — computeRevenues (集金売上計算)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('レコードが1件だけのとき売上は — になる（基準点がない）', async () => {
    getBoothHistory.mockResolvedValue([
      makeRow({ reading_id: 'r-001' }),
    ])
    render(<BoothHistoryTable boothId="booth-001" />)
    await waitFor(() => expect(screen.queryByText('読み込み中...')).toBeNull())

    const cells = screen.getAllByText('—')
    expect(cells.length).toBeGreaterThan(0)
    // 売上列の値が — であることを確認（¥ が付く売上はない）
    expect(screen.queryByText(/¥\d/)).toBeNull()
  })

  it('inDiff > 0 のとき 売上 = inDiff × play_price になる', async () => {
    // 新しい順で返す: r-002(新) → r-001(古)
    getBoothHistory.mockResolvedValue([
      makeRow({ reading_id: 'r-002', patrol_date: '2026-05-04', in_meter: 50000, play_price: 200 }),
      makeRow({ reading_id: 'r-001', patrol_date: '2026-05-03', in_meter: 49000, play_price: 200 }),
    ])
    render(<BoothHistoryTable boothId="booth-001" />)
    await waitFor(() => expect(screen.queryByText('読み込み中...')).toBeNull())

    // inDiff = 50000 - 49000 = 1000, play_price = 200 → 200,000
    expect(screen.getByText('¥200,000')).toBeInTheDocument()
  })

  it('inDiff <= 0 のとき 売上は — になる（メーターが逆転・同値）', async () => {
    getBoothHistory.mockResolvedValue([
      makeRow({ reading_id: 'r-002', patrol_date: '2026-05-04', in_meter: 49000, play_price: 200 }),
      makeRow({ reading_id: 'r-001', patrol_date: '2026-05-03', in_meter: 50000, play_price: 200 }),
    ])
    render(<BoothHistoryTable boothId="booth-001" />)
    await waitFor(() => expect(screen.queryByText('読み込み中...')).toBeNull())

    // inDiff = 49000 - 50000 = -1000 → null
    expect(screen.queryByText(/¥\d/)).toBeNull()
  })

  it('play_price が null のとき 100円 をフォールバックで使う', async () => {
    getBoothHistory.mockResolvedValue([
      makeRow({ reading_id: 'r-002', patrol_date: '2026-05-04', in_meter: 50000, play_price: null }),
      makeRow({ reading_id: 'r-001', patrol_date: '2026-05-03', in_meter: 49000, play_price: null }),
    ])
    render(<BoothHistoryTable boothId="booth-001" />)
    await waitFor(() => expect(screen.queryByText('読み込み中...')).toBeNull())

    // inDiff=1000, play_price=null → 100フォールバック → 100,000
    expect(screen.getByText('¥100,000')).toBeInTheDocument()
  })

  it('entry_type=replace の行は売上計算から除外される', async () => {
    // r-001(base) → r-replace(入替: 除外) → r-003(次回)
    getBoothHistory.mockResolvedValue([
      makeRow({ reading_id: 'r-003', patrol_date: '2026-05-05', in_meter: 51000, play_price: 200 }),
      makeRow({ reading_id: 'r-replace', patrol_date: '2026-05-04', read_time: '2026-05-04T18:00:00+09:00', in_meter: 10000, entry_type: 'replace', play_price: 200 }),
      makeRow({ reading_id: 'r-001', patrol_date: '2026-05-03', in_meter: 49000, play_price: 200 }),
    ])
    render(<BoothHistoryTable boothId="booth-001" />)
    await waitFor(() => expect(screen.queryByText('読み込み中...')).toBeNull())

    // r-replace は computeRevenues の filter で除外
    // r-003 の計算は r-001 を基準に: inDiff = 51000 - 49000 = 2000 → 2000 * 200 = 400,000
    expect(screen.getByText('¥400,000')).toBeInTheDocument()

    // r-replace の行は 売上に「入替」バッジが表示され、¥ 値は出ない
    expect(screen.getByText('入替')).toBeInTheDocument()
  })

  it('getBoothHistory が空を返したとき何も表示しない', async () => {
    getBoothHistory.mockResolvedValue([])
    const { container } = render(<BoothHistoryTable boothId="booth-001" />)
    await waitFor(() => expect(screen.queryByText('読み込み中...')).toBeNull())

    // テーブル全体が非表示
    expect(container.querySelector('table')).toBeNull()
  })
})
