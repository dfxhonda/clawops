// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── ルーター・認証モック ───────────────────────────────────────────────────────
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ storeCode: 'TEST01' }),
  }
})

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    staffId: 'staff-test-001',
    staffName: 'テストスタッフ',
    staffRole: 'manager',
    isLoggedIn: true,
    loading: false,
  }),
}))

// ── Supabase モック（SessionList の store 取得用） ─────────────────────────────
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { store_name: 'テスト店舗' },
        error: null,
      }),
    }),
  },
}))

// ── 棚卸し API モック ─────────────────────────────────────────────────────────
vi.mock('../../tanasupport/stocktake/api', () => ({
  getActiveSessions: vi.fn().mockResolvedValue([]),
  createSession: vi.fn().mockResolvedValue('sess-new-001'),
}))

// ── PageHeader は軽量モック ───────────────────────────────────────────────────
vi.mock('../../shared/ui/PageHeader', () => ({
  PageHeader: ({ title }) => <div data-testid="page-header">{title}</div>,
}))

import SessionList from '../../tanasupport/stocktake/SessionList'
import { createSession } from '../../tanasupport/stocktake/api'

describe('SessionList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('ページが読み込まれると「＋ 新規棚卸し開始」ボタンが表示される', async () => {
    render(<SessionList />)
    await waitFor(() => {
      expect(screen.getByText('＋ 新規棚卸し開始')).toBeInTheDocument()
    })
  })

  it('「＋ 新規棚卸し開始」をクリックすると NewSessionSheet が表示される', async () => {
    render(<SessionList />)
    await waitFor(() => screen.getByText('＋ 新規棚卸し開始'))

    fireEvent.click(screen.getByText('＋ 新規棚卸し開始'))

    expect(screen.getByText('新規棚卸し開始')).toBeInTheDocument()
    expect(screen.getByText('棚卸しを開始する')).toBeInTheDocument()
  })

  it('NewSessionSheet の「キャンセル」でシートが閉じる', async () => {
    render(<SessionList />)
    await waitFor(() => screen.getByText('＋ 新規棚卸し開始'))

    fireEvent.click(screen.getByText('＋ 新規棚卸し開始'))
    expect(screen.getByText('新規棚卸し開始')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

    await waitFor(() => {
      expect(screen.queryByText('新規棚卸し開始')).toBeNull()
    })
  })

  it('背景オーバーレイをクリックするとシートが閉じる', async () => {
    render(<SessionList />)
    await waitFor(() => screen.getByText('＋ 新規棚卸し開始'))

    fireEvent.click(screen.getByText('＋ 新規棚卸し開始'))
    expect(screen.getByText('新規棚卸し開始')).toBeInTheDocument()

    // 背景（オーバーレイ）をクリック
    const overlay = screen.getByText('新規棚卸し開始').closest('.fixed')
    if (overlay) fireEvent.click(overlay)

    await waitFor(() => {
      expect(screen.queryByText('新規棚卸し開始')).toBeNull()
    })
  })

  it('「棚卸しを開始する」をクリックすると createSession が呼ばれ StocktakeInput に遷移する', async () => {
    render(<SessionList />)
    await waitFor(() => screen.getByText('＋ 新規棚卸し開始'))

    fireEvent.click(screen.getByText('＋ 新規棚卸し開始'))
    await waitFor(() => screen.getByText('棚卸しを開始する'))

    fireEvent.click(screen.getByText('棚卸しを開始する'))

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith({
        storeCode: 'TEST01',
        sessionName: expect.any(String),
        startDate: expect.any(String),
        staffId: 'staff-test-001',
      })
      expect(mockNavigate).toHaveBeenCalledWith(
        '/tanasupport/store/TEST01/stocktake/sess-new-001'
      )
    })
  })

  it('createSession が失敗したときエラーが表示される', async () => {
    createSession.mockRejectedValueOnce(new Error('DB接続エラー'))

    render(<SessionList />)
    await waitFor(() => screen.getByText('＋ 新規棚卸し開始'))

    fireEvent.click(screen.getByText('＋ 新規棚卸し開始'))
    await waitFor(() => screen.getByText('棚卸しを開始する'))

    fireEvent.click(screen.getByText('棚卸しを開始する'))

    await waitFor(() => {
      expect(screen.getByText('DB接続エラー')).toBeInTheDocument()
    })
    // navigate は呼ばれない
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
