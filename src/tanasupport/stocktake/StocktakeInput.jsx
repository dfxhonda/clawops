import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import { getSessionWithItems, submitSession, updateItem } from './api'

const FILTERS = [
  { key: 'unfilled', label: '未入力' },
  { key: 'filled',   label: '入力済' },
  { key: 'all',      label: '全て' },
]

function ItemCard({ item, staffId, onUpdate }) {
  const [qty, setQty] = useState(item.actual_qty ?? '')
  const [saving, setSaving] = useState(false)

  const handleBlur = useCallback(async () => {
    if (qty === '' || qty === null) return
    const n = parseInt(qty, 10)
    if (isNaN(n) || n < 0) return
    setSaving(true)
    try {
      await updateItem(item.item_id, n, staffId)
      onUpdate(item.item_id, n)
    } finally {
      setSaving(false)
    }
  }, [qty, item.item_id, staffId, onUpdate])

  const isFilled = item.actual_qty != null
  const diff = isFilled ? item.actual_qty - (item.expected_qty ?? 0) : null

  return (
    <div className={`bg-surface border rounded-xl p-2.5 ${isFilled ? 'border-emerald-500/30' : 'border-border'}`}>
      <p className="text-xs text-text truncate font-medium leading-snug">{item.prize_name}</p>
      <p className="text-xs text-muted mt-0.5">期待: {item.expected_qty ?? 0}</p>
      <input
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={qty}
        onChange={e => setQty(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={handleBlur}
        style={{ fontSize: 16 }}
        className="w-full h-9 bg-bg border border-border text-text text-center rounded-lg mt-1.5 outline-none focus:border-accent font-mono font-bold"
      />
      {diff != null && (
        <p className={`text-xs mt-1 text-center font-bold ${
          diff === 0 ? 'text-emerald-400' : diff > 0 ? 'text-amber-400' : 'text-rose-400'
        }`}>
          {diff === 0 ? '✓' : diff > 0 ? `+${diff}` : diff}
        </p>
      )}
      {saving && <p className="text-[10px] text-muted text-center mt-0.5">保存中</p>}
    </div>
  )
}

export default function StocktakeInput() {
  const { storeCode, sessionId } = useParams()
  const navigate = useNavigate()
  const { staffId } = useAuth()

  const [session, setSession] = useState(null)
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('unfilled')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getSessionWithItems(sessionId).then(({ session, items }) => {
      setSession(session)
      setItems(items)
      setLoading(false)
    })
  }, [sessionId])

  const handleUpdate = useCallback((itemId, actualQty) => {
    setItems(prev => prev.map(i =>
      i.item_id === itemId
        ? { ...i, actual_qty: actualQty, diff: actualQty - (i.expected_qty ?? 0) }
        : i
    ))
  }, [])

  const completedCount = items.filter(i => i.actual_qty != null).length
  const totalCount     = items.length

  const filteredItems = useMemo(() => {
    if (filter === 'unfilled') return items.filter(i => i.actual_qty == null)
    if (filter === 'filled')   return items.filter(i => i.actual_qty != null)
    return items
  }, [items, filter])

  async function handleSubmit() {
    const remaining = totalCount - completedCount
    if (remaining > 0) {
      if (!window.confirm(`未入力 ${remaining}件あります。提出してよいですか？`)) return
    }
    setSubmitting(true)
    try {
      await submitSession(sessionId)
      navigate(`/tanasupport/store/${storeCode}/stocktake`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">
      読み込み中...
    </div>
  )

  const isSubmitted = session?.status === 'submitted'

  return (
    <div className="min-h-screen bg-bg text-text pb-32">
      <PageHeader
        module="tanasupport"
        title={session?.session_name ?? '棚卸し'}
        subtitle={`${completedCount}/${totalCount} 品目完了`}
        onBack={() => navigate(`/tanasupport/store/${storeCode}/stocktake`)}
      />

      {/* フィルターバー */}
      <div className="px-5 flex gap-2 py-3 border-b border-border">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
              filter === f.key ? 'bg-accent text-bg' : 'bg-surface text-muted border border-border'
            }`}
          >
            {f.label}
            {f.key === 'unfilled' && ` ${items.filter(i => i.actual_qty == null).length}`}
            {f.key === 'filled'   && ` ${items.filter(i => i.actual_qty != null).length}`}
          </button>
        ))}
      </div>

      {/* 景品グリッド */}
      <div className="px-5 pt-3">
        {filteredItems.length === 0 ? (
          <div className="text-center text-muted text-sm py-16">
            {filter === 'unfilled' ? 'すべて入力済みです ✅' : '該当なし'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredItems.map(item => (
              <ItemCard
                key={item.item_id}
                item={item}
                staffId={staffId}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </div>

      {/* 下部固定ボタン */}
      <div className="fixed bottom-0 inset-x-0 bg-bg border-t border-border px-5 py-3 flex gap-2">
        <button
          onClick={() => navigate(`/tanasupport/store/${storeCode}/stocktake`)}
          className="flex-1 h-12 bg-surface border border-border text-text text-sm rounded-2xl font-medium active:scale-[0.98] transition-all"
        >
          途中保存
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || isSubmitted}
          className="flex-1 h-12 bg-accent text-bg text-sm rounded-2xl font-bold disabled:opacity-50 active:scale-[0.98] transition-all"
        >
          {submitting
            ? '処理中...'
            : isSubmitted
            ? '提出済み'
            : `提出 (${completedCount}/${totalCount})`}
        </button>
      </div>
    </div>
  )
}
