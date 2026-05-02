import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { approveSession, getSessionDetail, rejectSession } from './api'

const STATUS_LABELS = {
  in_progress: '入力中',
  submitted:   '提出済み',
  approved:    '承認済み',
  rejected:    '差し戻し',
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function SessionDetail() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { staffId } = useAuth()

  const [session, setSession]     = useState(null)
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [acting, setActing]       = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject]     = useState(false)

  useEffect(() => {
    getSessionDetail(sessionId).then(({ session, items }) => {
      setSession(session)
      setItems(items)
      setLoading(false)
    })
  }, [sessionId])

  const diffItems    = items.filter(i => i.actual_qty != null && i.diff !== 0)
  const countedCount = items.filter(i => i.actual_qty != null).length

  async function handleApprove() {
    setActing(true)
    try {
      await approveSession(sessionId, staffId)
      setSession(prev => ({ ...prev, status: 'approved' }))
    } finally {
      setActing(false)
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return
    setActing(true)
    try {
      await rejectSession(sessionId, rejectReason)
      setSession(prev => ({ ...prev, status: 'rejected', rejected_reason: rejectReason }))
      setShowReject(false)
    } finally {
      setActing(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">読み込み中...</div>
  )

  const canAct = session?.status === 'submitted'

  return (
    <div className="min-h-screen bg-bg text-text pb-32">
      <div
        className="shrink-0 flex items-center gap-3 px-5 pt-10 pb-6"
        style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#3b82f6' }}
      >
        <button onClick={() => navigate('/admin/stocktake')} className="text-muted text-xl leading-none shrink-0">‹</button>
        <p className="text-text text-xl font-bold flex-1 truncate">{session?.session_name}</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
          session?.status === 'approved' ? 'text-blue-400 border-blue-400/40' :
          session?.status === 'submitted' ? 'text-yellow-400 border-yellow-400/40' :
          session?.status === 'rejected' ? 'text-rose-400 border-rose-400/40' :
          'text-emerald-400 border-emerald-400/40'
        }`}>
          {STATUS_LABELS[session?.status] ?? session?.status}
        </span>
      </div>

      <div className="px-5 space-y-4 pb-10">
        {/* サマリーカード */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
          <Row label="店舗" value={session?.store_code} />
          <Row label="開始日" value={session?.start_date} />
          <Row label="提出日時" value={formatDateTime(session?.submitted_at)} />
          <Row label="カウント" value={`${items.length}品目中 ${countedCount}完了`} />
          <Row
            label="差異あり"
            value={`${diffItems.length}品目`}
            valueClass={diffItems.length > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}
          />
          {session?.rejected_reason && (
            <Row label="差し戻し理由" value={session.rejected_reason} valueClass="text-rose-400" />
          )}
        </div>

        {/* 差異一覧 */}
        {diffItems.length > 0 && (
          <div>
            <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2">差異あり</div>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {diffItems.map((item, i) => (
                <div
                  key={item.item_id}
                  className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
                >
                  <div className="flex-1 text-sm truncate">{item.prize_name}</div>
                  <div className="text-xs text-muted font-mono shrink-0">
                    {item.expected_qty}→{item.actual_qty}
                  </div>
                  <div className={`text-sm font-bold font-mono shrink-0 ${item.diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {item.diff > 0 ? `+${item.diff}` : item.diff}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 差し戻しフォーム */}
        {showReject && (
          <div className="bg-surface border border-rose-700/40 rounded-xl p-4 space-y-3">
            <div className="text-sm font-bold text-rose-400">差し戻し理由</div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="理由を入力..."
              rows={3}
              style={{ fontSize: 16 }}
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text outline-none focus:border-rose-500 placeholder:text-muted resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowReject(false)}
                className="flex-1 py-2.5 rounded-xl bg-surface border border-border text-muted text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={handleReject}
                disabled={acting || !rejectReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-rose-700 text-white text-sm font-bold disabled:opacity-40"
              >
                差し戻す
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 承認/差し戻しボタン */}
      {canAct && !showReject && (
        <div className="fixed bottom-0 inset-x-0 bg-bg border-t border-border px-5 py-3 flex gap-2">
          <button
            onClick={() => setShowReject(true)}
            className="flex-1 h-12 bg-surface border border-rose-700/50 text-rose-400 text-sm rounded-2xl font-medium"
          >
            差し戻し
          </button>
          <button
            onClick={handleApprove}
            disabled={acting}
            className="flex-1 h-12 bg-accent text-bg text-sm rounded-2xl font-bold disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            {acting ? '処理中...' : '承認する'}
          </button>
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
