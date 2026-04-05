// ============================================
// 認証・セッション管理 — 互換エクスポート
// 実体は src/lib/auth/session.js + AuthProvider.jsx に集約
// ============================================
export {
  getAuthSession,
  extractMeta,
  logout,
  getToken,
  getStaffId,
  getStaffName,
  getStaffRole,
  hasRole,
  isAdmin,
  isManager,
  isPatrol,
} from '../lib/auth/session'

export { useAuth, AuthProvider } from '../lib/auth/AuthProvider'
