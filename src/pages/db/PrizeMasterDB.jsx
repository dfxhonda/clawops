import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import DBHeader from '../../components/DBHeader'

const PAGE_SIZE = 20

export default function PrizeMasterDB() {
  const navigate = useNavigate()
  const [prizes, setPrizes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [editTarget, setEditTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const fetchPrizes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('prize_masters')
        .select('*', { count: 'exact' })
        .order('latest_order_date', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (search.trim()) {
        query = query.or(`name.ilike.%${search.trim()}%,alias.ilike.%${search.trim()}%`)
      }

      const { data, count, error: err } = await query
      if (err) throw err
      setPrizes(data || [])
      setTotal(count || 0)
    } catch (e) {
      setError(e.message || 'データ取得失敗')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    const t = setTimeout(fetchPrizes, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchPrizes, search])

  // 検索変更時はページをリセット
  useEffect(() => { setPage(0) }, [search])

  async function handleSave() {
    if (!editTarget) return
    setSaving(true)
    try {
      const { error: err } = await supabase
        .from('prize_masters')
        .update({
          name: editTarget.name,
          alias: editTarget.alias,
          category: editTarget.category,
          unit_cost: editTarget.unit_cost,
          notes: editTarget.notes,
        })
        .eq('id', editTarget.id)
      if (err) throw err
      setEditTarget(null)
      fetchPrizes()
    } catch (e) {
      alert('保存失敗: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif' }}>
      {/* ヘッダー */}
      <DBHeader title="景品マスタ" subtitle={`${total.toLocaleString()} 件`} />

      {/* 検索バー */}
      <div style={{ padding: '12px 16px' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="景品名・エイリアスで検索..."
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#1a1a1a', border: '1px solid #333', borderRadius: 10,
            color: '#e0e0e0', fontSize: 14, padding: '10px 14px',
            outline: 'none',
          }}
        />
      </div>

      {/* エラー */}
      {error && (
        <div style={{ margin: '0 16px 12px', padding: '12px 14px', background: '#3a1a1a', border: '1px solid #ff4444', borderRadius: 10, fontSize: 13, color: '#ff8888' }}>
          ⚠️ {error}
        </div>
      )}

      {/* リスト */}
      <div style={{ padding: '0 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>読み込み中...</div>
        ) : prizes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>データなし</div>
        ) : (
          prizes.map(prize => (
            <div key={prize.id} style={{
              background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12,
              padding: '12px 14px', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {prize.name || '(名前なし)'}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {prize.alias && <span style={{ fontSize: 11, color: '#888' }}>{prize.alias}</span>}
                  {prize.category && <span style={{ fontSize: 11, background: '#252525', padding: '1px 6px', borderRadius: 4, color: '#aaa' }}>{prize.category}</span>}
                  {prize.unit_cost != null && <span style={{ fontSize: 11, color: '#4a9eff' }}>¥{Number(prize.unit_cost).toLocaleString()}</span>}
                </div>
              </div>
              <button
                onClick={() => setEditTarget({ ...prize })}
                style={{ background: '#252535', border: '1px solid #3a3a5a', color: '#8888ff', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}
              >
                編集
              </button>
            </div>
          ))
        )}
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '16px 0 24px' }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{ background: '#1a1a1a', border: '1px solid #333', color: page === 0 ? '#444' : '#aaa', borderRadius: 8, padding: '8px 20px', cursor: page === 0 ? 'default' : 'pointer', fontSize: 13 }}
          >
            ← 前
          </button>
          <span style={{ fontSize: 13, color: '#888' }}>{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{ background: '#1a1a1a', border: '1px solid #333', color: page >= totalPages - 1 ? '#444' : '#aaa', borderRadius: 8, padding: '8px 20px', cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontSize: 13 }}
          >
            次 →
          </button>
        </div>
      )}

      {/* 編集モーダル */}
      {editTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={e => e.target === e.currentTarget && setEditTarget(null)}>
          <div style={{
            background: '#181818', borderRadius: '20px 20px 0 0', padding: '20px 16px 36px',
            width: '100%', maxWidth: 480,
          }}>
            <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 16 }}>景品編集</div>

            {[
              { label: '景品名', key: 'name', type: 'text' },
              { label: 'エイリアス', key: 'alias', type: 'text' },
              { label: 'カテゴリ', key: 'category', type: 'text' },
              { label: '仕入単価', key: 'unit_cost', type: 'number' },
              { label: 'メモ', key: 'notes', type: 'text' },
            ].map(({ label, key, type }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</div>
                <input
                  type={type}
                  value={editTarget[key] ?? ''}
                  onChange={e => setEditTarget(t => ({ ...t, [key]: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#252525', border: '1px solid #333', borderRadius: 8,
                    color: '#e0e0e0', fontSize: 14, padding: '10px 12px', outline: 'none',
                  }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setEditTarget(null)}
                style={{ flex: 1, background: '#252525', border: '1px solid #333', color: '#aaa', borderRadius: 10, padding: '12px 0', fontSize: 14, cursor: 'pointer' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ flex: 2, background: saving ? '#333' : '#4a9eff', border: 'none', color: '#fff', borderRadius: 10, padding: '12px 0', fontSize: 14, fontWeight: 'bold', cursor: saving ? 'default' : 'pointer' }}
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
