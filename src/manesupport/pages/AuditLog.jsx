import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuditLogs, AUDIT_ACTIONS, AUDIT_REASONS } from '../../services/audit'
import { getStaffMap } from '../../services/readings'
import { useAuth } from '../../hooks/useAuth'
import LogoutButton from '../../components/LogoutButton'
import ErrorDisplay from '../../components/ErrorDisplay'
import { useAsync } from '../../hooks/useAsync'

const PAGE_SIZE = 100

function DiffView({ before, after }) {
  if (!before && !after) return null
  if (!before) return <JsonBlock label="after" data={after} color="text-accent3" />
  if (!after) return <JsonBlock label="before" data={before} color="text-accent2" />

  const allKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  const diffs = allKeys.filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
  if (diffs.length === 0) return <div className="text-xs text-muted">変更なし</div>

  return (
    <div className="space-y-1">
      {diffs.map(k => (
        <div key={k} className="text-xs">
          <span className="text-muted">{k}: </span>
          <span className="text-accent2">{fmt(before[k])}</span>
          <span className="text-muted"> → </span>
          <span className="text-accent3">{fmt(after[k])}</span>
        </div>
      ))}
    </div>
  )
}

function JsonBlock({ label, data, color }) {
  return (
    <div className="text-xs">
      <span className={`${color} font-bold`}>{label}:</span>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="ml-2">
          <span className="text-muted">{k}: </span>
          <span className={color}>{fmt(v)}</span>
        </div>
      ))}
    </div>
  )
}

function fmt(val) {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export default function AuditLog() {
  const navigate = useNavigate()
  const { staffId: myStaffId } = useAuth()
  const { loading: searching, execute, errorProps } = useAsync()

  const [logs, setLogs] = useState([])
  const [staffMap, setStaffMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [expanded, setExpanded] = useState(null)

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterStaff, setFilterStaff] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterReason, setFilterReason] = useState('')
  const [searchText, setSearchText] = useState('')

  const filters = useMemo(() => ({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    staffId: filterStaff || undefined,
    action: filterAction || undefined,
    reasonCode: filterReason || undefined,
    searchText: searchText || undefined,
  }), [dateFrom, dateTo, filterStaff, filterAction, filterReason, searchText])

  useEffect(() => {
    getStaffMap().then(m => setStaffMap(m)).catch(() => {})
  }, [])

  // 初回 + フィルタ変更時
  useEffect(() => {
    setLoading(true)
    setOffset(0)
    setExpanded(null)
    getAuditLogs(filters, 0, PAGE_SIZE).then(data => {
      setLogs(data)
      setHasMore(data.length >= PAGE_SIZE)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [filters])

  async function loadMore() {
    const newOffset = offset + PAGE_SIZE
    const result = await execute(async () => {
      return await getAuditLogs(filters, newOffset, PAGE_SIZE)
    })
    if (result) {
      setLogs(prev => [...prev, ...result])
      setOffset(newOffset)
      setHasMore(result.length >= PAGE_SIZE)
    }
  }

  function resetFilters() {
    setDateFrom(''); setDateTo(''); setFilterStaff(''); setFilterAction(''); setFilterReason(''); setSearchText('')
  }

  const staffName = (id) => staffMap[id] || id || '—'

  return (
    <div className="h-full flex flex-col max-w-lg md:max-w-4xl mx-auto">
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/admin/menu')} className="text-muted text-2xl">←</button>
          <h1 className="flex-1 text-xl font-bold text-accent">監査ログ</h1>
          <LogoutButton to="/admin/menu" />
        </div>

        {errorProps && <ErrorDisplay {...errorProps} />}

        {/* フィルタ */}
        <div className="bg-surface border border-border rounded-xl p-3 mb-3 space-y-2">
          <div>
            <label className="text-xs text-muted block mb-1">期間</label>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="flex-1 bg-surface2 border border-border rounded-lg px-2 py-1.5 text-xs text-text [color-scheme:dark]" />
              <span className="text-muted text-xs">〜</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="flex-1 bg-surface2 border border-border rounded-lg px-2 py-1.5 text-xs text-text [color-scheme:dark]" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-muted block mb-1">担当者</label>
              <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)}
                className="w-full bg-surface2 border border-border rounded-lg px-2 py-1.5 text-xs text-text">
                <option value="">全て</option>
                {Object.entries(staffMap).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">操作</label>
              <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
                className="w-full bg-surface2 border border-border rounded-lg px-2 py-1.5 text-xs text-text">
                <option value="">全て</option>
                {Object.entries(AUDIT_ACTIONS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-muted block mb-1">理由</label>
              <select value={filterReason} onChange={e => setFilterReason(e.target.value)}
                className="w-full bg-surface2 border border-border rounded-lg px-2 py-1.5 text-xs text-text">
                <option value="">全て</option>
                {Object.entries(AUDIT_REASONS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">テキスト検索</label>
              <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                placeholder="detailで検索..."
                className="w-full bg-surface2 border border-border rounded-lg px-2 py-1.5 text-xs text-text" />
            </div>
          </div>
          {(dateFrom || dateTo || filterStaff || filterAction || filterReason || searchText) && (
            <button onClick={resetFilters} className="text-xs text-accent2 hover:underline">フィルタをリセット</button>
          )}
        </div>

        <div className="text-xs text-muted mb-2">{logs.length}件{hasMore ? '+' : ''}</div>
      </div>

      {/* ログ一覧 */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {loading ? (
          <div className="text-center text-muted py-8">読み込み中...</div>
        ) : logs.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center text-sm text-muted">
            該当するログはありません
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id}
                className="bg-surface border border-border rounded-xl p-3 cursor-pointer active:bg-surface2"
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-accent">
                        {AUDIT_ACTIONS[log.action] || log.action}
                      </span>
                      {log.reason_code && (
                        <span className="text-[10px] bg-surface3 text-muted px-1.5 py-0.5 rounded">
                          {AUDIT_REASONS[log.reason_code] || log.reason_code}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted">
                      {staffName(log.staff_id)} / {log.target_table}{log.target_id ? ` #${log.target_id}` : ''}
                    </div>
                    <div className="text-xs text-text/80 mt-0.5 truncate">{log.detail}</div>
                  </div>
                  <div className="text-[10px] text-muted shrink-0 ml-2 text-right">
                    {log.created_at ? new Date(log.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                </div>

                {/* 展開時: 差分 + 詳細 */}
                {expanded === log.id && (
                  <div className="mt-2 pt-2 border-t border-border space-y-2">
                    {log.reason_note && (
                      <div className="text-xs"><span className="text-muted">理由メモ: </span>{log.reason_note}</div>
                    )}
                    {(log.before_data || log.after_data) && (
                      <div className="bg-surface2 rounded-lg p-2">
                        <div className="text-[10px] text-muted font-bold mb-1">変更内容</div>
                        <DiffView before={log.before_data} after={log.after_data} />
                      </div>
                    )}
                    <div className="text-[10px] text-muted">
                      ID: {log.id} / {log.created_at}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {hasMore && (
              <button onClick={loadMore} disabled={searching}
                className="w-full bg-surface2 border border-border rounded-xl py-3 text-sm text-muted hover:text-accent disabled:opacity-50">
                {searching ? '読み込み中...' : 'もっと読み込む'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
