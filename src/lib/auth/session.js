// ============================================
// セッション管理 — sessionStorage の唯一の窓口
// auth 関連の読み書きはすべてここを通す
// ============================================
import { supabase } from '../supabase'

// --- キー定義 ---
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
    staffId:     sessionStorage.getItem(KEYS.STAFF_ID)   || '',
    staffName:   sessionStorage.getItem(KEYS.STAFF_NAME) || '',
    staffRole:   sessionStorage.getItem(KEYS.STAFF_ROLE) || 'staff',
    accessToken: sessionStorage.getItem(KEYS.TOKEN)      || '',
  }
}

// --- 個別ゲッター（便利関数） ---
export function getToken()     { return sessionStorage.getItem(KEYS.TOKEN) }
export function getStaffId()   { return sessionStorage.getItem(KEYS.STAFF_ID)   || '' }
export function getStaffName() { return sessionStorage.getItem(KEYS.STAFF_NAME) || '' }
export function getStaffRole() { return sessionStorage.getItem(KEYS.STAFF_ROLE) || 'staff' }

// --- ログイン判定 ---
export function isLoggedIn() { return !!getToken() }

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
