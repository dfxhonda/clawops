// ============================================
// useAuth: 認証状態をReactコンポーネントで使うフック
// session.js の純粋関数ラッパー
// ============================================
import { useMemo } from 'react'
import {
  getSession, getToken, getStaffId, getStaffName, getStaffRole,
  isLoggedIn, isAdmin, isManager, isPatrol, hasRole, logout,
} from '../lib/auth/session'

/**
 * 認証情報を返すカスタムフック
 * sessionStorage ベースなのでリアクティブではないが、
 * マウント時の値を一貫して返すので十分実用的。
 */
export function useAuth() {
  const session = useMemo(() => ({
    staffId:   getStaffId(),
    staffName: getStaffName(),
    staffRole: getStaffRole(),
    token:     getToken(),
  }), [])

  return {
    ...session,
    isLoggedIn: isLoggedIn(),
    isAdmin:    isAdmin(),
    isManager:  isManager(),
    isPatrol:   isPatrol(),
    hasRole,
    logout,
  }
}
