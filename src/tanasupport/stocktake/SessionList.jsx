import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/ui/PageHeader'
import { getAllSessions, getOrCreateMonthSession } from './api'

function borderClass(status) {
  if (status === 'open')      return 'border-l-emerald-500'
  if (status === 'submitted') return 'border-l-amber-500'
  return 'border-l-border'
}

function statusChip(status) {
  if (status === 'open')      return { text: '入力中',    cls: 'text-emerald-400 border-emerald-400/40' }
  if (status === 'submitted') return { text: '提出済み',  cls: 'text-amber-400 border-amber-400/40' }
  if (status === 'locked')    return { text: 'ロック済み', cls: 'text-muted border-border' }
  return { text: status, cls: 'text-muted border-border' }
}

export default function SessionList() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [progressMap, setProgressMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const list = await getAllSessions()
      if (cancelled) return
      setSessions(list)

      if (list.length > 0) {
        const { data } = await supabase
          .from('stocktake_items')
          .select('session_id, actual_count, owner_type')
          .in('session_id', list.map(s => s.session_id))
        if (!cancelled) {
          const map = {}
          for (const s of list) {
            const items = (data ?? []).filter(
              i => i.session_id === s.session_id && i.owner_type !== 'booth'
            )
            map[s.session_id] = {
              total:  items.length,
              filled: items.filter(i => i.actual_count != null).length,
            }
          }
          setProgressMap(map)
        }
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function handleNewSession() {
    if (creating) return
    setCreating(true)
    try {
      await getOrCreateMonthSession()
      navigate('/tanasupport/stocktake')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">
      読み込み中...
    </div>
  )

  return (
    <div className="min-h-screen bg-bg text-text">
      <PageHeader
        module="tanasupport"
        title="棚卸しセッション"
        onBack={() => navigate('/tanasupport')}
      />

      {/* 上部: 新しい棚卸しを開始 */}
      <div className="px-5 pt-3 pb-3 border-b border-border">
        <button
          onClick={handleNewSession}
          disabled={creating}
          className="w-full h-12 bg-accent text-white font-bold text-sm rounded-2xl active:scale-[0.98] transition-all disabled:opacity-60"
          data-testid="btn-new-session"
        >
          {creating ? '作成中...' : '＋ 新しい棚卸しを開始'}
        </button>
      </div>

      {/* セッション一覧 */}
      <div className="px-5 pt-3 pb-10 space-y-2">
        {sessions.length === 0 ? (
          <div className="text-center text-muted text-sm py-16">
            セッションがありません
          </div>
        ) : (
          sessions.map(s => {
            const prog = progressMap[s.session_id]
            const pct  = prog && prog.total > 0 ? Math.round((prog.filled / prog.total) * 100) : null
            const chip = statusChip(s.status)
            const monthLabel = new Date(s.month + 'T00:00:00+09:00')
              .toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })
            return (
              <button
                key={s.session_id}
                onClick={() => navigate('/tanasupport/stocktake')}
                data-testid={`session-card-${s.session_id}`}
                className={`w-full text-left bg-surface border border-border border-l-4 ${borderClass(s.status)} rounded-xl px-4 py-3 active:scale-[0.98] transition-all`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{monthLabel}</div>
                    {prog != null && (
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[10px] text-muted mb-0.5">
                          <span>入力済 {prog.filled}/{prog.total}</span>
                          {pct != null && <span>{pct}%</span>}
                        </div>
                        <div className="w-full h-1.5 bg-bg rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct === 100 ? 'bg-emerald-500' : 'bg-accent'
                            }`}
                            style={{ width: `${pct ?? 0}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${chip.cls}`}>
                    {chip.text}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
