import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const TABS = [
  { key: 'warehouse', label: '倉庫' },
  { key: 'staff',     label: '自分の車' },
  { key: 'store',     label: '店舗' },
]

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

export default function StocktakeTop() {
  const navigate = useNavigate()
  const staffId   = sessionStorage.getItem('stocktake_staff_id')
  const staffName = sessionStorage.getItem('stocktake_staff_name')

  const [tab, setTab]           = useState('warehouse')
  const [locations, setLocations] = useState([])
  const [itemCounts, setItemCounts] = useState({}) // owner_id → items count
  const [selected, setSelected] = useState(null)   // { ownerType, ownerId, label }
  const [sessions, setSessions] = useState([])
  const [starting, setStarting] = useState(false)

  // ログイン確認
  useEffect(() => {
    if (!staffId) navigate('/stock', { replace: true })
  }, [staffId, navigate])

  // ロケーション + 品目数
  useEffect(() => {
    supabase
      .from('locations')
      .select('location_id, location_name, location_type')
      .eq('is_active', true)
      .order('location_name')
      .then(({ data }) => setLocations(data ?? []))

    supabase
      .from('prize_stocks')
      .select('owner_type, owner_id, prize_id')
      .then(({ data }) => {
        const counts = {}
        for (const row of data ?? []) {
          const key = `${row.owner_type}:${row.owner_id}`
          counts[key] = (counts[key] ?? 0) + 1
        }
        setItemCounts(counts)
      })
  }, [])

  // 過去のセッション
  useEffect(() => {
    supabase
      .from('stocktake_sessions')
      .select('session_id, location_owner_type, location_owner_id, started_at, status, total_items, counted_items')
      .order('started_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setSessions(data ?? []))
  }, [])

  function getLocationLabel(ownerType, ownerId) {
    if (ownerType === 'staff') return ownerId === staffId ? `${staffName}の車` : ownerId
    const loc = locations.find(l => l.location_id === ownerId)
    return loc?.location_name ?? ownerId
  }

  // タブに応じたリスト
  function getList() {
    if (tab === 'warehouse') {
      return locations
        .filter(l => l.location_type === 'warehouse')
        .map(l => ({ ownerType: 'location', ownerId: l.location_id, label: l.location_name }))
    }
    if (tab === 'store') {
      return locations
        .filter(l => l.location_type === 'store')
        .map(l => ({ ownerType: 'location', ownerId: l.location_id, label: l.location_name }))
    }
    // staff = 自分の車のみ
    const cnt = itemCounts[`staff:${staffId}`] ?? 0
    return [{ ownerType: 'staff', ownerId: staffId, label: `${staffName}の車`, count: cnt }]
  }

  async function handleStart() {
    if (!selected) return
    setStarting(true)
    try {
      // 在庫スナップショット取得
      const { data: stocks } = await supabase
        .from('prize_stocks')
        .select('prize_id, quantity')
        .eq('owner_type', selected.ownerType)
        .eq('owner_id', selected.ownerId)

      const totalItems = (stocks ?? []).length

      // セッション作成
      const { data: session, error } = await supabase
        .from('stocktake_sessions')
        .insert({
          location_owner_type: selected.ownerType,
          location_owner_id:   selected.ownerId,
          created_by:          staffId,
          total_items:         totalItems,
        })
        .select('session_id')
        .single()

      if (error || !session) throw error ?? new Error('session insert failed')

      // 明細行一括挿入
      if (stocks && stocks.length > 0) {
        await supabase.from('stocktake_lines').insert(
          stocks.map(s => ({
            session_id:       session.session_id,
            prize_id:         s.prize_id,
            system_quantity:  s.quantity,
          }))
        )
      }

      navigate(`/stock/count/${session.session_id}`)
    } finally {
      setStarting(false)
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('stocktake_staff_id')
    sessionStorage.removeItem('stocktake_staff_name')
    navigate('/stock')
  }

  const list = getList()

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">

      {/* ヘッダー */}
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-4 py-3 flex items-center gap-3" style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#10b981' }}>
        <div className="text-base font-bold flex-1">📦 棚卸し</div>
        <div className="text-xs text-muted">{staffName}</div>
        <button onClick={handleLogout} className="text-[10px] text-muted hover:text-accent2">
          ログアウト
        </button>
      </div>

      <div className="flex-1 px-4 pt-4 pb-24 space-y-5">

        {/* 棚卸し開始セクション */}
        <div>
          <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2">棚卸し開始</div>

          {/* タブ */}
          <div className="flex rounded-xl bg-surface border border-border overflow-hidden mb-3">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setSelected(null) }}
                className={`flex-1 py-2.5 text-sm font-bold transition-colors
                  ${tab === t.key ? 'bg-accent text-bg' : 'text-muted hover:text-text'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 場所リスト */}
          <div className="space-y-1.5">
            {list.map(item => {
              const cnt = item.count ?? itemCounts[`${item.ownerType}:${item.ownerId}`] ?? 0
              const isSel = selected?.ownerId === item.ownerId
              return (
                <button
                  key={item.ownerId}
                  onClick={() => setSelected(isSel ? null : item)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all active:scale-[0.98]
                    ${isSel ? 'bg-accent/10 border-accent' : 'bg-surface border-border hover:border-accent/40'}`}
                >
                  <span className="flex-1 text-sm font-semibold">{item.label}</span>
                  <span className="text-xs text-muted">{cnt}品目</span>
                  {isSel && <span className="text-accent text-sm">✓</span>}
                </button>
              )
            })}
          </div>

          {/* 開始ボタン */}
          <button
            onClick={handleStart}
            disabled={!selected || starting}
            className="w-full mt-3 py-4 rounded-xl bg-accent text-bg font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            {starting ? '作成中...' : '棚卸し開始'}
          </button>
        </div>

        {/* 過去のセッション */}
        {sessions.length > 0 && (
          <div>
            <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2">過去の棚卸し</div>
            <div className="space-y-1.5">
              {sessions.map(s => {
                const label = getLocationLabel(s.location_owner_type, s.location_owner_id)
                const done  = s.status === 'completed'
                return (
                  <button
                    key={s.session_id}
                    onClick={() => navigate(done ? `/stock/summary/${s.session_id}` : `/stock/count/${s.session_id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border text-left hover:border-accent/30 transition-all"
                  >
                    <span className="text-base">{done ? '✅' : '🔄'}</span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{label}</div>
                      <div className="text-xs text-muted">{formatDate(s.started_at)} · {s.total_items}品目</div>
                    </div>
                    {!done && (
                      <span className="text-[10px] text-accent px-2 py-0.5 rounded-full border border-accent/40">
                        {s.counted_items}/{s.total_items}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
