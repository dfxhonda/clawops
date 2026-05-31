// J-STOCKTAKE-TARGET-SELECT-01 (司令塔Opus spec):
// 棚卸し対象選択 (倉庫 / 担当持ち回り) の 2 タブ画面。
// /stock/stocktake → 対象選択 → /stock/stocktake/session?owner_type=&owner_id=
//
// 倉庫タブ: locations WHERE location_type='warehouse' AND is_active=true ORDER BY location_name
// 担当タブ:
//   staff role:     staff WHERE staff_id=ログインユーザー (自分のみ)
//   admin/manager:  staff WHERE is_active=true ORDER BY name_kana
//   ログイン本人カードに '自分' バッジ
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'

export default function StocktakeTargetPage() {
  const navigate = useNavigate()
  const { staffId, staffRole } = useAuth()

  const [tab, setTab] = useState('warehouse')
  const [warehouses, setWarehouses] = useState([])
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    async function load() {
      const isStaffRole = staffRole === 'staff'
      const staffQuery = isStaffRole && staffId
        ? supabase.from('staff').select('staff_id, name, name_kana, role, is_active, has_vehicle_stock').eq('staff_id', staffId)
        : supabase.from('staff').select('staff_id, name, name_kana, role, is_active, has_vehicle_stock').eq('is_active', true).order('name_kana', { nullsLast: true })

      const [{ data: locData }, { data: stData }] = await Promise.all([
        supabase
          .from('locations')
          .select('location_id, location_name, location_type, is_active')
          .eq('location_type', 'warehouse')
          .eq('is_active', true)
          .order('location_name'),
        staffQuery,
      ])
      if (cancel) return
      setWarehouses(locData ?? [])
      setStaffList(stData ?? [])
      setLoading(false)
    }
    load()
    return () => { cancel = true }
  }, [staffId, staffRole])

  function openWarehouse(loc) {
    navigate(`/stock/stocktake/session?owner_type=warehouse&owner_id=${encodeURIComponent(loc.location_id)}`)
  }
  function openStaff(st) {
    navigate(`/stock/stocktake/session?owner_type=staff&owner_id=${encodeURIComponent(st.staff_id)}`)
  }

  const visibleStaff = useMemo(
    () => staffList.filter(s => s.is_active !== false),
    [staffList]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">読み込み中...</div>
    )
  }

  return (
    <div data-testid="stocktake-target" className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="tanasupport"
        title="棚卸し対象選択"
        variant="compact"
        menuToLauncher
        onBack={() => navigate('/stock')}
      />

      <div className="shrink-0 flex gap-1 px-4 py-2 border-b border-border">
        <button
          type="button"
          data-testid="stocktake-target-tab-warehouse"
          onClick={() => setTab('warehouse')}
          className={`flex-1 min-h-[44px] rounded-lg text-base font-bold ${
            tab === 'warehouse' ? 'bg-emerald-600 text-white' : 'bg-surface border border-border text-text'
          }`}
        >
          🏭 倉庫
        </button>
        <button
          type="button"
          data-testid="stocktake-target-tab-staff"
          onClick={() => setTab('staff')}
          className={`flex-1 min-h-[44px] rounded-lg text-base font-bold ${
            tab === 'staff' ? 'bg-emerald-600 text-white' : 'bg-surface border border-border text-text'
          }`}
        >
          🚗 担当持ち回り
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {tab === 'warehouse' && (
          <>
            {warehouses.length === 0 && (
              <p data-testid="stocktake-target-empty-warehouse" className="text-center text-muted text-sm py-8">
                登録されている倉庫がありません (locations.location_type=warehouse)
              </p>
            )}
            {warehouses.map(loc => (
              <button
                key={loc.location_id}
                type="button"
                data-testid={`stocktake-target-warehouse-${loc.location_id}`}
                onClick={() => openWarehouse(loc)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform select-none"
                style={{ minHeight: 88, borderLeftWidth: 4, borderLeftColor: '#10b981' }}
              >
                <span className="text-2xl shrink-0" style={{ minWidth: 44, textAlign: 'center' }}>🏭</span>
                <div className="flex-1 min-w-0">
                  <p className="text-text text-base font-bold truncate">{loc.location_name}</p>
                  <p className="text-xs text-muted mt-0.5 font-mono truncate">{loc.location_id}</p>
                </div>
                <span className="text-muted text-xl shrink-0">›</span>
              </button>
            ))}
          </>
        )}

        {tab === 'staff' && (
          <>
            {visibleStaff.length === 0 && (
              <p data-testid="stocktake-target-empty-staff" className="text-center text-muted text-sm py-8">
                担当者が見つかりません
              </p>
            )}
            {visibleStaff.map(st => {
              const isSelf = staffId && st.staff_id === staffId
              return (
                <button
                  key={st.staff_id}
                  type="button"
                  data-testid={`stocktake-target-staff-${st.staff_id}`}
                  onClick={() => openStaff(st)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform select-none"
                  style={{ minHeight: 88, borderLeftWidth: 4, borderLeftColor: '#f59e0b' }}
                >
                  <span className="text-2xl shrink-0" style={{ minWidth: 44, textAlign: 'center' }}>🚗</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-text text-base font-bold truncate">{st.name}</p>
                      {isSelf && (
                        <span data-testid="stocktake-target-self-badge" className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-bold whitespace-nowrap">自分</span>
                      )}
                    </div>
                    {st.role && (
                      <p className="text-xs text-muted mt-0.5">{st.role}</p>
                    )}
                  </div>
                  <span className="text-muted text-xl shrink-0">›</span>
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
