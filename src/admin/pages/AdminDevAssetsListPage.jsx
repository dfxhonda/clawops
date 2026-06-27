import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listDevAssets, getDevAssetSignedUrl, deleteDevAsset } from '../../services/devAssets'
import { PageHeader } from '../../shared/ui/PageHeader'

// J-DEV-ASSET-HANDOFF-01: ファイル受け渡し 一覧画面 (admin/manager only, route guard 済み)
//   signed URL DL / sha256 copy / 削除 (確認ダイアログ、背景タップキャンセル)
//   forbidden: org_id filter なし (RLS で admin/manager 制御)、toISOString JST 禁止

const yenFmt = n => Number(n || 0).toLocaleString()
// 表示時刻は JST ローカル文字列で (toISOString 経由禁止 per spec)
function fmtJst(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' })
  } catch {
    return iso
  }
}

export default function AdminDevAssetsListPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null) // row | null
  const [copiedId, setCopiedId] = useState(null)

  async function load() {
    setLoading(true); setError(null)
    const { data, error: e } = await listDevAssets()
    if (e) setError(`ERR-DEV-ASSET-LIST: ${e.message}`)
    else setRows(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleDownload(row) {
    const { data, error: e } = await getDevAssetSignedUrl(row.storage_path, 60)
    if (e || !data?.signedUrl) {
      setError(`ERR-DEV-ASSET-SIGN: ${e?.message ?? 'no url'}`)
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleCopySha(row) {
    if (!row?.sha256) return
    try {
      await navigator.clipboard?.writeText(row.sha256)
      setCopiedId(row.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch (e) {
      setError(`ERR-DEV-ASSET-COPY: ${e.message}`)
    }
  }

  async function confirmDelete() {
    const row = pendingDelete
    setPendingDelete(null)
    if (!row) return
    const { error: e } = await deleteDevAsset({ id: row.id, storagePath: row.storage_path })
    if (e) { setError(`ERR-DEV-ASSET-DEL: ${e.message}`); return }
    setRows(prev => prev.filter(r => r.id !== row.id))
  }

  return (
    <div data-testid="admin-dev-assets-list" className="flex flex-col bg-bg text-text" style={{ height: '100dvh' }}>
      <PageHeader module="admin" title="ファイル受け渡し" hideHome={true}
        rightSlot={
          <button
            data-testid="dev-asset-upload-link"
            onClick={() => navigate('/admin/dev-assets/upload')}
            className="text-sm bg-blue-600 text-white rounded px-3 min-h-[40px] font-bold"
          >+ アップロード</button>
        } />

      {error && <p data-testid="dev-asset-error" className="text-red-400 text-sm px-3 py-1">{error}</p>}

      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {loading && <p className="text-center text-muted py-4">読込中…</p>}
        {!loading && rows.length === 0 && <p className="text-center text-muted py-4">資産がありません</p>}
        <ul className="space-y-2">
          {rows.map(r => (
            <li
              key={r.id}
              data-testid="dev-asset-row"
              className="bg-surface border border-border rounded-xl p-3"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold truncate">{r.label}</p>
                  <p className="text-xs text-muted truncate">
                    {r.original_filename ?? '(no name)'} ・ {r.file_type ?? '?'} ・ {yenFmt(r.byte_size)} B
                  </p>
                  {r.purpose && <p className="text-xs text-muted mt-1 line-clamp-2">{r.purpose}</p>}
                  <p className="text-[10px] text-muted mt-1 font-mono break-all">sha256: {r.sha256 || '(none)'}</p>
                  <p className="text-[10px] text-muted">
                    {fmtJst(r.created_at)} ・ {r.uploaded_by ?? '(unknown)'}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                <button
                  data-testid={`dev-asset-download-${r.id}`}
                  onClick={() => handleDownload(r)}
                  className="text-xs bg-blue-600 text-white rounded px-3 min-h-[36px] font-bold"
                >DL</button>
                <button
                  data-testid={`dev-asset-copysha-${r.id}`}
                  onClick={() => handleCopySha(r)}
                  className="text-xs bg-surface2 border border-border text-text rounded px-3 min-h-[36px]"
                  disabled={!r.sha256}
                >{copiedId === r.id ? 'コピー済' : 'sha256 コピー'}</button>
                <button
                  data-testid={`dev-asset-delete-${r.id}`}
                  onClick={() => setPendingDelete(r)}
                  className="ml-auto text-xs bg-red-600 text-white rounded px-3 min-h-[36px]"
                >削除</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 削除確認ダイアログ (背景タップ = キャンセル、ボタン: 削除 / キャンセル) */}
      {pendingDelete && (
        <div
          data-testid="dev-asset-delete-backdrop"
          onClick={() => setPendingDelete(null)}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
        >
          <div
            data-testid="dev-asset-delete-dialog"
            onClick={e => e.stopPropagation()}
            className="bg-bg border border-border rounded-xl p-4 w-full max-w-xs"
          >
            <p className="text-base">この資産を削除しますか？</p>
            <p className="text-xs text-muted mt-1 truncate">{pendingDelete.label}</p>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                data-testid="dev-asset-delete-cancel"
                onClick={() => setPendingDelete(null)}
                className="px-4 min-h-[44px] rounded-lg border border-border text-text text-sm"
              >キャンセル</button>
              <button
                data-testid="dev-asset-delete-confirm"
                onClick={confirmDelete}
                className="px-4 min-h-[44px] rounded-lg bg-red-600 text-white text-sm font-bold"
              >削除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
