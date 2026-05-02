import { Navigate } from 'react-router-dom'
import { canAccess } from './roles'
import { useRole } from './useRole'

export function RoleGuard({ moduleKey, children }) {
  const { role, loading } = useRole()
  if (loading) return (
    <div className="flex items-center justify-center h-screen text-slate-400">
      読み込み中...
    </div>
  )
  if (!role) return <Navigate to="/login" replace />
  if (!canAccess(role, moduleKey)) return <Navigate to="/" replace />
  return children
}
