// ============================================
// セッション管理 — Supabase Auth + sessionStorage 併用
// auth 関連の読み書きはすべてここを通す
// ============================================
import { supabase } from '../supabase'

// --- Supabase localStorage キー ---
const SB_TOKEN_KEY = 'sb-gedxzunoyzmvbqgwjalx-auth-token'

// --- sessionStorage キー定義（後方互換） ---
const KEYS = {
  TOKEN:     'gapi_token',
  STAFF_ID:  'clawops_staff_id',
  STAFF_NAME:'clawops_staff_name',
  STAFF_ROLE:'clawops_staff_role',
}

// --- セッション書き込み ---
export function setSession({ staffId, staffName, staffRole, accessToken }) {
  sessionStorage.setItem(KEYS.STAFF_ID,   staffId   || '')
  sessionStorage.setItem(KEYS.STAFF_NAME, staffName  || '')
  sessionStorage.setItem(KEYS.STAFF_ROLE, staffRole  || '')
  sessionStorage.setItem(KEYS.TOKEN,      accessToken || '')
}

// --- セッション読み取り ---
export function getSession() {
  return {
    staffId:     getStaffId(),
    staffName:   getStaffName(),
    staffRole:   getStaffRole(),
    accessToken: getToken(),
  }
}

// --- 個別ゲッター（sessionStorage → Supabase localStorage フォールバック） ---
export function getToken() {
  return sessionStorage.getItem(KEYS.TOKEN) || _sbAccessToken()
}
export function getStaffId() {
  return sessionStorage.getItem(KEYS.STAFF_ID) || _sbMeta('staff_id') || ''
}
export function getStaffName() {
  return sessionStorage.getItem(KEYS.STAFF_NAME) || _sbMeta('name') || ''
}
export function getStaffRole() {
  return sessionStorage.getItem(KEYS.STAFF_ROLE) || _sbMeta('role') || 'staff'
}

// --- 同期ログイン判定（初期レンダー用） ---
// Supabase localStorage トークンの有無 + 有効期限をチェック
export function isLoggedIn() {
  // sessionStorage にトークンがあれば OK（後方互換）
  if (sessionStorage.getItem(KEYS.TOKEN)) return true
  // Supabase localStorage トークンを確認
  try {
    const raw = localStorage.getItem(SB_TOKEN_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) return false
    return true
  } catch { return false }
}

// --- 非同期セッション検証（権威的） ---
// Supabase Auth に問い合わせて実際のセッションを返す
export async function validateSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// --- ロール判定 ---
export function hasRole(requiredRoles) {
  return requiredRoles.includes(getStaffRole())
}
export function isAdmin()  { return hasRole(['admin']) }
export function isManager(){ return hasRole(['admin', 'manager']) }
export function isPatrol() { return hasRole(['admin', 'manager', 'patrol']) }

// --- 個別セッター（担当者切替など特殊用途） ---
export function updateStaffId(id) { sessionStorage.setItem(KEYS.STAFF_ID, id || '') }

// --- セッション破棄 ---
export function clearSession() {
  Object.values(KEYS).forEach(k => sessionStorage.removeItem(k))
}

// --- ログアウト（Supabase Auth + sessionStorage + キャッシュ） ---
export async function logout() {
  try { await supabase.auth.signOut() } catch { /* ignore */ }
  clearSession()
}

// --- 内部ヘルパー: Supabase localStorage からトークン情報を取得 ---
function _sbParsed() {
  try {
    const raw = localStorage.getItem(SB_TOKEN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function _sbAccessToken() {
  return _sbParsed()?.access_token || ''
}

function _sbMeta(key) {
  return _sbParsed()?.user?.user_metadata?.[key] || ''
}
