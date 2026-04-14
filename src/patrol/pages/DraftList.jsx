import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { saveReading } from '../../services/readings'
import LogoutButton from '../../components/LogoutButton'
import ErrorDisplay from '../../components/ErrorDisplay'

const DRAFT_KEY = 'clawops_drafts'
export const REPORT_KEY = 'clawops_last_report'
const REPORT_TTL_MS = 24 * 60 * 60 * 1000 // 24時間

export function getDrafts() {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)||'[]') } catch { return [] }
}
export function saveDraft(draft) {
  const drafts = getDrafts()
  const idx = drafts.findIndex(d => d.booth_id === draft.booth_id)
  if (idx >= 0) drafts[idx] = { ...drafts[idx], ...draft, updated_at: new Date().toISOString() }
  else drafts.push({ ...draft, updated_at: new Date().toISOString() })
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
}
export function clearDrafts() { sessionStorage.removeItem(DRAFT_KEY) }
export function getDraftCount() { return getDrafts().length }

export default function DraftList() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [drafts, setDrafts] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)

  useEffect(() => { setDrafts(getDrafts()) }, [])

  function handleEdit(draft) { setEditing({...draft}) }

  function handleEditSave() {
    saveDraft(editing)
    setDrafts(getDrafts())
    setEditing(null)
  }

  function handleDelete(booth_id) {
    const updated = getDrafts().filter(d => d.booth_id !== booth_id)
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(updated))
    setDrafts(updated)
  }

  async function handleSaveAll() {
    if (!drafts.length) return
    setSaving(true)
    setError(null)
    const savedSnapshot = [...drafts]
    const savedBoothIds = []
    try {
      for (const d of drafts) {
        await saveReading(d)
        savedBoothIds.push(d.booth_id)
      }
      clearDrafts()
      const reportPayload = {
        storeName: state?.storeName,
        storeId: state?.storeId,
        savedDrafts: savedSnapshot,
        savedAt: Date.now(),
      }
      sessionStorage.setItem(REPORT_KEY, JSON.stringify(reportPayload))
      navigate('/complete', { state: reportPayload })
    } catch(e) {
      // Remove already-saved drafts from sessionStorage
      const remaining = getDrafts().filter(d => !savedBoothIds.includes(d.booth_id))
      sessionStorage.setItem('clawops_drafts', JSON.stringify(remaining))
      setDrafts(remaining)
      setError(e)
    }
    setSaving(false)
  }

  return (
    <div className="h-screen flex flex-col max-w-lg mx-auto">
      {/* ヘッダー */}
      <div className="shrink-0 px-4 pt-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/')} className="text-2xl text-muted hover:text-accent transition-colors">←</button>
          <div className="flex-1">
            <h2 className="text-lg font-bold">下書き一覧</h2>
            <p className="text-xs text-muted">{drafts.length}件の未保存データ</p>
          </div>
          <LogoutButton />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-10">

      {drafts.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl text-center text-muted p-8">
          <div className="text-3xl mb-2">📝</div>
          <p>下書きデータがありません</p>
          <p className="text-xs mt-1">巡回入力モードで入力すると<br/>ここに下書きが溜まります</p>
        </div>
      ) : (
        <>
          <button onClick={handleSaveAll} disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors mb-4">
            {saving ? '保存中...' : `✅ ${drafts.length}件を一括保存`}
          </button>
          <ErrorDisplay error={error} onRetry={handleSaveAll} onDismiss={() => setError(null)} />

          {/* 編集フォーム */}
          {editing && (
            <div className="bg-surface border-2 border-blue-500 rounded-xl p-4 mb-3">
              <div className="font-bold mb-3">{editing.full_booth_code} を編集</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <div className="text-xs text-muted mb-1">INメーター</div>
                  <input className="w-full p-2.5 text-center rounded-lg border-2 border-border bg-surface2 text-text text-lg outline-none focus:border-accent" type="number" inputMode="numeric" value={editing.in_meter||''}
                    onChange={e => setEditing({...editing,in_meter:e.target.value})} />
                </div>
                <div>
                  <div className="text-xs text-muted mb-1">OUTメーター</div>
                  <input className="w-full p-2.5 text-center rounded-lg border-2 border-border bg-surface2 text-text text-lg outline-none focus:border-accent" type="number" inputMode="numeric" value={editing.out_meter||''}
                    onChange={e => setEditing({...editing,out_meter:e.target.value})} />
                </div>
                <div>
                  <div className="text-xs text-muted mb-1">景品補充数</div>
                  <input className="w-full p-2.5 text-center rounded-lg border-2 border-border bg-surface2 text-text text-lg outline-none focus:border-accent" type="number" inputMode="numeric" value={editing.prize_restock_count||''}
                    onChange={e => setEditing({...editing,prize_restock_count:e.target.value})} />
                </div>
                <div>
                  <div className="text-xs text-muted mb-1">景品投入残</div>
                  <input className="w-full p-2.5 text-center rounded-lg border-2 border-border bg-surface2 text-text text-lg outline-none focus:border-accent" type="number" inputMode="numeric" value={editing.prize_stock_count||''}
                    onChange={e => setEditing({...editing,prize_stock_count:e.target.value})} />
                </div>
              </div>
              <div className="mb-3">
                <div className="text-xs text-muted mb-1">景品名</div>
                <input className="w-full p-2.5 text-left rounded-lg border-2 border-border bg-surface2 text-text outline-none focus:border-accent" type="text"
                  value={editing.prize_name||''}
                  onChange={e => setEditing({...editing,prize_name:e.target.value})} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleEditSave} className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-lg">保存</button>
                <button onClick={() => setEditing(null)} className="flex-1 bg-surface2 border border-border text-text py-2.5 rounded-lg">キャンセル</button>
              </div>
            </div>
          )}

          {/* 下書きリスト */}
          <div className="space-y-2">
            {drafts.map(d => (
              <div key={d.booth_id} className="bg-surface border border-border rounded-xl p-3.5">
                <div className="flex justify-between items-start">
                  <div className="flex-1 cursor-pointer" onClick={() => handleEdit(d)}>
                    <div className="font-bold text-base">{d.full_booth_code}</div>
                    <div className="text-sm mt-1">
                      IN: <strong>{Number(String(d.in_meter).replace(/,/g,'')).toLocaleString()}</strong>
                      {d.out_meter ? `　OUT: ${Number(String(d.out_meter).replace(/,/g,'')).toLocaleString()}` : ''}
                    </div>
                    {d.prize_name && <div className="text-xs text-muted mt-0.5">景品: {d.prize_name}</div>}
                    <div className="text-[11px] text-muted mt-0.5">{d.updated_at?.slice(0,16).replace('T',' ')}</div>
                  </div>
                  <div className="flex gap-2 items-center pl-2">
                    <button onClick={() => handleEdit(d)} className="text-lg">✏️</button>
                    <button onClick={() => handleDelete(d.booth_id)} className="text-lg text-accent2">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => { clearDrafts(); setDrafts([]) }}
            className="w-full mt-3 bg-surface2 border border-border text-accent2 font-medium py-2.5 rounded-xl">
            🗑️ 全下書きを削除
          </button>
        </>
      )}
      </div>{/* スクロール領域終了 */}
    </div>
  )
}
