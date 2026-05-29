import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { uploadDevAsset } from '../../services/devAssets'

// J-DEV-ASSET-HANDOFF-01: ファイル受け渡し upload 画面 (admin/manager only, route guard 済み)
//   multi-file drop + 共通メタ (label / file_type / purpose) → 1 file ずつ raw bytes upload
//   forbidden: byte transform 一切なし、raw File をそのまま Storage に put

const FILE_TYPES = ['png', 'jpg', 'pdf', 'xlsx', 'csv', 'json', 'zip', 'other']

export default function AdminDevAssetsUploadPage() {
  const navigate = useNavigate()
  const { staffName } = useAuth()
  const [files, setFiles] = useState([])
  const [label, setLabel] = useState('')
  const [fileType, setFileType] = useState('')
  const [purpose, setPurpose] = useState('')
  const [results, setResults] = useState([]) // [{ name, ok, error, sha256 }]
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  function addFiles(fileList) {
    if (!fileList) return
    const arr = Array.from(fileList)
    setFiles(prev => [...prev, ...arr])
  }

  function removeAt(i) {
    setFiles(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit() {
    if (files.length === 0 || !label.trim()) return
    setBusy(true)
    const out = []
    for (const f of files) {
      const { data, error } = await uploadDevAsset({
        file: f,
        label: label.trim(),
        fileType: fileType || null,
        purpose: purpose.trim() || null,
        staffName: staffName || null,
      })
      out.push({ name: f.name, ok: !error, error: error?.message ?? null, sha256: data?.sha256 ?? null })
    }
    setResults(out)
    setFiles([])
    setBusy(false)
  }

  const canSubmit = !busy && files.length > 0 && label.trim().length > 0

  return (
    <div data-testid="admin-dev-assets-upload" className="flex flex-col bg-bg text-text" style={{ height: '100dvh' }}>
      <div className="flex-shrink-0 p-3 border-b border-border flex items-center gap-2">
        <button onClick={() => navigate('/admin/dev-assets')} className="text-sm text-muted min-h-[44px] flex items-center gap-1">← 一覧</button>
        <h1 className="text-base font-bold flex-1">ファイル受け渡し / アップロード</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        <div className="space-y-2">
          <label className="block">
            <span className="text-sm text-muted">ラベル（必須）</span>
            <input
              data-testid="dev-asset-label" type="text" value={label} onChange={e => setLabel(e.target.value)}
              className="mt-1 w-full bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text"
              placeholder="例: naceland 角印 v3"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">file_type</span>
            <select
              data-testid="dev-asset-file-type" value={fileType} onChange={e => setFileType(e.target.value)}
              className="mt-1 w-full bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text"
            >
              <option value="">(未指定)</option>
              {FILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-muted">purpose（用途メモ）</span>
            <textarea
              data-testid="dev-asset-purpose" value={purpose} onChange={e => setPurpose(e.target.value)} rows={2}
              className="mt-1 w-full bg-bg border border-border rounded-lg px-3 py-2 text-base text-text"
              placeholder="例: J-COLLECTION-13 角印再供給、透過 PNG"
            />
          </label>
        </div>

        <div
          data-testid="dev-asset-dropzone"
          onDragOver={e => { e.preventDefault() }}
          onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer?.files) }}
          className="rounded-lg border-2 border-dashed border-border p-4 text-center text-muted"
        >
          ファイルをドロップ または{' '}
          <button
            data-testid="dev-asset-file-button"
            onClick={() => inputRef.current?.click()}
            className="underline text-blue-400"
          >ファイル選択</button>
          <input
            ref={inputRef}
            data-testid="dev-asset-file-input"
            type="file"
            multiple
            hidden
            onChange={e => { addFiles(e.target.files); e.target.value = '' }}
          />
          <p className="text-xs mt-1">複数選択可。バイト変換なしで保存します。</p>
        </div>

        {files.length > 0 && (
          <ul data-testid="dev-asset-staging-list" className="space-y-1">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 bg-surface rounded px-2 py-1">
                <span className="flex-1 truncate text-sm">{f.name}</span>
                <span className="text-xs text-muted">{f.size} B</span>
                <button onClick={() => removeAt(i)} className="text-xs text-red-400 px-2">×</button>
              </li>
            ))}
          </ul>
        )}

        {results.length > 0 && (
          <div data-testid="dev-asset-upload-results" className="space-y-1">
            <p className="text-sm text-muted">結果:</p>
            {results.map((r, i) => (
              <div key={i} className="text-xs bg-surface rounded px-2 py-1">
                <span className={r.ok ? 'text-green-400' : 'text-red-400'}>{r.ok ? '○' : '×'}</span>{' '}
                <span className="font-mono">{r.name}</span>{' '}
                {r.sha256 && <span className="text-muted">sha256={r.sha256.slice(0, 12)}…</span>}
                {!r.ok && r.error && <span className="text-red-400"> err={r.error}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-border p-3 flex gap-2">
        <button onClick={() => navigate('/admin/dev-assets')} className="flex-1 min-h-[44px] rounded-lg border border-border text-muted">キャンセル</button>
        <button
          data-testid="dev-asset-submit-button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 min-h-[44px] rounded-lg bg-blue-600 text-white font-bold disabled:opacity-50"
        >{busy ? '送信中…' : `アップロード (${files.length})`}</button>
      </div>
    </div>
  )
}
