// ============================================
// AuthProvider / useAuth テスト
// @testing-library/react が無いため extractMeta() の純粋関数テストと
// useAuth の戻り値ロジックをユニットテストする
// ============================================
import { describe, it, expect } from 'vitest'

// extractMeta は session.test.js でもテスト済みだが
// ここでは AuthProvider の useAuth が返す構造をテストする

// supabase モック不要 — extractMeta は純粋関数
import { extractMeta } from '../lib/auth/session'

// ============================================
// useAuth の戻り値ロジック（AuthProvider.jsx L27-36 相当）
// ============================================
function simulateUseAuth(session, loading = false) {
  if (loading) session = null
  const meta = session
    ? extractMeta(session)
    : { staffId: null, staffName: '', staffRole: 'staff', accessToken: null }
  return {
    session: loading ? null : session,
    loading,
    isLoggedIn: !loading && !!session,
    ...meta,
  }
}

describe('useAuth ロジック', () => {
  it('loading中はisLoggedIn=false, session=null', () => {
    const result = simulateUseAuth(undefined, true)
    expect(result.loading).toBe(true)
    expect(result.isLoggedIn).toBe(false)
    expect(result.session).toBeNull()
    expect(result.staffRole).toBe('staff')
  })

  it('セッションなし(null)はisLoggedIn=false', () => {
    const result = simulateUseAuth(null)
    expect(result.loading).toBe(false)
    expect(result.isLoggedIn).toBe(false)
    expect(result.staffId).toBeNull()
    expect(result.staffName).toBe('')
    expect(result.staffRole).toBe('staff')
    expect(result.accessToken).toBeNull()
  })

  it('有効セッションでisLoggedIn=true + メタ情報', () => {
    const session = {
      access_token: 'tok-abc',
      user: { user_metadata: { staff_id: 'S01', name: '田中', role: 'admin' } },
    }
    const result = simulateUseAuth(session)
    expect(result.loading).toBe(false)
    expect(result.isLoggedIn).toBe(true)
    expect(result.staffId).toBe('S01')
    expect(result.staffName).toBe('田中')
    expect(result.staffRole).toBe('admin')
    expect(result.accessToken).toBe('tok-abc')
    expect(result.session).toBe(session)
  })

  it('user_metadataが空でもデフォルト値', () => {
    const session = { access_token: 'tok', user: { user_metadata: {} } }
    const result = simulateUseAuth(session)
    expect(result.isLoggedIn).toBe(true)
    expect(result.staffId).toBeNull()
    expect(result.staffRole).toBe('staff')
  })
})
