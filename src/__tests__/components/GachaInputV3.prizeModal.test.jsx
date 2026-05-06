// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── モック ────────────────────────────────────────────────────────────────────
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ error: null }),
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { prize_id: 'new-001', prize_name: '新景品', original_cost: 100 },
            error: null,
          }),
        }),
      }),
    }),
  },
}))

vi.mock('../../services/prizes', () => ({
  getPrizeMasters: vi.fn().mockResolvedValue([
    { prize_id: 'prize-001', prize_name: 'テスト景品A', original_cost: 120, category: 'figure' },
    { prize_id: 'prize-002', prize_name: 'テスト景品B', original_cost: 200, category: 'plush' },
  ]),
}))

vi.mock('../../lib/auth/orgConstants', () => ({
  DFX_ORG_ID: 'test-org-id',
}))

import GachaInputV3 from '../../clawsupport/components/GachaInputV3'

// ── テスト用最小 props ──────────────────────────────────────────────────────────
function makeProps(overrides = {}) {
  const p = {
    outs: [
      {
        meter: '', zan: '10', ho: '', prize: 'テスト景品A',
        prize_id: 'prize-001', cost: '120',
      },
    ],
    inMeter: '',
    inTouched: false,
    readDate: '2026-05-04',
    setA: '', setC: '', setL: '', setR: '', setO: '',
    touchedOuts: [{ meter: false, zan: false, ho: false, prize: false, cost: false }],
    touchedSet: { A: false, C: false, L: false, R: false, O: false },
  }

  const lockerState = {
    slotsByLocker: {},
    summary: { empty: 0 },
    wonSlot: vi.fn(),
    removeSlot: vi.fn(),
    fillSlot: vi.fn(),
    swapSlot: vi.fn(),
  }

  return {
    pattern: 'D1',
    boothCode: 'TEST01-M01-B01',
    p,
    prev: null,
    calc: { inDiff: null, outs: [{ diff: null, theory: null }] },
    lockers: [],
    lockerState,
    staffId: 'staff-test-001',
    setPatrolIn: vi.fn(),
    setPatrolOut: vi.fn(),
    setPatrolZan: vi.fn(),
    onCamera: vi.fn(),
    resetPatrolInMeter: vi.fn(),
    resetPatrolOutMeter: vi.fn(),
    ...overrides,
  }
}

describe('GachaInputV3 — 景品変更モーダルの誤発火防止', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('「変更 ›」タップで景品変更モーダルが開く', async () => {
    render(<GachaInputV3 {...makeProps()} />)

    // 初期状態: モーダルなし
    expect(screen.queryByText('A段 景品変更')).toBeNull()

    // PrizeCard の「変更 ›」スパンをクリック（stopPropagation 外）
    fireEvent.click(screen.getByText('変更 ›'))

    await waitFor(() => {
      expect(screen.getByText('A段 景品変更')).toBeInTheDocument()
    })
  })

  it('景品名テキストをタップしてもモーダルが開く（PrizeCard全体がタッチターゲット）', async () => {
    render(<GachaInputV3 {...makeProps()} />)

    // 景品名をクリック（stopPropagation div の外）
    fireEvent.click(screen.getByText('テスト景品A'))

    await waitFor(() => {
      expect(screen.getByText('A段 景品変更')).toBeInTheDocument()
    })
  })

  it('@¥エリア（NumpadField ラッパー）のクリックではモーダルが開かない', () => {
    render(<GachaInputV3 {...makeProps()} />)

    // stopPropagation div 内の「@¥」スパンをクリック
    fireEvent.click(screen.getByText('@¥'))

    // モーダルは開かない
    expect(screen.queryByText('A段 景品変更')).toBeNull()
  })

  it('「残」ラベルのクリックでもモーダルが開かない', () => {
    render(<GachaInputV3 {...makeProps()} />)

    // stopPropagation div 内の「残」スパンをクリック
    fireEvent.click(screen.getByText('残'))

    expect(screen.queryByText('A段 景品変更')).toBeNull()
  })

  it('モーダルを閉じると非表示になる', async () => {
    render(<GachaInputV3 {...makeProps()} />)

    fireEvent.click(screen.getByText('変更 ›'))
    await waitFor(() => screen.getByText('A段 景品変更'))

    // 「閉じる」ボタンをクリック
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))

    await waitFor(() => {
      expect(screen.queryByText('A段 景品変更')).toBeNull()
    })
  })

  it('D2 パターンで B段カードをタップすると「B段 景品変更」モーダルが開く', async () => {
    const p = {
      outs: [
        { meter: '', zan: '5', ho: '', prize: 'A景品', prize_id: 'prize-001', cost: '100' },
        { meter: '', zan: '3', ho: '', prize: 'B景品', prize_id: 'prize-002', cost: '150' },
      ],
      inMeter: '',
      inTouched: false,
      readDate: '2026-05-04',
      setA: '', setC: '', setL: '', setR: '', setO: '',
      touchedOuts: [
        { meter: false, zan: false, ho: false, prize: false, cost: false },
        { meter: false, zan: false, ho: false, prize: false, cost: false },
      ],
      touchedSet: { A: false, C: false, L: false, R: false, O: false },
    }
    render(<GachaInputV3 {...makeProps({ pattern: 'D2', p })} />)

    // B段の「変更 ›」は複数あるので getAllByText で2番目を使う
    const changeLinks = screen.getAllByText('変更 ›')
    fireEvent.click(changeLinks[1]) // B段

    await waitFor(() => {
      expect(screen.getByText('B段 景品変更')).toBeInTheDocument()
    })
  })
})
