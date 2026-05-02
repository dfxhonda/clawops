import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MODULE_COLOR = '#10b981'

export default function TanasupportHub() {
  const navigate = useNavigate()
  const [stores, setStores]               = useState([])
  const [sessionCounts, setSessionCounts] = useState({})
  const [search, setSearch]               = useState('')
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: storeData }, { data: sessionData }] = await Promise.all([
        supabase.from('stores').select('store_code, store_name').order('store_code'),
        supabase.from('stocktake_sessions')
          .select('store_code')
          .in('status', ['in_progress', 'submitted']),
      ])
      setStores(storeData ?? [])
      const counts = {}
      for (const s of sessionData ?? []) {
        counts[s.store_code] = (counts[s.store_code] ?? 0) + 1
      }
      setSessionCounts(counts)
      setLoading(false)
    }
    load()
  }, [])

  const dateLabel = new Date().toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })

  const filteredStores = search
    ? stores.filter(s =>
        s.store_name.includes(search) || s.store_code.toLowerCase().includes(search.toLowerCase())
      )
    : stores

  return (
    <div className="min-h-screen bg-bg text-text">
      <div
        className="px-5 pt-10 pb-5"
        style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: MODULE_COLOR }}
      >
        <button onClick={() => navigate('/')} className="text-muted text-sm mb-3">← ランチャー</button>
        <p className="text-muted text-sm">{dateLabel}</p>
        <h1 className="text-xl font-bold mt-0.5">📦 タナサポ</h1>
      </div>

      {/* 検索 */}
      <div className="px-5 py-3 border-b border-border">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="店舗名で絞り込み"
          style={{ fontSize: 16 }}
          className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text outline-none focus:border-accent placeholder:text-muted"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted text-sm">読み込み中...</div>
      ) : (
        <div className="px-5 pt-3 pb-10 space-y-2">
          <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-3">
            担当店舗 ({filteredStores.length})
          </div>
          {filteredStores.map(store => {
            const cnt = sessionCounts[store.store_code] ?? 0
            return (
              <button
                key={store.store_code}
                onClick={() => navigate(`/tanasupport/store/${store.store_code}`)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-all hover:border-emerald-500/30"
              >
                <span className="text-base">🏪</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{store.store_name}</div>
                  <div className="text-xs text-muted">{store.store_code}</div>
                </div>
                {cnt > 0 && (
                  <span className="text-[10px] text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-400/40 shrink-0">
                    棚卸し {cnt}件
                  </span>
                )}
                <span className="text-muted shrink-0">›</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
