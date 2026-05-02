import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { createSession, getStaff, getStores } from './api'

export default function SessionCreate() {
  const navigate = useNavigate()
  const { staffId } = useAuth()

  const [stores, setStores] = useState([])
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [storeCode, setStoreCode]       = useState('')
  const [sessionName, setSessionName]   = useState('')
  const [startDate, setStartDate]       = useState(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }))
  const [endDate, setEndDate]           = useState('')
  const [assignees, setAssignees]       = useState([])

  useEffect(() => {
    Promise.all([getStores(), getStaff()]).then(([s, st]) => {
      setStores(s)
      setStaffList(st)
      setLoading(false)
    })
  }, [])

  function toggleAssignee(sid) {
    setAssignees(prev =>
      prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]
    )
  }

  async function handleCreate() {
    if (!storeCode || !sessionName || !startDate) {
      setError('店舗・セッション名・開始日は必須です')
      return
    }
    setSaving(true)
    setError('')
    try {
      const newId = await createSession({
        storeCode, sessionName, startDate, endDate, createdBy: staffId, assignees,
      })
      navigate(`/admin/stocktake/${newId}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">読み込み中...</div>
  )

  return (
    <div className="min-h-screen bg-bg text-text">
      <div
        className="shrink-0 flex items-center gap-3 px-5 pt-10 pb-6"
        style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#3b82f6' }}
      >
        <button onClick={() => navigate('/admin/stocktake')} className="text-muted text-xl leading-none shrink-0">‹</button>
        <p className="text-text text-xl font-bold flex-1">棚卸しセッション作成</p>
      </div>

      {error && (
        <div className="mx-5 mb-3 px-3 py-2 rounded-lg bg-red-900/30 border border-red-700/50 text-rose-400 text-xs">
          {error}
        </div>
      )}

      <div className="px-5 space-y-5 pb-32">
        <div>
          <label className="text-[10px] text-muted font-bold uppercase tracking-wider">店舗 *</label>
          <select
            value={storeCode}
            onChange={e => setStoreCode(e.target.value)}
            className="w-full mt-1.5 px-3 py-2.5 rounded-xl border border-border bg-surface text-text text-sm outline-none [color-scheme:dark]"
          >
            <option value="">選択してください</option>
            {stores.map(s => (
              <option key={s.store_code} value={s.store_code}>{s.store_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-muted font-bold uppercase tracking-wider">セッション名 *</label>
          <input
            type="text"
            value={sessionName}
            onChange={e => setSessionName(e.target.value)}
            placeholder="例: 2026年5月棚卸し"
            style={{ fontSize: 16 }}
            className="w-full mt-1.5 px-3 py-2.5 rounded-xl border border-border bg-surface text-text outline-none focus:border-accent placeholder:text-muted"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-muted font-bold uppercase tracking-wider">開始日 *</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ fontSize: 16 }}
              className="w-full mt-1.5 px-3 py-2.5 rounded-xl border border-border bg-surface text-text outline-none focus:border-accent [color-scheme:dark]"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-muted font-bold uppercase tracking-wider">終了日</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ fontSize: 16 }}
              className="w-full mt-1.5 px-3 py-2.5 rounded-xl border border-border bg-surface text-text outline-none focus:border-accent [color-scheme:dark]"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2 block">担当者</label>
          <div className="space-y-1.5">
            {staffList.map(st => (
              <button
                key={st.staff_id}
                type="button"
                onClick={() => toggleAssignee(st.staff_id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-all ${
                  assignees.includes(st.staff_id)
                    ? 'bg-accent/10 border-accent'
                    : 'bg-surface border-border'
                }`}
              >
                <span className="flex-1 text-sm">{st.name}</span>
                {assignees.includes(st.staff_id) && <span className="text-accent text-sm">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-bg border-t border-border px-5 py-3">
        <button
          onClick={handleCreate}
          disabled={saving || !storeCode || !sessionName || !startDate}
          className="w-full py-4 rounded-xl bg-accent text-bg font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          {saving ? '作成中...' : '棚卸しセッションを開始'}
        </button>
      </div>
    </div>
  )
}
