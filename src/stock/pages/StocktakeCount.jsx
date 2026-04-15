import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const FILTERS = [
  { key: 'uncounted', label: '未カウント' },
  { key: 'diff',      label: '差異あり' },
  { key: 'all',       label: '全て' },
]

// debounce utility
function debounce(fn, ms) {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}

// 1景品の入力行
function CountRow({ line, prizeName, staffId, onUpdate }) {
  const [val, setVal] = useState(line.counted_quantity ?? '')
  const [touched, setTouched] = useState(line.counted_quantity !== null)
  const [saving, setSaving] = useState(false)
  const [lockedBy, setLockedBy] = useState(line.locked_by && line.locked_by !== staffId ? line.locked_by : null)

  // 親からの更新を反映（他スタッフのリアルタイム変更）
  useEffect(() => {
    if (line.counted_quantity !== null && !touched) {
      setVal(line.counted_quantity)
    }
    if (line.locked_by && line.locked_by !== staffId) {
      setLockedBy(line.locked_by)
    } else {
      setLockedBy(null)
    }
  }, [line, staffId, touched])

  const debouncedSave = useMemo(() => debounce(async (value) => {
    setSaving(true)
    await supabase.from('stocktake_lines')
      .update({
        counted_quantity: value,
        counted_by: staffId,
        counted_at: new Date().toISOString(),
        locked_by: null,
      })
      .eq('line_id', line.line_id)
    setSaving(false)
    onUpdate(line.line_id, value)
  }, 500), [line.line_id, staffId, onUpdate])

  async function handleFocus() {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    await supabase.from('stocktake_lines')
      .update({ locked_by: staffId, locked_at: new Date().toISOString() })
      .eq('line_id', line.line_id)
      .or(`locked_by.is.null,locked_at.lt.${fiveMinAgo},locked_by.eq.${staffId}`)
  }

  async function handleBlur() {
    await supabase.from('stocktake_lines')
      .update({ locked_by: null })
      .eq('line_id', line.line_id)
      .eq('locked_by', staffId)
  }

  function handleChange(e) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setVal(raw)
    setTouched(true)
    if (raw !== '') debouncedSave(Number(raw))
  }

  const diff = touched && val !== '' ? Number(val) - line.system_quantity : null
  const hasDiff = diff !== null && diff !== 0

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b border-border ${hasDiff ? 'bg-yellow-500/5' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{prizeName}</div>
        <div className="text-xs text-muted mt-0.5">
          システム: <span className="font-mono">{line.system_quantity}</span>
          {lockedBy && <span className="ml-2 text-orange-400">{lockedBy} 入力中</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {hasDiff && (
          <span className={`text-xs font-bold font-mono ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {diff > 0 ? `+${diff}` : diff}
          </span>
        )}
        {touched && val !== '' && !hasDiff && (
          <span className="text-green-400 text-sm">✓</span>
        )}
        {saving && <span className="text-[10px] text-muted">保存中</span>}
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          value={val}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={!!lockedBy}
          placeholder={String(line.system_quantity)}
          style={{ fontSize: 16 }}
          className="w-16 text-right bg-surface2 border border-border rounded-lg px-2 py-1.5 font-mono font-bold disabled:opacity-40 focus:border-accent outline-none"
        />
      </div>
    </div>
  )
}

export default function StocktakeCount() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const staffId   = sessionStorage.getItem('stocktake_staff_id')

  const [session, setSession]   = useState(null)
  const [lines, setLines]       = useState([])
  const [prizeMap, setPrizeMap] = useState({}) // prize_id → prize_name
  const [filter, setFilter]     = useState('uncounted')
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [finishing, setFinishing] = useState(false)

  // 追加景品検索
  const [addSearch, setAddSearch]     = useState('')
  const [addResults, setAddResults]   = useState([])
  const [showAddPanel, setShowAddPanel] = useState(false)

  useEffect(() => {
    if (!staffId) navigate('/stock', { replace: true })
  }, [staffId, navigate])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: sess }, { data: lns }] = await Promise.all([
        supabase.from('stocktake_sessions').select('*').eq('session_id', sessionId).single(),
        supabase.from('stocktake_lines').select('*').eq('session_id', sessionId),
      ])
      setSession(sess)
      setLines(lns ?? [])

      // 景品名を取得
      const ids = (lns ?? []).map(l => l.prize_id)
      if (ids.length > 0) {
        const { data: prizes } = await supabase
          .from('prize_masters')
          .select('prize_id, prize_name')
          .in('prize_id', ids)
        const map = {}
        for (const p of prizes ?? []) map[p.prize_id] = p.prize_name
        setPrizeMap(map)
      }
      setLoading(false)
    }
    load()
  }, [sessionId])

  // リアルタイム購読
  useEffect(() => {
    const ch = supabase
      .channel(`stocktake:${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'stocktake_lines',
        filter: `session_id=eq.${sessionId}`,
      }, payload => {
        setLines(prev => prev.map(l => l.line_id === payload.new.line_id ? { ...l, ...payload.new } : l))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [sessionId])

  const handleUpdate = useCallback((lineId, value) => {
    setLines(prev => prev.map(l => l.line_id === lineId
      ? { ...l, counted_quantity: value, counted_by: staffId, counted_at: new Date().toISOString() }
      : l
    ))
  }, [staffId])

  // フィルタリング
  const filtered = useMemo(() => {
    let result = lines
    if (filter === 'uncounted') result = result.filter(l => l.counted_quantity === null)
    if (filter === 'diff')      result = result.filter(l => l.counted_quantity !== null && l.counted_quantity !== l.system_quantity)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(l => (prizeMap[l.prize_id] ?? '').toLowerCase().includes(q))
    }
    return result
  }, [lines, filter, search, prizeMap])

  const countedCount  = lines.filter(l => l.counted_quantity !== null).length
  const totalCount    = lines.length
  const pct           = totalCount > 0 ? Math.round((countedCount / totalCount) * 100) : 0

  // 景品追加検索
  useEffect(() => {
    if (!addSearch || addSearch.length < 2) { setAddResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('prize_masters')
        .select('prize_id, prize_name')
        .ilike('prize_name', `%${addSearch}%`)
        .limit(10)
      // 既存行を除外
      const existingIds = new Set(lines.map(l => l.prize_id))
      setAddResults((data ?? []).filter(p => !existingIds.has(p.prize_id)))
    }, 300)
    return () => clearTimeout(t)
  }, [addSearch, lines])

  async function handleAddPrize(prize) {
    const { data: stock } = await supabase
      .from('prize_stocks')
      .select('quantity')
      .eq('prize_id', prize.prize_id)
      .eq('owner_type', session.location_owner_type)
      .eq('owner_id', session.location_owner_id)
      .maybeSingle()

    const { data: newLine } = await supabase
      .from('stocktake_lines')
      .insert({
        session_id:      sessionId,
        prize_id:        prize.prize_id,
        system_quantity: stock?.quantity ?? 0,
      })
      .select()
      .single()

    if (newLine) {
      setLines(prev => [...prev, newLine])
      setPrizeMap(prev => ({ ...prev, [prize.prize_id]: prize.prize_name }))
    }
    setAddSearch('')
    setAddResults([])
    setShowAddPanel(false)
  }

  async function handleFinish() {
    const uncounted = lines.filter(l => l.counted_quantity === null).length
    if (uncounted > 0) {
      if (!window.confirm(`未カウント ${uncounted}件あります。完了してよいですか？`)) return
    }
    setFinishing(true)
    await supabase.from('stocktake_sessions')
      .update({ status: 'completed', finished_at: new Date().toISOString(), counted_items: countedCount })
      .eq('session_id', sessionId)
    navigate(`/stock/summary/${sessionId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">
        読み込み中...
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">

      {/* ヘッダー */}
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate('/stock/top')} className="text-xl text-muted">←</button>
          <div className="flex-1">
            <div className="text-sm font-bold">
              {session?.location_owner_type === 'staff'
                ? `${sessionStorage.getItem('stocktake_staff_name')}の車`
                : session?.location_owner_id}
            </div>
          </div>
          <button
            onClick={handleFinish}
            disabled={finishing}
            className="px-4 py-1.5 rounded-xl bg-accent text-bg text-xs font-bold disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            {finishing ? '処理中...' : '棚卸し完了'}
          </button>
        </div>
        {/* 進捗バー */}
        <div>
          <div className="flex justify-between text-[10px] text-muted mb-1">
            <span>{countedCount} / {totalCount} 完了</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
            <div className="h-full rounded-full bg-accent3 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="sticky top-[88px] z-40 bg-bg border-b border-border px-4 py-2 flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors
              ${filter === f.key ? 'bg-accent text-bg' : 'bg-surface text-muted border border-border'}`}
          >
            {f.label}
            {f.key === 'uncounted' && <span className="ml-1">{lines.filter(l => l.counted_quantity === null).length}</span>}
            {f.key === 'diff'      && <span className="ml-1">{lines.filter(l => l.counted_quantity !== null && l.counted_quantity !== l.system_quantity).length}</span>}
          </button>
        ))}
      </div>

      {/* 検索 */}
      <div className="px-4 py-2 border-b border-border">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="景品名で検索"
          style={{ fontSize: 16 }}
          className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text outline-none focus:border-accent placeholder:text-muted"
        />
      </div>

      {/* 一覧 */}
      <div className="flex-1 pb-24">
        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-16 text-muted text-sm">
            {filter === 'uncounted' ? 'すべてカウント済みです ✅' : '該当なし'}
          </div>
        )}
        {filtered.map(line => (
          <CountRow
            key={line.line_id}
            line={line}
            prizeName={prizeMap[line.prize_id] ?? line.prize_id}
            staffId={staffId}
            onUpdate={handleUpdate}
          />
        ))}

        {/* 景品追加 */}
        <div className="px-4 py-3">
          {!showAddPanel ? (
            <button
              onClick={() => setShowAddPanel(true)}
              className="w-full py-3 rounded-xl border border-dashed border-border text-muted text-sm hover:border-accent/40 transition-colors"
            >
              ＋ この場所にない景品を追加
            </button>
          ) : (
            <div className="bg-surface border border-border rounded-xl p-3">
              <div className="text-xs text-muted mb-2">景品名で検索して追加</div>
              <input
                type="search"
                value={addSearch}
                onChange={e => setAddSearch(e.target.value)}
                placeholder="景品名を入力..."
                style={{ fontSize: 16 }}
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text outline-none focus:border-accent placeholder:text-muted mb-2"
                autoFocus
              />
              {addResults.map(p => (
                <button
                  key={p.prize_id}
                  onClick={() => handleAddPrize(p)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface2 text-sm border-b border-border last:border-0"
                >
                  {p.prize_name}
                </button>
              ))}
              <button onClick={() => setShowAddPanel(false)} className="text-xs text-muted mt-1">キャンセル</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
