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
  if (!session) return { staffId: null, staffName: '', staffRole: 'staff', staffStoreCode: null, accessToken: null }
  const meta = session.user?.user_metadata || {}
  return {
    staffId: meta.staff_id || null,
    staffName: meta.name || '',
    staffRole: meta.role || 'staff',
    staffStoreCode: meta.store_code || null,
    accessToken: session.access_token,
  }
}

export async function logout() {
  await supabase.auth.signOut()
}
