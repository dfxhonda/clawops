// ============================================
// ProtectedRoute: 認証 + ロールガードを統合
// PrivateRoute + RoleGuard を1コンポーネントで実現
// ============================================
import { Navigate } from 'react-router-dom'
import { isLoggedIn, getStaffRole } from '../lib/auth/session'

/**
 * 認証必須ルート（ログインしていなければ /login へリダイレクト）
 */
export default function ProtectedRoute({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return children
}

/**
 * ロール必須ルート（認証 + ロールチェック）
 * @param {string[]} roles - 許可ロール
 * @param {string} [fallback='/'] - 権限不足時のリダイレクト先
 */
export function RoleRoute({ roles, fallback = '/', children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  if (!roles.includes(getStaffRole())) return <Navigate to={fallback} replace />
  return children
}

// プリセット
export function AdminRoute({ children }) {
  return <RoleRoute roles={['admin']}>{children}</RoleRoute>
}

export function ManagerRoute({ children }) {
  return <RoleRoute roles={['admin', 'manager']}>{children}</RoleRoute>
}

export function PatrolRoute({ children }) {
  return <RoleRoute roles={['admin', 'manager', 'patrol']}>{children}</RoleRoute>
}
