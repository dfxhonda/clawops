// ============================================
// セッション管理 — Supabase Auth single source of truth
// sessionStorage 依存を廃止。認証状態は Supabase Auth のみ。
// ============================================
import { supabase } from '../supabase'

// ── Supabase Auth Session (single source of truth) ──

export async function getAuthSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export function extractMeta(session) {
  if (!session) return { staffId: null, staffName: '', staffRole: 'staff', accessToken: null }
  const meta = session.user?.user_metadata || {}
  return {
    staffId: meta.staff_id || null,
    staffName: meta.name || '',
    staffRole: meta.role || 'staff',
    accessToken: session.access_token,
  }
}

export async function logout() {
  await supabase.auth.signOut()
}

// ── Synchronous getters (backward compatibility for non-hook contexts) ──
// These read from Supabase's internal localStorage cache (synchronous)
function _cachedSession() {
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    const parsed = JSON.parse(localStorage.getItem(key))
    if (!parsed?.access_token) return null
    if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) return null
    return parsed
  } catch { return null }
}

export function getToken() {
  return _cachedSession()?.access_token || null
}

export function getStaffId() {
  return _cachedSession()?.user?.user_metadata?.staff_id || null
}

export function getStaffName() {
  return _cachedSession()?.user?.user_metadata?.name || ''
}

export function getStaffRole() {
  return _cachedSession()?.user?.user_metadata?.role || 'staff'
}

// ── ロール判定（同期・後方互換） ──
export function hasRole(requiredRoles) {
  return requiredRoles.includes(getStaffRole())
}
export function isAdmin()   { return hasRole(['admin']) }
export function isManager() { return hasRole(['admin', 'manager']) }
export function isPatrol()  { return hasRole(['admin', 'manager', 'patrol']) }

// No more sessionStorage writes or reads for auth
// No more setSession() - Login.jsx uses supabase.auth.setSession() directly
// No more clearSession() - logout() handles it via supabase.auth.signOut()
// No more updateStaffId() - booth assignment uses React state
