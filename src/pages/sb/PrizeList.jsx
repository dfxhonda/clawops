import { useState, useEffect, useMemo } from 'react'
import { fetchAllPrizeMasters } from '../../lib/supabase'

const STATUS_LABEL = {
  active: '運用中',
  inactive: '終了',
  provisional: '仮登録',
}
const STATUS_COLOR = {
  active: 'text-accent3 bg-accent3/20 border-accent3/40',
  inactive: 'text-accent2 bg-accent2/20 border-accent2/40',
  provisional: 'text-accent bg-accent/20 border-accent/40',
}

export default function PrizeList() {
  const [prizes, setPrizes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    fetchAllPrizeMasters()
      .then(setPrizes)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    const s = new Set(prizes.map(p => p.category || '未分類'))
    return ['all', ...Array.from(s).sort()]
  }, [prizes])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return prizes.filter(p => {
      const matchCat = categoryFilter === 'all' || (p.category || '未分類') === categoryFilter
      if (!matchCat) return false
      if (!q) return true
      return (
        p.prize_name?.toLowerCase().includes(q) ||
        p.prize_id?.toLowerCase().includes(q) ||
        (p.jan_code || '').includes(q)
      )
    })
  }, [prizes, search, categoryFilter])

  return (
    <div className="min-h-dvh bg-bg text-text pb-6">
      {/* ヘッダー */}
      <div className="bg-surface sticky top-0 z-10 border-b border-border px-4 pt-4 pb-3">
        <p className="text-lg font-bold mb-1">景品マスタ</p>
        <p className="text-xs text-muted mb-3">
          {loading ? '読み込み中...' : `全 ${prizes.length} 件 / 表示 ${filtered.length} 件`}
        </p>
        <input
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2.5 text-text text-sm outline-none focus:border-accent mb-2"
          type="search"
          placeholder="景品名・ID・JANコードで検索"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs border transition-colors
                ${categoryFilter === cat
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-surface border-border text-muted'}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat === 'all' ? 'すべて' : cat}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted">
          <div className="animate-spin w-10 h-10 border-2 border-border border-t-accent rounded-full" />
          <span className="text-sm">景品データ取得中...</span>
        </div>
      )}

      {error && (
        <div className="m-6 p-4 bg-accent2/15 border border-accent2 rounded-xl text-accent2 text-sm">
          <b>エラー:</b> {error}
        </div>
      )}

      {!loading && !error && (
        <div className="px-3 pt-3 flex flex-col gap-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted text-sm">該当する景品がありません</div>
          ) : (
            filtered.map(p => (
              <div key={p.prize_id} className="bg-surface border border-border rounded-xl px-3.5 py-3 flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-sm font-semibold leading-snug flex-1">{p.prize_name}</span>
                  <span className={`flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${STATUS_COLOR[p.status] || 'text-muted bg-surface2 border-border'}`}>
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span className="text-xs text-muted">
                    ID: <span className="text-text">{p.prize_id}</span>
                  </span>
                  {p.category && (
                    <span className="text-xs text-muted">
                      カテゴリ: <span className="text-text">{p.category}</span>
                    </span>
                  )}
                  {p.size && (
                    <span className="text-xs text-muted">
                      サイズ: <span className="text-text">{p.size}</span>
                    </span>
                  )}
                  {p.original_cost && (
                    <span className="text-xs text-muted">
                      原価: <span className="text-text">¥{p.original_cost.toLocaleString()}</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
