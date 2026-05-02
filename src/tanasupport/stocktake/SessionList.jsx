import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/ui/PageHeader'
import { getActiveSessions } from './api'

function formatDate(d) {
  if (!d) return '未定'
  return new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

export default function SessionList() {
  const { storeCode } = useParams()
  const navigate = useNavigate()
  const [storeName, setStoreName] = useState('')
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: store }, sessnData] = await Promise.all([
        supabase.from('stores').select('store_name').eq('store_code', storeCode).single(),
        getActiveSessions(storeCode),
      ])
      setStoreName(store?.store_name ?? storeCode)
      setSessions(sessnData)
      setLoading(false)
    }
    load()
  }, [storeCode])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">
      読み込み中...
    </div>
  )

  return (
    <div className="min-h-screen bg-bg text-text">
      <PageHeader
        module="tanasupport"
        title={storeName}
        onBack={() => navigate(`/tanasupport/store/${storeCode}`)}
      >
        <span className="text-xs text-muted shrink-0">棚卸しセッション</span>
      </PageHeader>

      <div className="px-5 pb-10">
        {sessions.length === 0 ? (
          <div className="text-center text-muted text-sm py-16">
            現在進行中の棚卸しセッションはありません
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <button
                key={s.session_id}
                onClick={() => navigate(`/tanasupport/store/${storeCode}/stocktake/${s.session_id}`)}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-all"
              >
                <span className="text-lg">{s.status === 'submitted' ? '📤' : '📋'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{s.session_name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {formatDate(s.start_date)} 〜 {formatDate(s.end_date)}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
                  s.status === 'submitted'
                    ? 'text-yellow-400 border-yellow-400/40'
                    : 'text-emerald-400 border-emerald-400/40'
                }`}>
                  {s.status === 'submitted' ? '提出済み' : '入力中'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
