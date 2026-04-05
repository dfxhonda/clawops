// ============================================
// ProtectedRoute: Supabase セッション検証 + ロールガード
// 非同期で Supabase Auth に問い合わせて認証を検証する
// ============================================
import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { isLoggedIn, validateSession } from '../lib/auth/session'

/**
 * 認証必須ルート
 * 1. 同期チェック（isLoggedIn）で即座にフィルタ
 * 2. 非同期チェック（validateSession）で Supabase に問い合わせ
 */
export default function ProtectedRoute({ children }) {
  // 同期チェックで明らかに未ログインなら即リダイレクト
  if (!isLoggedIn()) return <Navigate to="/login" replace />

  const [state, setState] = useState('loading') // loading | ok | denied

  useEffect(() => {
    validateSession().then(session => {
      setState(session ? 'ok' : 'denied')
    })
  }, [])

  if (state === 'loading') return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#888'}}>認証中...</div>
  if (state === 'denied') return <Navigate to="/login" replace />
  return children
}

/**
 * ロール必須ルート（認証 + ロールチェック）
 * @param {string[]} roles - 許可ロール
 * @param {string} [fallback='/'] - 権限不足時のリダイレクト先
 */
export function RoleRoute({ roles, fallback = '/', children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />

  const [state, setState] = useState('loading') // loading | ok | denied | forbidden

  useEffect(() => {
    validateSession().then(session => {
      if (!session) { setState('denied'); return }
      const role = session.user?.user_metadata?.role || 'staff'
      setState(roles.includes(role) ? 'ok' : 'forbidden')
    })
  }, [])

  if (state === 'loading') return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#888'}}>認証中...</div>
  if (state === 'denied') return <Navigate to="/login" replace />
  if (state === 'forbidden') return <Navigate to={fallback} replace />
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
