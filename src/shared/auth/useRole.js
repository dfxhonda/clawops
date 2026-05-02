// 既存 AuthProvider (Supabase Auth) からロールを取得するアダプター
// sessionStorage依存廃止済みのため useAuth() 経由で取得する
import { useAuth } from '../../hooks/useAuth'

export function useRole() {
  const { loading, isLoggedIn, staffRole, staffId, staffName } = useAuth()
  return {
    role: (!loading && isLoggedIn) ? (staffRole || 'staff') : null,
    staffId,
    staffName,
    loading,
  }
}
