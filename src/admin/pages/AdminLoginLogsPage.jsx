import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const PAGE = 500
const PRESETS = ['today', 'week', 'month', 'custom']
const P_LABEL = { today: '今日', week: '今週', month: '今月', custom: 'カスタム' }

function todayJst() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) }
function rangeFrom(preset, cf) {
  if (preset === 'today') return todayJst()
  if (preset === 'week')  { const d = new Date(); d.setDate(d.getDate() - 6); return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) }
  if (preset === 'month') return todayJst().slice(0, 7) + '-01'
  return cf
}
function fmtDt(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdminLoginLogsPage() {
  const [preset, setPreset]         = useState('week')
  const [customFrom, setCustomFrom] = useState('')
  const [rows, setRows]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [hasMore, setHasMore]       = useState(false)
  const [offset, setOffset]         = useState(0)
  const [detail, setDetail]         = useState(null)
  const [error, setError]           = useState(null)

  const load = useCallback(async (from, off) => {
    setLoading(true)
    const { data, error: loadErr } = await supabase
      .from('auth_logs')
      .select('id,created_at,staff_id,action,ip_address,user_agent')
      .gte('created_at', from + 'T00:00:00+09:00')
      .order('created_at', { ascending: false })
      .range(off, off + PAGE)
    if (loadErr) { setError(loadErr.message); setLoading(false); return }
    const chunk = data ?? []
    const more  = chunk.length > PAGE
    const slice = more ? chunk.slice(0, PAGE) : chunk
    if (off === 0) setRows(slice)
    else setRows(prev => [...prev, ...slice])
    setHasMore(more)
    setOffset(off + slice.length)
    setLoading(false)
  }, [])

  useEffect(() => {
    const from = rangeFrom(preset, customFrom)
    if (!from) return
    setOffset(0)
    load(from, 0)
  }, [preset, customFrom, load])

  function loadMore() { load(rangeFrom(preset, customFrom), offset) }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 80px)' }}>
      {/* toolbar */}
      <div className="flex-shrink-0 p-3 pb-2 flex flex-wrap gap-2 items-center">
        {PRESETS.map(p => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`px-3 py-1 rounded text-xs font-medium ${
              preset === p ? 'bg-blue-600 text-white' : 'bg-surface text-muted border border-border'
            }`}
          >
            {P_LABEL[p]}
          </button>
        ))}
        {preset === 'custom' && (
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="bg-bg border border-border rounded px-2 py-1 text-xs text-text"
          />
        )}
        <span className="text-xs text-muted ml-auto">{rows.length}件{hasMore ? '+' : ''}</span>
      </div>

      {error && <p className="text-red-400 text-xs px-3 py-1">{error}</p>}

      {/* list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
        {loading && rows.length === 0 && <p className="text-center text-muted text-xs py-8">読込中…</p>}
        {!loading && rows.length === 0 && <p className="text-center text-muted text-xs py-8">該当なし</p>}

        <table data-testid="login-table" className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-bg z-10">
            <tr className="border-b border-border">
              <th className="py-1 px-2 text-left text-muted whitespace-nowrap">日時</th>
              <th className="py-1 px-2 text-left text-muted">スタッフ</th>
              <th className="py-1 px-2 text-left text-muted">操作</th>
              <th className="py-1 px-2 text-left text-muted hidden md:table-cell">IP</th>
              <th className="py-1 px-2 text-left text-muted hidden md:table-cell">UA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.id}
                data-testid="login-row"
                onClick={() => setDetail(r)}
                className="border-b border-border/50 hover:bg-surface cursor-pointer"
              >
                <td className="py-1.5 px-2 text-muted whitespace-nowrap">{fmtDt(r.created_at)}</td>
                <td className="py-1.5 px-2 text-text">{r.staff_id}</td>
                <td className="py-1.5 px-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    r.action === 'login' ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {r.action}
                  </span>
                </td>
                <td className="py-1.5 px-2 text-muted hidden md:table-cell">{r.ip_address}</td>
                <td className="py-1.5 px-2 text-muted max-w-[200px] truncate hidden md:table-cell">{r.user_agent}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {hasMore && !loading && (
          <button onClick={loadMore} className="mt-3 w-full py-2 text-xs text-muted border border-border rounded hover:bg-surface">
            さらに読む
          </button>
        )}
        {loading && rows.length > 0 && <p className="text-center text-muted text-xs py-4">読込中…</p>}
      </div>

      {/* detail modal */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) setDetail(null) }}
        >
          <div data-testid="detail-modal" className="bg-bg border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85dvh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-text">ログイン履歴詳細</span>
              <button onClick={() => setDetail(null)} className="text-muted text-lg leading-none">✕</button>
            </div>
            <dl className="text-xs space-y-2">
              <div><dt className="text-muted">日時</dt><dd className="text-text">{fmtDt(detail.created_at)}</dd></div>
              <div><dt className="text-muted">スタッフ</dt><dd className="text-text">{detail.staff_id}</dd></div>
              <div><dt className="text-muted">操作</dt><dd className="text-text font-medium">{detail.action}</dd></div>
              <div><dt className="text-muted">IPアドレス</dt><dd className="text-text font-mono">{detail.ip_address}</dd></div>
              <div><dt className="text-muted">ユーザーエージェント</dt><dd className="text-text break-all">{detail.user_agent}</dd></div>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}
