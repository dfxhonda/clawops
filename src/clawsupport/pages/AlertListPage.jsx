import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)       return 'たった今'
  if (diff < 3600)     return `${Math.floor(diff / 60)}分前`
  if (diff < 86400)    return `${Math.floor(diff / 3600)}時間前`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}日前`
  return new Date(iso).toLocaleDateString('ja-JP')
}

function ResolveDialog({ alert, onDone, onCancel }) {
  const { staffId } = useAuth()
  const [note, setNote]     = useState('')
  const [saving, setSaving] = useState(false)

  async function handleResolve() {
    setSaving(true)
    try {
      const { error } = await supabase.from('booth_alerts').update({
        resolved:      true,
        resolved_at:   new Date().toISOString(),
        resolved_by:   staffId ?? null,
        resolved_note: note.trim() || null,
      }).eq('alert_id', alert.alert_id)
      if (error) throw error
      onDone()
    } catch (e) {
      console.error('[ERR-ALERT-002] resolve failed', e)
      alert('解決済みに更新できませんでした')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative w-full bg-surface rounded-t-2xl px-4 pb-10 pt-5">
        <p className="font-bold text-base mb-1">対応完了にする</p>
        <p className="text-xs text-muted mb-3">{alert.booth_code} / {alert.alert_types?.label}</p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="対応メモ (任意)"
          rows={2}
          className="w-full bg-bg border border-border rounded-xl text-text text-sm px-3 py-2.5 resize-none mb-4 outline-none"
        />
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl bg-surface border border-border text-muted text-sm font-bold">キャンセル</button>
          <button type="button" onClick={handleResolve} disabled={saving} className="flex-[2] py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold">
            {saving ? '更新中…' : '対応完了'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AlertCard({ a, storeMap, onResolveClick, expanded, onToggle }) {
  const at = a.alert_types ?? {}
  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-surface mb-3">
      <div className="px-4 pt-3 pb-2 flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5">{at.icon_emoji ?? '📌'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color: at.color_hex ?? '#888' }}>{at.label ?? a.type_code}</span>
            <span className="text-xs text-muted">{timeAgo(a.created_at)}</span>
          </div>
          <p className="text-xs text-muted mt-0.5">{storeMap[a.store_code] ?? a.store_code} / {a.machine_code} / {a.booth_code}</p>
          {a.note && <p className="text-sm text-text/80 mt-1">{a.note}</p>}
        </div>
        <button
          type="button"
          onClick={() => onResolveClick(a)}
          className="shrink-0 w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted hover:border-emerald-500 hover:text-emerald-400 transition-colors"
          aria-label="対応完了"
        >
          ✓
        </button>
      </div>

      {/* アコーディオン: タップで詳細展開 */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-xs text-muted/60 py-1.5 border-t border-border/50 flex items-center justify-center gap-1"
      >
        {expanded ? '▲ 閉じる' : '▼ 詳細'}
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1 text-xs text-muted space-y-1 border-t border-border/50">
          <p>アラートID: {a.alert_id}</p>
          <p>記録者: {a.created_by ?? '—'}</p>
          <p>記録日時: {new Date(a.created_at).toLocaleString('ja-JP')}</p>
          {a.reading_id && <p>巡回記録ID: {a.reading_id}</p>}
          {a.photo_url && (
            <img src={a.photo_url} alt="撮影画像" className="mt-2 max-h-40 rounded-lg object-cover" />
          )}
        </div>
      )}
    </div>
  )
}

export default function AlertListPage() {
  const navigate = useNavigate()
  const [tab, setTab]           = useState('unresolved')
  const [alerts, setAlerts]     = useState([])
  const [storeMap, setStoreMap] = useState({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [resolving, setResolving] = useState(null)
  const [expanded, setExpanded]   = useState(null)
  const [loadKey, setLoadKey]     = useState(0)

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let q = supabase
        .from('booth_alerts')
        .select('*, alert_types(label, icon_emoji, color_hex)')

      if (tab === 'unresolved') {
        q = q.eq('resolved', false).order('created_at', { ascending: true })
      } else {
        const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
        q = q.eq('resolved', true).gte('resolved_at', weekAgo).order('resolved_at', { ascending: false })
      }

      const { data, error: e } = await q
      if (e) throw e
      setAlerts(data ?? [])
    } catch (e) {
      console.error('[ERR-ALERT-003] fetch failed', e)
      setError('アラートの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [tab, loadKey])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  useEffect(() => {
    supabase.from('stores').select('store_code,store_name').then(({ data }) => {
      if (!data) return
      const m = {}
      data.forEach(s => { m[s.store_code] = s.store_name })
      setStoreMap(m)
    })
  }, [])

  const unresolvedCount = tab === 'unresolved' ? alerts.length : null

  return (
    // scroll fix: min-h-screen → h-dvh + 内部 min-h-0 で sticky header + 縦スクロール確立
    <div className="h-dvh bg-bg text-text flex flex-col">
      <PageHeader
        module="clawsupport"
        title="未対応TODO"
        variant="compact"
        onBack={() => navigate('/clawsupport')}
      />

      {/* タブ */}
      <div className="flex border-b border-border px-4">
        <button
          type="button"
          onClick={() => { setTab('unresolved'); setExpanded(null) }}
          className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${tab === 'unresolved' ? 'border-blue-500 text-blue-400' : 'border-transparent text-muted'}`}
        >
          未対応{unresolvedCount != null && unresolvedCount > 0 ? ` (${unresolvedCount})` : ''}
        </button>
        <button
          type="button"
          onClick={() => { setTab('history'); setExpanded(null) }}
          className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${tab === 'history' ? 'border-blue-500 text-blue-400' : 'border-transparent text-muted'}`}
        >
          履歴 (1週間)
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {loading && <p className="text-center text-muted py-8">読み込み中…</p>}
        {error && <p className="text-center text-red-400 py-8">{error}</p>}

        {!loading && !error && alerts.length === 0 && (
          <p className="text-center text-muted py-12">
            {tab === 'unresolved' ? '未対応のアラートはありません 🎉' : '過去1週間の履歴はありません'}
          </p>
        )}

        {!loading && !error && alerts.map(a => (
          <div key={a.alert_id} className={tab === 'history' ? 'opacity-60' : ''}>
            {tab === 'history' ? (
              <div className="border border-border rounded-2xl px-4 py-3 mb-3 bg-surface">
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0">{a.alert_types?.icon_emoji ?? '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold line-through text-muted">{a.alert_types?.label ?? a.type_code}</p>
                    <p className="text-xs text-muted mt-0.5">{storeMap[a.store_code] ?? a.store_code} / {a.booth_code}</p>
                    {a.note && <p className="text-xs text-muted/70 mt-0.5 line-through">{a.note}</p>}
                    <p className="text-xs text-muted/50 mt-1">対応: {a.resolved_at ? new Date(a.resolved_at).toLocaleDateString('ja-JP') : '—'}</p>
                    {a.resolved_note && <p className="text-xs text-muted/60 mt-0.5">対応メモ: {a.resolved_note}</p>}
                  </div>
                </div>
              </div>
            ) : (
              <AlertCard
                a={a}
                storeMap={storeMap}
                onResolveClick={setResolving}
                expanded={expanded === a.alert_id}
                onToggle={() => setExpanded(prev => prev === a.alert_id ? null : a.alert_id)}
              />
            )}
          </div>
        ))}
      </div>

      {resolving && (
        <ResolveDialog
          alert={resolving}
          onDone={() => { setResolving(null); setLoadKey(k => k + 1) }}
          onCancel={() => setResolving(null)}
        />
      )}
    </div>
  )
}
