// J-STOCK-NAVIGATION-REDESIGN-01 (司令塔Opus spec):
// 場所ハブ画面。owner_type/owner_id をクエリから受け取り、入荷/棚卸/発注 3 機能カードを表示。
// 動線: Launcher → /stock (TargetPage) → /stock/hub?owner_type=X&owner_id=Y → 各機能
//   warehouse: locations.location_name をヘッダタイトルに
//   staff:     staff.name をヘッダタイトル + ログイン本人なら '自分' バッジ
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'

export default function LocationHubPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { staffId } = useAuth()

  const ownerType = params.get('owner_type') ?? ''
  const ownerId   = params.get('owner_id')   ?? ''

  const [ownerName, setOwnerName] = useState('')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    let cancel = false
    async function load() {
      if (!ownerType || !ownerId) {
        setError('owner_type / owner_id が指定されていません')
        setLoading(false)
        return
      }
      try {
        if (ownerType === 'warehouse') {
          const { data, error: e } = await supabase
            .from('locations')
            .select('location_id, location_name')
            .eq('location_id', ownerId)
            .maybeSingle()
          if (e) throw e
          if (cancel) return
          setOwnerName(data?.location_name ?? ownerId)
        } else if (ownerType === 'staff') {
          const { data, error: e } = await supabase
            .from('staff')
            .select('staff_id, name')
            .eq('staff_id', ownerId)
            .maybeSingle()
          if (e) throw e
          if (cancel) return
          setOwnerName(data?.name ?? ownerId)
        } else {
          setError(`未対応の owner_type: ${ownerType}`)
        }
      } catch (e) {
        if (!cancel) setError(e?.message || String(e))
      } finally {
        if (!cancel) setLoading(false)
      }
    }
    load()
    return () => { cancel = true }
  }, [ownerType, ownerId])

  const isSelf = ownerType === 'staff' && staffId && ownerId === staffId
  const qs = `owner_type=${encodeURIComponent(ownerType)}&owner_id=${encodeURIComponent(ownerId)}`

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg text-muted text-sm gap-4 px-5">
        <p>読み込み中...</p>
        <button
          type="button"
          onClick={() => navigate('/stock')}
          data-testid="location-hub-loading-back"
          className="text-xs underline text-muted min-h-[44px] px-3"
        >
          ← 対象選択に戻る
        </button>
      </div>
    )
  }

  if (error) {
    return (
      <div data-testid="location-hub-error" className="min-h-screen flex flex-col items-center justify-center bg-bg text-rose-400 text-sm px-5 text-center gap-4">
        <p className="break-all">{error}</p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            type="button"
            onClick={() => navigate('/stock')}
            data-testid="location-hub-error-back-target"
            className="w-full min-h-[44px] rounded-xl bg-surface border border-border text-text font-bold"
          >
            ← 対象選択に戻る
          </button>
          <button
            type="button"
            onClick={() => navigate('/launcher')}
            data-testid="location-hub-error-back-launcher"
            className="w-full min-h-[44px] rounded-xl bg-surface border border-border text-muted text-xs"
          >
            メインメニューへ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="location-hub" className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="tanasupport"
        title={ownerName}
        variant="compact"
        onBack={() => navigate('/stock')}
      />

      <div className="px-4 py-2 shrink-0 flex items-center gap-2 border-b border-border">
        <span className="text-xs text-muted">
          {ownerType === 'warehouse' ? '🏭 倉庫' : '🚗 担当持ち回り'}
        </span>
        {isSelf && (
          <span data-testid="location-hub-self-badge" className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-bold">自分</span>
        )}
        <span className="ml-auto text-[10px] font-mono text-muted truncate max-w-[40%]">{ownerId}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        <TaskTile
          emoji="🚛"
          title="入荷チェック"
          sub="入荷品の受取確認"
          borderColor="#f43f5e"
          onClick={() => navigate(`/stock/arrival?${qs}`)}
          testid="location-hub-card-arrival"
        />
        <TaskTile
          emoji="📋"
          title="棚卸し"
          sub="棚卸セッション管理"
          borderColor="#10b981"
          onClick={() => navigate(`/stock/stocktake/session?${qs}`)}
          testid="location-hub-card-stocktake"
        />
        <TaskTile
          emoji="📦"
          title="発注追跡"
          sub="発注履歴を確認"
          borderColor="#8b5cf6"
          onClick={() => navigate(`/stock/orders?${qs}`)}
          testid="location-hub-card-orders"
        />
        {/* SPEC-STOCK-UI-FIX-01: 景品案内タイル追加。拠点に紐付かない (全社単一 prize_announcements)
            ため owner 引数なしで遷移する。元 SPEC-STOCK-ANNOUNCEMENTS-01 で TanasupportHub に
            置いたが Launcher 入口から到達不能 (DIAG-STOCK-UI-02 root cause 確定) で本箇所へ移設。 */}
        <TaskTile
          emoji="📣"
          title="景品案内"
          sub="新着案内とお気に入り (発注検討用)"
          borderColor="#06b6d4"
          onClick={() => navigate(`/stock/announcements?${qs}`)}
          testid="location-hub-card-announcements"
        />
      </div>
    </div>
  )
}

function TaskTile({ emoji, title, sub, borderColor, onClick, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className="w-full flex items-center gap-3 px-4 py-4 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform select-none min-h-[88px]"
      style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
    >
      <span className="text-2xl shrink-0" style={{ minWidth: 44, textAlign: 'center' }}>{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-text text-base font-bold">{title}</p>
        <p className="text-sm mt-0.5" style={{ color: borderColor }}>{sub}</p>
      </div>
      <span className="text-muted text-xl shrink-0">›</span>
    </button>
  )
}
