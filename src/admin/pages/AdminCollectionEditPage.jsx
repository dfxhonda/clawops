import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/ui/PageHeader'
import { useAuth } from '../../hooks/useAuth'
import { isAdmin } from '../../services/permissions'
import StorePickerSheet from '../../components/StorePickerSheet'
import { getCollectionHistoryByStore } from '../../services/collections'

// SPEC-COLLECTION-PAST-EDIT-ADVANCE-01 (D-086): 過去集金編集の入口 (店舗選択 → 集金履歴一覧)。
// 過去メーター編集 (AdminMachineListPage) と同じ導線・同じ構え。選択で /admin/audit/collection-edit/c/:collectionId へ。

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

function fmtDateTime(str) {
  if (!str) return '—'
  const d = new Date(str)
  return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdminCollectionEditPage() {
  const navigate = useNavigate()
  const { staffRole, loading } = useAuth()
  const [storeCode, setStoreCode] = useState(null)
  const [rows, setRows] = useState([])
  const [dataLoading, setDataLoading] = useState(false)

  useEffect(() => {
    if (!storeCode) { setRows([]); return }
    let alive = true
    setDataLoading(true)
    getCollectionHistoryByStore(storeCode).then(({ data }) => {
      if (!alive) return
      setRows(data ?? [])
      setDataLoading(false)
    })
    return () => { alive = false }
  }, [storeCode])

  if (loading) return null
  if (!isAdmin(staffRole)) return <UnauthorizedView />

  return (
    <div className="h-dvh flex flex-col bg-bg text-text" data-testid="collection-edit-list">
      <PageHeader module="admin" title="過去集金編集" variant="compact" hideHome={true} />

      <div className="px-4 py-2 border-b border-border shrink-0">
        <StorePickerSheet value={storeCode} onChange={setStoreCode} showAllOption={false} placeholder="店舗を選択" />
      </div>

      {!storeCode && (
        <div className="flex-1 flex items-center justify-center text-muted text-sm">
          上の店舗ボタンをタップして選択してください
        </div>
      )}

      {storeCode && dataLoading && (
        <div className="flex-1 flex items-center justify-center text-muted text-base">読み込み中...</div>
      )}

      {storeCode && !dataLoading && (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 space-y-2 list-scroll">
          {rows.length === 0 && (
            <p className="text-center text-muted text-base py-12">この店舗の集金記録がありません</p>
          )}
          {rows.map(c => (
            <button
              key={c.collection_id}
              type="button"
              data-testid={`collection-row-${c.collection_id}`}
              onClick={() => navigate(`/admin/audit/collection-edit/c/${encodeURIComponent(c.collection_id)}`)}
              className="w-full text-left px-4 py-3 min-h-[44px] rounded-2xl border border-border bg-surface active:scale-[0.99] transition-transform flex items-center justify-between gap-2"
            >
              <span className="text-base font-bold">{fmtDateTime(c.collected_at)}</span>
              <span className="text-sm text-muted font-mono">¥{Number(c.total || 0).toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
