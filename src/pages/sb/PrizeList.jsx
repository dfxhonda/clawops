import { useState, useEffect, useMemo } from 'react'
import { fetchAllPrizeMasters } from '../../services/supabase'

const STATUS_LABEL = {
  active: '運用中',
  inactive: '終了',
  provisional: '仮登録',
}
const STATUS_COLOR = {
  active: '#4ade80',
  inactive: '#f87171',
  provisional: '#facc15',
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

  const styles = {
    container: {
      minHeight: '100dvh',
      background: '#111827',
      color: '#f9fafb',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      paddingBottom: 24,
    },
    header: {
      background: '#1e293b',
      padding: '16px 16px 12px',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      borderBottom: '1px solid #334155',
    },
    title: {
      fontSize: 18,
      fontWeight: 700,
      margin: '0 0 4px',
      color: '#f1f5f9',
    },
    count: {
      fontSize: 12,
      color: '#94a3b8',
      margin: '0 0 12px',
    },
    searchInput: {
      width: '100%',
      padding: '10px 12px',
      borderRadius: 8,
      border: '1px solid #334155',
      background: '#0f172a',
      color: '#f1f5f9',
      fontSize: 14,
      boxSizing: 'border-box',
      outline: 'none',
      marginBottom: 8,
    },
    categoryRow: {
      display: 'flex',
      gap: 6,
      overflowX: 'auto',
      paddingBottom: 4,
      scrollbarWidth: 'none',
    },
    catBtn: (active) => ({
      flexShrink: 0,
      padding: '4px 10px',
      borderRadius: 20,
      border: '1px solid #334155',
      background: active ? '#3b82f6' : '#1e293b',
      color: active ? '#fff' : '#94a3b8',
      fontSize: 12,
      cursor: 'pointer',
    }),
    list: {
      padding: '12px 12px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    },
    card: {
      background: '#1e293b',
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    },
    cardTop: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
    },
    prizeName: {
      fontSize: 14,
      fontWeight: 600,
      color: '#f1f5f9',
      lineHeight: 1.4,
      flex: 1,
    },
    statusBadge: (status) => ({
      flexShrink: 0,
      fontSize: 11,
      padding: '2px 8px',
      borderRadius: 12,
      background: (STATUS_COLOR[status] || '#64748b') + '33',
      color: STATUS_COLOR[status] || '#94a3b8',
      border: `1px solid ${STATUS_COLOR[status] || '#64748b'}66`,
    }),
    meta: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px 12px',
    },
    metaItem: {
      fontSize: 12,
      color: '#94a3b8',
    },
    metaVal: {
      color: '#cbd5e1',
    },
    loadingBox: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: 12,
      color: '#94a3b8',
    },
    spinner: {
      width: 40,
      height: 40,
      border: '3px solid #334155',
      borderTop: '3px solid #3b82f6',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    },
    errorBox: {
      margin: 24,
      padding: 16,
      background: '#450a0a',
      border: '1px solid #dc2626',
      borderRadius: 10,
      color: '#fca5a5',
      fontSize: 14,
    },
    emptyBox: {
      textAlign: 'center',
      padding: '40px 16px',
      color: '#475569',
      fontSize: 14,
    },
  }

  return (
    <div style={styles.container}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={styles.header}>
        <p style={styles.title}>景品マスタ</p>
        <p style={styles.count}>
          {loading ? '読み込み中...' : `全 ${prizes.length} 件 / 表示 ${filtered.length} 件`}
        </p>
        <input
          style={styles.searchInput}
          type="search"
          placeholder="景品名・ID・JANコードで検索"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={styles.categoryRow}>
          {categories.map(cat => (
            <button
              key={cat}
              style={styles.catBtn(categoryFilter === cat)}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat === 'all' ? 'すべて' : cat}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <span>景品データ取得中...</span>
        </div>
      )}

      {error && (
        <div style={styles.errorBox}>
          <b>エラー:</b> {error}
        </div>
      )}

      {!loading && !error && (
        <div style={styles.list}>
          {filtered.length === 0 ? (
            <div style={styles.emptyBox}>該当する景品がありません</div>
          ) : (
            filtered.map(p => (
              <div key={p.prize_id} style={styles.card}>
                <div style={styles.cardTop}>
                  <span style={styles.prizeName}>{p.prize_name}</span>
                  <span style={styles.statusBadge(p.status)}>
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                </div>
                <div style={styles.meta}>
                  <span style={styles.metaItem}>
                    ID: <span style={styles.metaVal}>{p.prize_id}</span>
                  </span>
                  {p.category && (
                    <span style={styles.metaItem}>
                      カテゴリ: <span style={styles.metaVal}>{p.category}</span>
                    </span>
                  )}
                  {p.size && (
                    <span style={styles.metaItem}>
                      サイズ: <span style={styles.metaVal}>{p.size}</span>
                    </span>
                  )}
                  {p.original_cost && (
                    <span style={styles.metaItem}>
                      原価: <span style={styles.metaVal}>¥{p.original_cost.toLocaleString()}</span>
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
