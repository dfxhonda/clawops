// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute, { AdminRoute, ManagerRoute, PatrolRoute } from '../../components/ProtectedRoute'
import RoleGuard from '../../components/RoleGuard'

// --- Mutable auth mock ---
let mockAuth = {}
vi.mock('../../lib/auth/AuthProvider', () => ({
  useAuth: () => mockAuth,
}))

beforeEach(() => {
  mockAuth = {
    staffId: 'STAFF01',
    staffName: 'テスト太郎',
    staffRole: 'admin',
    isLoggedIn: true,
    loading: false,
    session: {},
    accessToken: 'mock-token',
  }
})

// --- Helper: ルートガードをRoutes内で描画 ---
function renderWithRoutes(GuardComponent, authOverrides = {}) {
  Object.assign(mockAuth, authOverrides)
  return render(
    <MemoryRouter initialEntries={['/guarded']}>
      <Routes>
        <Route path="/guarded" element={<GuardComponent><div>SECRET</div></GuardComponent>} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route path="/" element={<div>HOME PAGE</div>} />
      </Routes>
    </MemoryRouter>
  )
}

// ============================================
// RoleRoute リダイレクト
// ============================================
describe('RoleRoute コンポーネント描画テスト', () => {
  describe('AdminRoute', () => {
    it('admin は子要素を表示', () => {
      renderWithRoutes(AdminRoute, { staffRole: 'admin' })
      expect(screen.getByText('SECRET')).toBeInTheDocument()
    })

    it('manager はホームへリダイレクト', () => {
      renderWithRoutes(AdminRoute, { staffRole: 'manager' })
      expect(screen.queryByText('SECRET')).not.toBeInTheDocument()
      expect(screen.getByText('HOME PAGE')).toBeInTheDocument()
    })

    it('staff はホームへリダイレクト', () => {
      renderWithRoutes(AdminRoute, { staffRole: 'staff' })
      expect(screen.queryByText('SECRET')).not.toBeInTheDocument()
      expect(screen.getByText('HOME PAGE')).toBeInTheDocument()
    })
  })

  describe('ManagerRoute', () => {
    it('admin は子要素を表示', () => {
      renderWithRoutes(ManagerRoute, { staffRole: 'admin' })
      expect(screen.getByText('SECRET')).toBeInTheDocument()
    })

    it('manager は子要素を表示', () => {
      renderWithRoutes(ManagerRoute, { staffRole: 'manager' })
      expect(screen.getByText('SECRET')).toBeInTheDocument()
    })

    it('patrol はホームへリダイレクト', () => {
      renderWithRoutes(ManagerRoute, { staffRole: 'patrol' })
      expect(screen.queryByText('SECRET')).not.toBeInTheDocument()
      expect(screen.getByText('HOME PAGE')).toBeInTheDocument()
    })

    it('staff はホームへリダイレクト', () => {
      renderWithRoutes(ManagerRoute, { staffRole: 'staff' })
      expect(screen.queryByText('SECRET')).not.toBeInTheDocument()
      expect(screen.getByText('HOME PAGE')).toBeInTheDocument()
    })
  })

  describe('PatrolRoute', () => {
    it('patrol は子要素を表示', () => {
      renderWithRoutes(PatrolRoute, { staffRole: 'patrol' })
      expect(screen.getByText('SECRET')).toBeInTheDocument()
    })

    it('staff はホームへリダイレクト', () => {
      renderWithRoutes(PatrolRoute, { staffRole: 'staff' })
      expect(screen.queryByText('SECRET')).not.toBeInTheDocument()
      expect(screen.getByText('HOME PAGE')).toBeInTheDocument()
    })
  })

  describe('認証エッジケース', () => {
    it('未認証はloginへリダイレクト', () => {
      renderWithRoutes(AdminRoute, { isLoggedIn: false })
      expect(screen.queryByText('SECRET')).not.toBeInTheDocument()
      expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument()
    })

    it('loading中は認証中を表示', () => {
      renderWithRoutes(AdminRoute, { loading: true })
      expect(screen.queryByText('SECRET')).not.toBeInTheDocument()
      expect(screen.getByText('認証中...')).toBeInTheDocument()
    })

    it('role未設定はホームへリダイレクト', () => {
      renderWithRoutes(AdminRoute, { staffRole: undefined })
      expect(screen.queryByText('SECRET')).not.toBeInTheDocument()
      expect(screen.getByText('HOME PAGE')).toBeInTheDocument()
    })
  })
})

// ============================================
// RoleGuard 表示制御
// ============================================
describe('RoleGuard コンポーネント描画テスト', () => {
  it('許可ロールで子要素を表示', () => {
    mockAuth.staffRole = 'manager'
    render(<RoleGuard roles={['admin', 'manager']}><div>PROTECTED</div></RoleGuard>)
    expect(screen.getByText('PROTECTED')).toBeInTheDocument()
  })

  it('非許可ロールで子要素を非表示', () => {
    mockAuth.staffRole = 'staff'
    render(<RoleGuard roles={['admin']}><div>PROTECTED</div></RoleGuard>)
    expect(screen.queryByText('PROTECTED')).not.toBeInTheDocument()
  })

  it('非許可ロールでfallbackを表示', () => {
    mockAuth.staffRole = 'staff'
    render(
      <RoleGuard roles={['admin']} fallback={<div>NO ACCESS</div>}>
        <div>PROTECTED</div>
      </RoleGuard>
    )
    expect(screen.queryByText('PROTECTED')).not.toBeInTheDocument()
    expect(screen.getByText('NO ACCESS')).toBeInTheDocument()
  })

  it('fallback未指定でnull描画', () => {
    mockAuth.staffRole = 'patrol'
    const { container } = render(
      <RoleGuard roles={['admin']}><div>PROTECTED</div></RoleGuard>
    )
    expect(screen.queryByText('PROTECTED')).not.toBeInTheDocument()
    expect(container.innerHTML).toBe('')
  })

  it('role未定義で子要素を非表示', () => {
    mockAuth.staffRole = undefined
    const { container } = render(
      <RoleGuard roles={['admin']}><div>PROTECTED</div></RoleGuard>
    )
    expect(screen.queryByText('PROTECTED')).not.toBeInTheDocument()
    expect(container.innerHTML).toBe('')
  })
})

// ============================================
// ProtectedRoute 認証チェック
// ============================================
describe('ProtectedRoute コンポーネント描画テスト', () => {
  it('認証済みで子要素を表示', () => {
    renderWithRoutes(ProtectedRoute, { isLoggedIn: true })
    expect(screen.getByText('SECRET')).toBeInTheDocument()
  })

  it('未認証でloginへリダイレクト', () => {
    renderWithRoutes(ProtectedRoute, { isLoggedIn: false })
    expect(screen.queryByText('SECRET')).not.toBeInTheDocument()
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument()
  })
})
