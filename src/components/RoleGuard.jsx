// ============================================
// RoleGuard: ロールベースの画面アクセス制御
// ============================================
import { Navigate } from 'react-router-dom'
import { getStaffRole } from '../lib/auth/session'

/**
 * 指定ロール以上でないとアクセスできない画面を制御するラッパー
 * @param {string[]} allowedRoles - アクセス許可ロール ['admin', 'manager', 'patrol', 'staff']
 * @param {React.ReactNode} children - 表示するコンポーネント
 * @param {string} [fallback='/'] - 権限不足時のリダイレクト先
 */
export default function RoleGuard({ allowedRoles, children, fallback = '/' }) {
  const role = getStaffRole()

  if (!allowedRoles.includes(role)) {
    return <Navigate to={fallback} replace />
  }

  return children
}

// 便利なプリセット
export function AdminOnly({ children }) {
  return <RoleGuard allowedRoles={['admin']}>{children}</RoleGuard>
}

export function ManagerOnly({ children }) {
  return <RoleGuard allowedRoles={['admin', 'manager']}>{children}</RoleGuard>
}

export function PatrolOnly({ children }) {
  return <RoleGuard allowedRoles={['admin', 'manager', 'patrol']}>{children}</RoleGuard>
}
