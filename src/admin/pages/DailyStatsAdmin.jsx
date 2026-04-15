import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth/AuthProvider'
import { triggerDailyStatsCompute } from '../../services/stats'
import LogoutButton from '../../components/LogoutButton'

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export default function DailyStatsAdmin() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [date, setDate] = useState(yesterday)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  if (role === 'staff') {
    navigate('/', { replace: true })
    return null
  }

  async function handleCompute() {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const { count } = await triggerDailyStatsCompute(date)
      setResult(count)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-2">
        <button onClick={() => navigate('/admin/menu')} className="text-xl text-muted hover:text-accent">←</button>
        <span className="font-bold text-sm flex-1">日次集計バッチ</span>
        <LogoutButton to="/admin/menu" />
      </div>

      <div className="px-4 py-6 max-w-md mx-auto space-y-6">
        <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">集計対象日</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          </div>

          <button
            onClick={handleCompute}
            disabled={loading || !date}
            className="w-full py-3 rounded-xl font-bold text-sm bg-accent text-white disabled:opacity-40 active:scale-[0.98] transition-all">
            {loading ? '集計中...' : '集計実行'}
          </button>
        </div>

        {result !== null && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-sm text-green-400 font-semibold">
            {result} ブース分の集計が完了しました
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="text-xs text-muted space-y-1">
          <p>• 毎日 02:00 JST に前日分が自動集計されます</p>
          <p>• 同じ日付を再実行すると上書きされます</p>
        </div>
      </div>
    </div>
  )
}
