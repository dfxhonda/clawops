import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../shared/ui/PageHeader'

export default function StoreDashboard() {
  const { storeCode } = useParams()
  const navigate = useNavigate()
  const [storeName, setStoreName] = useState('')
  const [activeSessions, setActiveSessions] = useState(0)
  const [pendingArrivals, setPendingArrivals] = useState(0)

  useEffect(() => {
    async function load() {
      const [{ data: store }, { count: sessCnt }, { count: arrCnt }] = await Promise.all([
        supabase.from('stores').select('store_name').eq('store_code', storeCode).single(),
        supabase.from('stocktake_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('store_code', storeCode)
          .in('status', ['in_progress', 'submitted']),
        supabase.from('prize_orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'shipped'),
      ])
      setStoreName(store?.store_name ?? storeCode)
      setActiveSessions(sessCnt ?? 0)
      setPendingArrivals(arrCnt ?? 0)
    }
    load()
  }, [storeCode])

  return (
    <div className="min-h-screen bg-bg text-text">
      <PageHeader
        module="tanasupport"
        title={storeName || storeCode}
        onBack={() => navigate('/tanasupport')}
      />

      <div className="px-5 flex flex-col gap-3 pt-2 pb-10">
        <button
          onClick={() => navigate('/tanasupport/orders?tab=shipped')}
          className="w-full bg-surface border border-border rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text font-bold">📦 入荷チェック</p>
              <p className="text-muted text-sm mt-0.5">
                {pendingArrivals > 0 ? `未処理 ${pendingArrivals} 件` : '未処理なし'}
              </p>
            </div>
            <span className="text-muted text-lg">›</span>
          </div>
        </button>

        <button
          onClick={() => navigate(`/tanasupport/store/${storeCode}/stocktake`)}
          className="w-full bg-surface border border-border rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text font-bold">📋 棚卸し</p>
              <p className="text-muted text-sm mt-0.5">
                {activeSessions > 0 ? `進行中 ${activeSessions} 件` : 'セッションなし'}
              </p>
            </div>
            {activeSessions > 0 && (
              <span className="text-emerald-400 text-[10px] border border-emerald-400/40 px-2 py-0.5 rounded-full mr-1">
                {activeSessions}件
              </span>
            )}
            <span className="text-muted text-lg">›</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/tanasupport/orders?tab=ordered')}
          className="w-full bg-surface border border-border rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text font-bold">📦 発注追跡</p>
              <p className="text-muted text-sm mt-0.5">今週の発注状況</p>
            </div>
            <span className="text-muted text-lg">›</span>
          </div>
        </button>
      </div>
    </div>
  )
}
