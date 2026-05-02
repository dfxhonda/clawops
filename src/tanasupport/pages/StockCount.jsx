import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import NumpadField from '../../clawsupport/components/NumpadField'

const TABS = [
  { key: 'warehouse', label: '倉庫' },
  { key: 'store',     label: '店舗' },
  { key: 'staff',     label: 'スタッフ' },
]

function diffStyle(diff, counted) {
  if (counted === null || counted === '') return { color: '#94a3b8' }
  if (diff > 0) return { color: '#10b981' }
  if (diff < 0) return { color: '#f43f5e' }
  return { color: '#94a3b8' }
}

function diffLabel(diff, counted) {
  if (counted === null || counted === '') return '—'
  if (diff > 0) return `▲+${diff}`
  if (diff < 0) return `▼${diff}`
  return '±0'
}

// ──────────────────────────────────────────────
// Phase 1: 拠点選択
// ──────────────────────────────────────────────
function SelectPhase({ staffId, staffName, onStart }) {
  const [tab, setTab] = useState('warehouse')
  const [locations, setLocations] = useState([])
  const [selected, setSelected] = useState(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('locations')
      .select('location_id, location_name, location_type')
      .eq('is_active', true)
      .order('location_name')
      .then(({ data }) => setLocations(data ?? []))
  }, [])

  function getList() {
    if (tab === 'staff') {
      return [{ ownerType: 'staff', ownerId: staffId, label: `${staffName ?? staffId}の車` }]
    }
    const type = tab === 'warehouse' ? 'warehouse' : 'store'
    return locations
      .filter(l => l.location_type === type)
      .map(l => ({ ownerType: 'location', ownerId: l.location_id, label: l.location_name }))
  }

  async function handleStart() {
    if (!selected) return
    setStarting(true)
    setError('')
    try {
      // 既存 in_progress セッション確認
      const { data: existing } = await supabase
        .from('stocktake_sessions')
        .select('session_id, started_at')
        .eq('location_owner_type', selected.ownerType)
        .eq('location_owner_id', selected.ownerId)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        const startedAt = new Date(existing.started_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        const resume = window.confirm(
          `未完了の棚卸しがあります（${startedAt}開始）。\n\n「OK」で続きから再開、「キャンセル」で新規開始します。`
        )
        if (resume) {
          await onStart(selected, existing.session_id)
          return
        }
      }

      // 新規セッション作成
      const { data: stocks } = await supabase
        .from('prize_stocks')
        .select('prize_id, quantity')
        .eq('owner_type', selected.ownerType)
        .eq('owner_id', selected.ownerId)

      const { data: session, error: sessErr } = await supabase
        .from('stocktake_sessions')
        .insert({
          location_owner_type: selected.ownerType,
          location_owner_id:   selected.ownerId,
          created_by:          staffId,
          total_items:         (stocks ?? []).length,
        })
        .select('session_id')
        .single()

      if (sessErr || !session) throw sessErr ?? new Error('session insert failed')

      if (stocks && stocks.length > 0) {
        await supabase.from('stocktake_lines').insert(
          stocks.map(s => ({
            session_id:      session.session_id,
            prize_id:        s.prize_id,
            system_quantity: s.quantity,
          }))
        )
      }

      await onStart(selected, session.session_id)
    } catch (e) {
      setError(e.message)
      setStarting(false)
    }
  }

  const list = getList()

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="text-base font-bold flex-1">📦 棚卸しカウント</div>
      </div>

      <div className="flex-1 px-4 pt-4 pb-24 space-y-4">
        {/* タブ */}
        <div className="flex rounded-xl bg-surface border border-border overflow-hidden">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelected(null) }}
              className={`flex-1 py-2.5 text-sm font-bold transition-colors
                ${tab === t.key ? 'bg-accent text-bg' : 'text-muted'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 場所リスト */}
        <div className="space-y-1.5">
          {list.map(item => {
            const isSel = selected?.ownerId === item.ownerId
            return (
              <button
                key={item.ownerId}
                onClick={() => setSelected(isSel ? null : item)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all active:scale-[0.98]
                  ${isSel ? 'bg-accent/10 border-accent' : 'bg-surface border-border'}`}
              >
                <span className="flex-1 text-sm font-semibold">{item.label}</span>
                {isSel && <span className="text-accent text-sm">✓</span>}
              </button>
            )
          })}
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-900/30 border border-red-700/50 text-red-400 text-xs">{error}</div>
        )}

        <button
          onClick={handleStart}
          disabled={!selected || starting}
          className="w-full py-4 rounded-xl bg-accent text-bg font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          {starting ? '準備中...' : 'カウント開始'}
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Phase 2: カウント
// ──────────────────────────────────────────────
function CountingPhase({ sessionId, owner, staffId, onComplete, onSuspend }) {
  const [lines, setLines] = useState([])   // { line_id, prize_id, prize_name, system_quantity, counted_quantity }
  const [counts, setCounts] = useState({}) // line_id → string value
  const [loading, setLoading] = useState(true)
  const [activeLineId, setActiveLineId] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: lns }, { data: prizes }] = await Promise.all([
        supabase.from('stocktake_lines').select('*').eq('session_id', sessionId),
        supabase.from('prize_masters').select('prize_id, prize_name'),
      ])
      const prizeMap = {}
      for (const p of prizes ?? []) prizeMap[p.prize_id] = p.prize_name

      const enriched = (lns ?? []).map(l => ({
        ...l,
        prize_name: prizeMap[l.prize_id] ?? l.prize_id,
      }))
      setLines(enriched)

      // 既存 counted_quantity を初期値に
      const init = {}
      for (const l of enriched) {
        if (l.counted_quantity !== null) init[l.line_id] = String(l.counted_quantity)
      }
      setCounts(init)
      setLoading(false)
    }
    load()
  }, [sessionId])

  const handleChange = useCallback((lineId, val) => {
    setCounts(prev => ({ ...prev, [lineId]: val }))
  }, [])

  function getDiff(line) {
    const c = counts[line.line_id]
    if (c === undefined || c === '') return null
    return Number(c) - line.system_quantity
  }

  const countedCount = lines.filter(l => counts[l.line_id] !== undefined && counts[l.line_id] !== '').length

  async function handleComplete() {
    // サマリー用データを組み立てて渡す
    const enrichedLines = lines.map(l => ({
      ...l,
      counted_quantity: counts[l.line_id] !== undefined && counts[l.line_id] !== '' ? Number(counts[l.line_id]) : null,
      diff: getDiff(l) ?? 0,
    }))
    onComplete(enrichedLines)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">読み込み中...</div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 text-sm font-bold">{owner.label}</div>
          <span className="text-xs text-muted">{countedCount}/{lines.length}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {lines.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted text-sm gap-2">
            <span>在庫データなし</span>
            <span className="text-xs">0からカウントして在庫を登録できます</span>
          </div>
        )}
        {lines.map(line => {
          const diff = getDiff(line)
          const val = counts[line.line_id] ?? ''
          const isActive = activeLineId === line.line_id
          return (
            <div key={line.line_id} className="border-b border-border">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-surface2"
                onClick={() => setActiveLineId(isActive ? null : line.line_id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{line.prize_name}</div>
                  <div className="text-xs text-muted mt-0.5">帳簿: {line.system_quantity}</div>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  <span className="font-mono font-bold text-sm" style={diffStyle(diff, val !== '' ? val : null)}>
                    {diffLabel(diff, val !== '' ? val : null)}
                  </span>
                  <span className="w-16 text-right font-mono font-bold text-sm bg-surface border border-border rounded-lg px-2 py-1.5">
                    {val !== '' ? val : <span className="text-muted">—</span>}
                  </span>
                </div>
              </button>
              {isActive && (
                <div className="px-4 pb-3">
                  <NumpadField
                    value={val}
                    onChange={v => handleChange(line.line_id, v)}
                    label={line.prize_name}
                    alwaysOpen
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border px-4 py-3 flex gap-3">
        <button
          onClick={onSuspend}
          className="flex-1 py-3.5 rounded-xl bg-surface border border-border text-sm font-bold text-muted active:scale-[0.98] transition-all"
        >
          中断する
        </button>
        <button
          onClick={handleComplete}
          className="flex-[2] py-3.5 rounded-xl bg-accent text-bg text-sm font-bold active:scale-[0.98] transition-all"
        >
          棚卸しを完了する
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Phase 3: サマリー確認
// ──────────────────────────────────────────────
function SummaryPhase({ sessionId, lines, owner, staffId, onConfirm, onBack }) {
  const [confirming, setConfirming] = useState(false)

  const diffLines = lines.filter(l => l.counted_quantity !== null && l.diff !== 0)
  const totalDiff = lines.reduce((s, l) => s + (l.counted_quantity !== null ? l.diff : 0), 0)

  async function handleConfirm() {
    setConfirming(true)
    const now = new Date().toISOString()
    const diffs = lines.filter(l => l.counted_quantity !== null && l.diff !== 0)

    await supabase.from('stocktake_sessions').update({
      status: 'completed',
      finished_at: now,
      diff_items: diffs.length,
      counted_items: lines.filter(l => l.counted_quantity !== null).length,
    }).eq('session_id', sessionId)

    for (const line of diffs) {
      await supabase.from('prize_stocks')
        .update({
          quantity: line.counted_quantity,
          last_counted_at: now,
          last_counted_by: staffId,
        })
        .eq('owner_type', owner.ownerType)
        .eq('owner_id', owner.ownerId)
        .eq('prize_id', line.prize_id)

      await supabase.from('stocktake_lines').update({
        counted_quantity: line.counted_quantity,
        diff: line.diff,
        counted_by: staffId,
        counted_at: now,
      }).eq('line_id', line.line_id)

      await supabase.from('stock_movements').insert({
        prize_id:        line.prize_id,
        movement_type:   'adjustment',
        to_owner_type:   owner.ownerType,
        to_owner_id:     owner.ownerId,
        quantity:        line.diff,
        reason:          `棚卸し差異修正 session:${sessionId}`,
        created_by:      staffId,
      })
    }

    onConfirm()
    setConfirming(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-xl text-muted">←</button>
        <div className="flex-1 text-base font-bold">確認: {owner.label}</div>
      </div>

      <div className="flex-1 px-4 pt-4 pb-28 space-y-4">
        {/* サマリーカード */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-muted font-bold uppercase tracking-wider">差異サマリー</span>
          </div>
          <div className="flex gap-4">
            <div>
              <div className="text-2xl font-bold">{diffLines.length}</div>
              <div className="text-xs text-muted">差異あり</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${totalDiff > 0 ? 'text-emerald-400' : totalDiff < 0 ? 'text-rose-400' : 'text-muted'}`}>
                {totalDiff > 0 ? `+${totalDiff}` : totalDiff}
              </div>
              <div className="text-xs text-muted">合計差異</div>
            </div>
          </div>
        </div>

        {/* 差異一覧 */}
        {diffLines.length > 0 && (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {diffLines.map((l, i) => (
              <div key={l.line_id} className={`flex items-center gap-3 px-4 py-3 ${i < diffLines.length - 1 ? 'border-b border-border/50' : ''}`}>
                <span className="flex-1 text-sm truncate">{l.prize_name}</span>
                <span className="text-xs text-muted font-mono">{l.system_quantity} →</span>
                <span className="font-mono font-bold text-sm" style={diffStyle(l.diff, l.counted_quantity)}>
                  {diffLabel(l.diff, l.counted_quantity)}
                </span>
              </div>
            ))}
          </div>
        )}

        {diffLines.length === 0 && (
          <div className="text-center py-8 text-muted text-sm">差異なし — 完璧です ✅</div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border px-4 py-3">
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="w-full py-4 rounded-xl bg-accent text-bg font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          {confirming ? '処理中...' : '確定 (元に戻せません)'}
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Phase 4: 完了
// ──────────────────────────────────────────────
function DonePhase({ diffCount, navigate }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg text-text px-8 gap-4">
      <div className="text-5xl">✅</div>
      <div className="text-xl font-bold">棚卸し完了</div>
      <div className="text-muted text-sm">差異 {diffCount} 件を在庫に反映しました</div>
      <button
        onClick={() => navigate('/stock/dashboard')}
        className="mt-4 px-8 py-4 rounded-xl bg-accent text-bg font-bold text-sm active:scale-[0.98] transition-all"
      >
        在庫一覧に戻る
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────
export default function StockCount() {
  const navigate = useNavigate()
  const { staffId, user } = useAuth()
  const staffName = user?.user_metadata?.name ?? staffId

  const [phase, setPhase] = useState('select') // select | counting | summary | done
  const [sessionId, setSessionId] = useState(null)
  const [owner, setOwner] = useState(null)
  const [countedLines, setCountedLines] = useState([])

  async function handleStart(selectedOwner, sid) {
    setOwner(selectedOwner)
    setSessionId(sid)
    setPhase('counting')
  }

  function handleComplete(lines) {
    setCountedLines(lines)
    setPhase('summary')
  }

  async function handleSuspend() {
    // in_progress のまま保存して戻る
    navigate('/stock/dashboard')
  }

  if (phase === 'select') {
    return (
      <SelectPhase
        staffId={staffId}
        staffName={staffName}
        onStart={handleStart}
      />
    )
  }

  if (phase === 'counting') {
    return (
      <CountingPhase
        sessionId={sessionId}
        owner={owner}
        staffId={staffId}
        onComplete={handleComplete}
        onSuspend={handleSuspend}
      />
    )
  }

  if (phase === 'summary') {
    return (
      <SummaryPhase
        sessionId={sessionId}
        lines={countedLines}
        owner={owner}
        staffId={staffId}
        onConfirm={() => setPhase('done')}
        onBack={() => setPhase('counting')}
      />
    )
  }

  return (
    <DonePhase
      diffCount={countedLines.filter(l => l.counted_quantity !== null && l.diff !== 0).length}
      navigate={navigate}
    />
  )
}
