import { describe, it, expect, beforeEach, vi } from 'vitest'

// sessionStorage のモック
const store = {}
const mockSessionStorage = {
  getItem: vi.fn(key => store[key] ?? null),
  setItem: vi.fn((key, val) => { store[key] = String(val) }),
  removeItem: vi.fn(key => { delete store[key] }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
}
vi.stubGlobal('sessionStorage', mockSessionStorage)

// supabase のモック
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn(() => Promise.resolve()) } },
}))

// テスト対象（モック設定後にインポート）
const {
  setSession,
  getSession,
  getToken,
  getStaffId,
  getStaffName,
  getStaffRole,
  isLoggedIn,
  hasRole,
  isAdmin,
  isManager,
  isPatrol,
  updateStaffId,
  clearSession,
  logout,
} = await import('../lib/auth/session')

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k])
  vi.clearAllMocks()
})

// ============================================
// setSession / getSession
// ============================================
describe('setSession / getSession', () => {
  it('書き込みと読み取りが一致する', () => {
    setSession({ staffId: 'S01', staffName: '山田太郎', staffRole: 'admin', accessToken: 'tok123' })
    const s = getSession()
    expect(s.staffId).toBe('S01')
    expect(s.staffName).toBe('山田太郎')
    expect(s.staffRole).toBe('admin')
    expect(s.accessToken).toBe('tok123')
  })
  it('未セット時のデフォルト値', () => {
    const s = getSession()
    expect(s.staffId).toBe('')
    expect(s.staffRole).toBe('staff')
  })
})

// ============================================
// isLoggedIn
// ============================================
describe('isLoggedIn', () => {
  it('トークンがあればtrue', () => {
    setSession({ accessToken: 'tok' })
    expect(isLoggedIn()).toBe(true)
  })
  it('トークンがなければfalse', () => {
    expect(isLoggedIn()).toBe(false)
  })
})

// ============================================
// ロール判定
// ============================================
describe('ロール判定', () => {
  it('admin は isAdmin/isManager/isPatrol すべてtrue', () => {
    setSession({ staffRole: 'admin', accessToken: 'x' })
    expect(isAdmin()).toBe(true)
    expect(isManager()).toBe(true)
    expect(isPatrol()).toBe(true)
  })
  it('staff は全部false', () => {
    setSession({ staffRole: 'staff', accessToken: 'x' })
    expect(isAdmin()).toBe(false)
    expect(isManager()).toBe(false)
    expect(isPatrol()).toBe(false)
  })
  it('patrol は isPatrol=true, isManager=false', () => {
    setSession({ staffRole: 'patrol', accessToken: 'x' })
    expect(isPatrol()).toBe(true)
    expect(isManager()).toBe(false)
  })
  it('hasRole で複数ロール指定', () => {
    setSession({ staffRole: 'manager', accessToken: 'x' })
    expect(hasRole(['admin', 'manager'])).toBe(true)
    expect(hasRole(['admin'])).toBe(false)
  })
})

// ============================================
// updateStaffId
// ============================================
describe('updateStaffId', () => {
  it('staffIdだけ更新される', () => {
    setSession({ staffId: 'S01', staffName: 'テスト', staffRole: 'admin', accessToken: 'tok' })
    updateStaffId('S99')
    expect(getStaffId()).toBe('S99')
    expect(getStaffName()).toBe('テスト') // 他は変わらない
  })
})

// ============================================
// clearSession / logout
// ============================================
describe('clearSession', () => {
  it('全キーが消える', () => {
    setSession({ staffId: 'S01', staffName: 'テスト', staffRole: 'admin', accessToken: 'tok' })
    clearSession()
    expect(getToken()).toBeNull()
    expect(getStaffId()).toBe('')
  })
})

describe('logout', () => {
  it('Supabase signOut + clearSession が呼ばれる', async () => {
    const { supabase } = await import('../lib/supabase')
    setSession({ staffId: 'S01', accessToken: 'tok' })
    await logout()
    expect(supabase.auth.signOut).toHaveBeenCalled()
    expect(getToken()).toBeNull()
  })
})
