import { describe, it, expect, beforeEach, vi } from 'vitest'

// localStorage のモック — Object.keys(localStorage) が動くように
// Proxy を使って lsStore のキーを列挙可能にする
const lsStore = {}
const lsHandler = {
  get(target, prop) {
    if (prop === 'getItem') return (key) => lsStore[key] ?? null
    if (prop === 'setItem') return (key, val) => { lsStore[key] = String(val) }
    if (prop === 'removeItem') return (key) => { delete lsStore[key] }
    if (prop === 'clear') return () => { Object.keys(lsStore).forEach(k => delete lsStore[k]) }
    if (prop === 'length') return Object.keys(lsStore).length
    if (prop === 'key') return (i) => Object.keys(lsStore)[i] ?? null
    // Support direct property access (for JSON.parse etc)
    if (typeof prop === 'string' && prop in lsStore) return lsStore[prop]
    return undefined
  },
  ownKeys() { return Object.keys(lsStore) },
  getOwnPropertyDescriptor(target, prop) {
    if (prop in lsStore) return { enumerable: true, configurable: true, value: lsStore[prop] }
    return undefined
  },
}
vi.stubGlobal('localStorage', new Proxy({}, lsHandler))

// supabase のモック
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn(() => Promise.resolve()) } },
}))

// テスト対象（モック設定後にインポート）
const {
  extractMeta,
  getToken,
  getStaffId,
  getStaffName,
  getStaffRole,
  hasRole,
  isAdmin,
  isManager,
  isPatrol,
  logout,
} = await import('../lib/auth/session')

// ── ヘルパー: Supabase の localStorage キャッシュをセット ──
function setLsSession(overrides = {}) {
  const session = {
    access_token: overrides.access_token ?? 'tok123',
    expires_at: overrides.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    user: {
      user_metadata: {
        staff_id: overrides.staff_id ?? 'S01',
        name: overrides.name ?? '山田太郎',
        role: overrides.role ?? 'staff',
      },
    },
    ...overrides._raw,
  }
  lsStore['sb-test-auth-token'] = JSON.stringify(session)
}

function clearLsStore() {
  Object.keys(lsStore).forEach(k => delete lsStore[k])
}

beforeEach(() => {
  clearLsStore()
  vi.clearAllMocks()
})

// ============================================
// extractMeta (pure function)
// ============================================
describe('extractMeta', () => {
  it('nullセッションでデフォルト値', () => {
    const m = extractMeta(null)
    expect(m.staffId).toBeNull()
    expect(m.staffName).toBe('')
    expect(m.staffRole).toBe('staff')
    expect(m.accessToken).toBeNull()
  })
  it('正常セッションからメタ情報を取得', () => {
    const session = {
      access_token: 'tok-abc',
      user: { user_metadata: { staff_id: 'S99', name: 'テスト', role: 'admin' } },
    }
    const m = extractMeta(session)
    expect(m.staffId).toBe('S99')
    expect(m.staffName).toBe('テスト')
    expect(m.staffRole).toBe('admin')
    expect(m.accessToken).toBe('tok-abc')
  })
  it('user_metadataが空でもデフォルト値', () => {
    const session = { access_token: 'tok', user: { user_metadata: {} } }
    const m = extractMeta(session)
    expect(m.staffId).toBeNull()
    expect(m.staffRole).toBe('staff')
  })
  it('userがundefinedでもクラッシュしない', () => {
    const session = { access_token: 'tok' }
    const m = extractMeta(session)
    expect(m.staffId).toBeNull()
    expect(m.staffRole).toBe('staff')
  })
})

// ============================================
// getToken (localStorage cache)
// ============================================
describe('getToken', () => {
  it('localStorageにセッションがなければnull', () => {
    expect(getToken()).toBeNull()
  })
  it('有効なセッションがあればaccess_tokenを返す', () => {
    setLsSession({ access_token: 'my-token' })
    expect(getToken()).toBe('my-token')
  })
  it('期限切れセッションはnull', () => {
    setLsSession({ expires_at: Math.floor(Date.now() / 1000) - 100 })
    expect(getToken()).toBeNull()
  })
  it('不正なJSONはnull', () => {
    lsStore['sb-broken-auth-token'] = 'not-json'
    expect(getToken()).toBeNull()
  })
})

// ============================================
// getStaffId / getStaffName / getStaffRole
// ============================================
describe('getStaffId', () => {
  it('セッションがなければnull', () => {
    expect(getStaffId()).toBeNull()
  })
  it('セッションからstaff_idを返す', () => {
    setLsSession({ staff_id: 'S42' })
    expect(getStaffId()).toBe('S42')
  })
})

describe('getStaffName', () => {
  it('セッションがなければ空文字列', () => {
    expect(getStaffName()).toBe('')
  })
  it('セッションからnameを返す', () => {
    setLsSession({ name: '鈴木花子' })
    expect(getStaffName()).toBe('鈴木花子')
  })
})

describe('getStaffRole', () => {
  it('セッションがなければstaff', () => {
    expect(getStaffRole()).toBe('staff')
  })
  it('セッションからroleを返す', () => {
    setLsSession({ role: 'manager' })
    expect(getStaffRole()).toBe('manager')
  })
})

// ============================================
// ロール判定
// ============================================
describe('ロール判定', () => {
  it('admin は isAdmin/isManager/isPatrol すべてtrue', () => {
    setLsSession({ role: 'admin' })
    expect(isAdmin()).toBe(true)
    expect(isManager()).toBe(true)
    expect(isPatrol()).toBe(true)
  })
  it('staff は全部false', () => {
    setLsSession({ role: 'staff' })
    expect(isAdmin()).toBe(false)
    expect(isManager()).toBe(false)
    expect(isPatrol()).toBe(false)
  })
  it('manager は isManager=true, isAdmin=false', () => {
    setLsSession({ role: 'manager' })
    expect(isManager()).toBe(true)
    expect(isAdmin()).toBe(false)
  })
  it('patrol は isPatrol=true, isManager=false', () => {
    setLsSession({ role: 'patrol' })
    expect(isPatrol()).toBe(true)
    expect(isManager()).toBe(false)
  })
  it('hasRole で複数ロール指定', () => {
    setLsSession({ role: 'manager' })
    expect(hasRole(['admin', 'manager'])).toBe(true)
    expect(hasRole(['admin'])).toBe(false)
  })
  it('セッションなしでhasRoleはstaff', () => {
    expect(hasRole(['staff'])).toBe(true)
    expect(hasRole(['admin'])).toBe(false)
  })
})

// ============================================
// logout
// ============================================
describe('logout', () => {
  it('Supabase signOut が呼ばれる', async () => {
    const { supabase } = await import('../lib/supabase')
    await logout()
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })
})
