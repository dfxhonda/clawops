import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { approveSession, getSessionDetail, lockSession } from './api'

const STATUS_LABELS = {
  open:      '入力中',
  submitted: '提出済み',
  approved:  '承認済み',
  locked:    'ロック済',
}

export default function SessionDetail() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [acting,  setActing]  = useState(false)

  useEffect(() => {
    getSessionDetail(sessionId).then(({ session, items }) => {
      setSession(session)
      setItems(items)
      setLoading(false)
    })
  }, [sessionId])

  const countedCount = items.filter(i => i.actual_count != null).length
  const diffItems    = items.filter(i => i.variance_rate != null && Number(i.variance_rate) > 0)
  const canApprove   = session?.status === 'submitted'

  async function handleApprove() {
    setActing(true)
    try {
      await approveSession(sessionId)
      setSession(prev => ({ ...prev, status: 'approved' }))
    } finally {
      setActing(false)
    }
  }

  async function handleLock() {
    setActing(true)
    try {
      await lockSession(sessionId)
      setSession(prev => ({ ...prev, status: 'locked' }))
    } finally {
      setActing(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">読み込み中...</div>
  )

  const monthLabel = session?.month
    ? new Date(session.month + 'T00:00:00+09:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })
    : ''

  return (
    <div className="min-h-screen bg-bg text-text pb-32">
      <div
        className="shrink-0 flex items-center gap-3 px-5 pt-10 pb-6"
        style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#3b82f6' }}
      >
        <button onClick={() => navigate('/admin/stocktake')} className="text-muted text-xl leading-none shrink-0">‹</button>
        <p className="text-text text-xl font-bold flex-1 truncate">{monthLabel} 棚卸し</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
          session?.status === 'approved' ? 'text-blue-400 border-blue-400/40' :
          session?.status === 'submitted' ? 'text-yellow-400 border-yellow-400/40' :
          session?.status === 'locked'   ? 'text-rose-400 border-rose-400/40' :
          'text-emerald-400 border-emerald-400/40'
        }`}>
          {STATUS_LABELS[session?.status] ?? session?.status}
        </span>
      </div>

      <div className="px-5 space-y-4 pb-10">
        <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
          <Row label="月" value={monthLabel} />
          <Row label="カウント" value={`${countedCount}品目`} />
          <Row
            label="乖離あり"
            value={`${diffItems.length}品目`}
            valueClass={diffItems.length > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}
          />
        </div>

        {diffItems.length > 0 && (
          <div>
            <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2">乖離あり</div>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {diffItems.map((item, i) => (
                <div
                  key={`${item.session_id}-${item.prize_id}-${item.owner_code}`}
                  className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
                >
                  <div className="flex-1 text-sm truncate">{item.prize_name}</div>
                  <div className="text-xs text-muted font-mono shrink-0">
                    {item.owner_code}
                  </div>
                  <div className="text-xs text-muted font-mono shrink-0">
                    理:{item.theoretical_count}→実:{item.actual_count}
                  </div>
                  <div className="text-xs font-bold font-mono text-rose-400 shrink-0">
                    {Math.round(Number(item.variance_rate) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {(canApprove || session?.status === 'approved') && (
        <div className="fixed bottom-0 inset-x-0 bg-bg border-t border-border px-5 py-3 flex gap-2">
          {canApprove && (
            <button
              onClick={handleApprove}
              disabled={acting}
              className="flex-1 h-12 bg-accent text-bg text-sm rounded-2xl font-bold disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {acting ? '処理中...' : '承認する'}
            </button>
          )}
          {session?.status === 'approved' && (
            <button
              onClick={handleLock}
              disabled={acting}
              className="flex-1 h-12 bg-rose-700 text-white text-sm rounded-2xl font-bold disabled:opacity-40"
            >
              {acting ? '処理中...' : 'ロックする'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, valueClass = '' }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={`font-medium ${valueClass}`}>{value}</span>
    </div>
  )
}
