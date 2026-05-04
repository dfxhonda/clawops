import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import { createSession, getActiveSessions } from './api'

function formatDate(d) {
  if (!d) return '未定'
  return new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

function todayISO() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

function NewSessionSheet({ storeCode, onCreated, onClose }) {
  const { staffId } = useAuth()
  const today = todayISO()
  const [name, setName] = useState(today)
  const [startDate, setStartDate] = useState(today)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const sessionId = await createSession({
        storeCode,
        sessionName: name.trim() || today,
        startDate,
        staffId,
      })
      onCreated(sessionId)
    } catch (e) {
      setError(e.message)
      setCreating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-t-2xl px-5 pt-5 pb-8 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-text">新規棚卸し開始</h2>
          <button onClick={onClose} className="text-muted text-sm px-2 py-1">キャンセル</button>
        </div>

        <div>
          <label className="text-xs text-muted block mb-1">セッション名</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={today}
            style={{ fontSize: 16 }}
            className="w-full px-3 py-2.5 rounded-lg bg-bg border border-border text-text outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="text-xs text-muted block mb-1">開始日</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ fontSize: 16 }}
            className="w-full px-3 py-2.5 rounded-lg bg-bg border border-border text-text outline-none focus:border-accent"
          />
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full h-12 rounded-xl font-bold text-sm bg-emerald-500 text-white active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {creating ? '作成中...' : '棚卸しを開始する'}
        </button>
      </div>
    </div>
  )
}

export default function SessionList() {
  const { storeCode } = useParams()
  const navigate = useNavigate()
  const [storeName, setStoreName] = useState('')
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSheet, setShowSheet] = useState(false)

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

  function handleCreated(sessionId) {
    setShowSheet(false)
    navigate(`/tanasupport/store/${storeCode}/stocktake/${sessionId}`)
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
        title={storeName}
        onBack={() => navigate(`/tanasupport/store/${storeCode}`)}
      >
        <span className="text-xs text-muted shrink-0">棚卸しセッション</span>
      </PageHeader>

      <div className="px-5 pb-28">
        {sessions.length === 0 ? (
          <div className="text-center text-muted text-sm py-16">
            進行中の棚卸しセッションはありません
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

      {/* 新規棚卸し開始ボタン（固定フッター） */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-6 pt-3 bg-bg border-t border-border">
        <button
          onClick={() => setShowSheet(true)}
          className="w-full h-12 rounded-xl font-bold text-sm bg-emerald-500 text-white active:scale-[0.98] transition-all"
        >
          ＋ 新規棚卸し開始
        </button>
      </div>

      {showSheet && (
        <NewSessionSheet
          storeCode={storeCode}
          onCreated={handleCreated}
          onClose={() => setShowSheet(false)}
        />
      )}
    </div>
  )
}
