import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isAdmin } from '../services/permissions'
import AdminTopTabs from './AdminTopTabs'
import AdminBreadcrumb from './AdminBreadcrumb'

function UnauthorizedView() {
  const navigate = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => navigate('/clawsupport', { replace: true }), 1500)
    return () => clearTimeout(t)
  }, [navigate])
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div data-testid="unauthorized-toast" className="text-amber-400 text-base font-bold px-4 py-3 border border-amber-400/40 rounded-xl">
        権限なし
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const { staffRole, loading } = useAuth()
  if (loading) return null
  if (!isAdmin(staffRole)) return <UnauthorizedView />
  return (
    <div className="h-dvh flex flex-col bg-bg text-text" data-testid="admin-layout">
      <div className="shrink-0 sticky top-0 z-10 bg-bg border-b border-border">
        <AdminTopTabs />
      </div>
      <AdminBreadcrumb />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
