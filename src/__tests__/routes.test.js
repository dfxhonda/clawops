// ============================================
// ルートガード テスト
// @testing-library/react が無いため、ProtectedRoute / RoleRoute の
// 判定ロジックを純粋関数として抽出・テストする
// ============================================
import { describe, it, expect } from 'vitest'
import { extractMeta } from '../lib/auth/session'

// ── ProtectedRoute のロジック再現 ──
function protectedRouteDecision({ loading, session }) {
  if (loading) return 'loading'
  if (!session) return 'redirect-login'
  return 'allow'
}

// ── RoleRoute のロジック再現 ──
function roleRouteDecision({ loading, session, roles, fallback = '/' }) {
  if (loading) return 'loading'
  if (!session) return 'redirect-login'
  const { staffRole } = extractMeta(session)
  if (!roles.includes(staffRole)) return `redirect-${fallback}`
  return 'allow'
}

// ── テスト用セッション ──
function makeSession(role) {
  return {
    access_token: 'tok',
    user: { user_metadata: { staff_id: 'S01', name: 'テスト', role } },
  }
}

// ============================================
// ProtectedRoute
// ============================================
describe('ProtectedRoute ロジック', () => {
  it('loading中はloading', () => {
    expect(protectedRouteDecision({ loading: true, session: undefined })).toBe('loading')
  })
  it('未認証はloginへリダイレクト', () => {
    expect(protectedRouteDecision({ loading: false, session: null })).toBe('redirect-login')
  })
  it('認証済みはallow', () => {
    expect(protectedRouteDecision({ loading: false, session: makeSession('staff') })).toBe('allow')
  })
})

// ============================================
// RoleRoute — AdminRoute (roles: ['admin'])
// ============================================
describe('AdminRoute ロジック', () => {
  const roles = ['admin']

  it('adminはallow', () => {
    expect(roleRouteDecision({ loading: false, session: makeSession('admin'), roles })).toBe('allow')
  })
  it('managerはリダイレクト', () => {
    expect(roleRouteDecision({ loading: false, session: makeSession('manager'), roles })).toBe('redirect-/')
  })
  it('staffはリダイレクト', () => {
    expect(roleRouteDecision({ loading: false, session: makeSession('staff'), roles })).toBe('redirect-/')
  })
  it('patrolはリダイレクト', () => {
    expect(roleRouteDecision({ loading: false, session: makeSession('patrol'), roles })).toBe('redirect-/')
  })
  it('未認証はloginへ', () => {
    expect(roleRouteDecision({ loading: false, session: null, roles })).toBe('redirect-login')
  })
})

// ============================================
// RoleRoute — ManagerRoute (roles: ['admin', 'manager'])
// ============================================
describe('ManagerRoute ロジック', () => {
  const roles = ['admin', 'manager']

  it('adminはallow', () => {
    expect(roleRouteDecision({ loading: false, session: makeSession('admin'), roles })).toBe('allow')
  })
  it('managerはallow', () => {
    expect(roleRouteDecision({ loading: false, session: makeSession('manager'), roles })).toBe('allow')
  })
  it('patrolはリダイレクト', () => {
    expect(roleRouteDecision({ loading: false, session: makeSession('patrol'), roles })).toBe('redirect-/')
  })
  it('staffはリダイレクト', () => {
    expect(roleRouteDecision({ loading: false, session: makeSession('staff'), roles })).toBe('redirect-/')
  })
})

// ============================================
// RoleRoute — PatrolRoute (roles: ['admin', 'manager', 'patrol'])
// ============================================
describe('PatrolRoute ロジック', () => {
  const roles = ['admin', 'manager', 'patrol']

  it('adminはallow', () => {
    expect(roleRouteDecision({ loading: false, session: makeSession('admin'), roles })).toBe('allow')
  })
  it('managerはallow', () => {
    expect(roleRouteDecision({ loading: false, session: makeSession('manager'), roles })).toBe('allow')
  })
  it('patrolはallow', () => {
    expect(roleRouteDecision({ loading: false, session: makeSession('patrol'), roles })).toBe('allow')
  })
  it('staffはリダイレクト', () => {
    expect(roleRouteDecision({ loading: false, session: makeSession('staff'), roles })).toBe('redirect-/')
  })
})

// ============================================
// エッジケース
// ============================================
describe('ルートガード エッジケース', () => {
  it('roleが未設定のセッションはstaff扱い → admin不許可', () => {
    const session = { access_token: 'tok', user: { user_metadata: {} } }
    expect(roleRouteDecision({ loading: false, session, roles: ['admin'] })).toBe('redirect-/')
  })
  it('roleが未設定のセッションはstaff扱い → ProtectedRouteは通過', () => {
    const session = { access_token: 'tok', user: { user_metadata: {} } }
    expect(protectedRouteDecision({ loading: false, session })).toBe('allow')
  })
  it('カスタムfallbackパス', () => {
    expect(roleRouteDecision({
      loading: false,
      session: makeSession('staff'),
      roles: ['admin'],
      fallback: '/denied',
    })).toBe('redirect-/denied')
  })
})
