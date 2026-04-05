import { describe, it, expect, beforeEach, vi } from 'vitest'

// supabase のモック
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn(() => Promise.resolve()) } },
}))

// テスト対象（モック設定後にインポート）
const {
  extractMeta,
  logout,
} = await import('../lib/auth/session')

beforeEach(() => {
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
// logout
// ============================================
describe('logout', () => {
  it('Supabase signOut が呼ばれる', async () => {
    const { supabase } = await import('../lib/supabase')
    await logout()
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })
})
