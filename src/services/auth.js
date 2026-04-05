// ============================================
// 認証・セッション管理 — 互換エクスポート
// 実体は src/lib/auth/session.js に集約
// ============================================
export {
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
} from '../lib/auth/session'
