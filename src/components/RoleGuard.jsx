// ============================================
// RoleGuard: ロールベースの表示制御（インラインガード）
// ProtectedRoute とは異なり、リダイレクトではなく非表示にする
// ============================================
import { useAuth } from '../lib/auth/AuthProvider'

/**
 * 指定ロール以外は children を非表示にするラッパー
 * @param {string[]} roles - アクセス許可ロール
 * @param {React.ReactNode} [fallback] - 権限不足時に表示する要素
 */
export default function RoleGuard({ roles, fallback, children }) {
  const { staffRole } = useAuth()
  if (!roles.includes(staffRole)) return fallback || null
  return children
}
