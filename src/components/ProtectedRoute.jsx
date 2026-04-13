// ============================================
// ProtectedRoute: AuthProvider ベースの認証ガード
// Supabase Auth onAuthStateChange でリアクティブに認証状態を検知
// ============================================
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'

// 未認証時は React ログイン画面へリダイレクト
function redirectToPortal() {
  window.location.href = '/login'
  return null
}

/**
 * 認証必須ルート
 */
export default function ProtectedRoute({ children }) {
  const { loading, isLoggedIn } = useAuth()
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#888'}}>認証中...</div>
  if (!isLoggedIn) return redirectToPortal()
  return children
}

/**
 * ロール必須ルート（認証 + ロールチェック）
 * @param {string[]} roles - 許可ロール
 * @param {string} [fallback='/'] - 権限不足時のリダイレクト先
 */
export function RoleRoute({ roles, fallback = '/', children }) {
  const { loading, isLoggedIn, staffRole } = useAuth()
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#888'}}>認証中...</div>
  if (!isLoggedIn) return redirectToPortal()
  if (!roles.includes(staffRole)) return <Navigate to={fallback} replace />
  return children
}

// プリセット
export function AdminRoute({ children }) { return <RoleRoute roles={['admin']}>{children}</RoleRoute> }
export function ManagerRoute({ children }) { return <RoleRoute roles={['admin', 'manager']}>{children}</RoleRoute> }
export function PatrolRoute({ children }) { return <RoleRoute roles={['admin', 'manager', 'patrol']}>{children}</RoleRoute> }
