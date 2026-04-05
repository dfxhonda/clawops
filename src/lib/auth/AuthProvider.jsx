// ============================================
// AuthProvider: Supabase Auth をリアクティブに配信する Context
// onAuthStateChange でセッション変化を自動検知
// ============================================
import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { extractMeta } from './session'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const session = useContext(AuthContext)
  const loading = session === undefined
  const meta = session ? extractMeta(session) : { staffId: null, staffName: '', staffRole: 'staff', accessToken: null }
  return {
    session: loading ? null : session,
    loading,
    isLoggedIn: !loading && !!session,
    ...meta,
  }
}
