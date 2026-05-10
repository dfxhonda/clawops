import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import { isAdmin } from '../../services/permissions'

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

export default function AdminStorePage() {
  const navigate = useNavigate()
  const { staffRole, loading } = useAuth()
  const [stores, setStores] = useState([])

  useEffect(() => {
    if (!isAdmin(staffRole)) return
    supabase
      .from('stores')
      .select('store_code, store_name')
      .eq('is_active', true)
      .order('store_name')
      .then(({ data }) => setStores(data ?? []))
  }, [staffRole])

  if (loading) return null
  if (!isAdmin(staffRole)) return <UnauthorizedView />

  return (
    <div className="min-h-screen bg-bg text-text">
      <PageHeader
        module="admin"
        title="店舗一覧 (管理)"
        variant="compact"
        onBack={() => navigate('/admin')}
      />
      <div data-testid="admin-store-list" className="p-4 space-y-2">
        {stores.length === 0 && (
          <p className="text-center text-muted text-base py-12">店舗データがありません</p>
        )}
        {stores.map(store => (
          <button
            key={store.store_code}
            data-testid={`store-row-${store.store_code}`}
            onClick={() => navigate(`/admin/store/${store.store_code}/machines`)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform"
          >
            <span className="text-text text-base font-bold">{store.store_name}</span>
            <span className="text-muted text-lg">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
