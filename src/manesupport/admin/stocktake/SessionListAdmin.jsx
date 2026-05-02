import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllSessions } from './api'

const STATUS_LABELS = {
  in_progress: { label: '入力中',   color: 'text-emerald-400 border-emerald-400/40' },
  submitted:   { label: '提出済み', color: 'text-yellow-400 border-yellow-400/40' },
  approved:    { label: '承認済み', color: 'text-blue-400 border-blue-400/40' },
  rejected:    { label: '差し戻し', color: 'text-rose-400 border-rose-400/40' },
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

export default function SessionListAdmin() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    getAllSessions().then(data => { setSessions(data); setLoading(false) })
  }, [])

  const filtered = filterStatus === 'all'
    ? sessions
    : sessions.filter(s => s.status === filterStatus)

  return (
    <div className="min-h-screen bg-bg text-text">
      <div
        className="shrink-0 flex items-center gap-3 px-5 pt-10 pb-6"
        style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#3b82f6' }}
      >
        <button onClick={() => navigate('/admin')} className="text-muted text-xl leading-none shrink-0">‹</button>
        <p className="text-text text-xl font-bold flex-1">棚卸し管理</p>
        <button
          onClick={() => navigate('/admin/stocktake/create')}
          className="px-3 py-1.5 rounded-xl bg-accent text-bg text-xs font-bold"
        >
          ＋ 新規作成
        </button>
      </div>

      {/* ステータスフィルター */}
      <div className="px-5 flex gap-2 pb-3 border-b border-border flex-wrap">
        {['all', 'in_progress', 'submitted', 'approved', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
              filterStatus === s ? 'bg-accent text-bg' : 'bg-surface text-muted border border-border'
            }`}
          >
            {s === 'all' ? '全て' : STATUS_LABELS[s]?.label}
          </button>
        ))}
      </div>

      <div className="px-5 pt-3 pb-10">
        {loading ? (
          <div className="text-center text-muted text-sm py-16">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted text-sm py-16">セッションなし</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(s => {
              const st = STATUS_LABELS[s.status] ?? { label: s.status, color: 'text-muted border-border' }
              return (
                <button
                  key={s.session_id}
                  onClick={() => navigate(`/admin/stocktake/${s.session_id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{s.session_name}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {s.store_code} · {formatDate(s.start_date)}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${st.color}`}>
                    {st.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
