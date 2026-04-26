import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import {
  getModels,
  getManualForModel,
  upsertManual,
  saveSection,
  uploadManualImage,
} from '../../services/manuals'
import LogoutButton from '../../components/LogoutButton'
import AdminNav from '../components/AdminNav'

const SECTION_TYPES = [
  { key: 'error_codes',     label: '⚠️ エラーコード', title: 'エラーコード一覧', sort_order: 0 },
  { key: 'troubleshooting', label: '🔧 トラブル対応', title: 'トラブル対応',      sort_order: 1 },
  { key: 'settings',        label: '⚙️ 設定方法',     title: '設定方法',          sort_order: 2 },
]

const INITIAL_SECTIONS = {
  error_codes:     { section_id: null, content: '', title: 'エラーコード一覧' },
  troubleshooting: { section_id: null, content: '', title: 'トラブル対応' },
  settings:        { section_id: null, content: '', title: '設定方法' },
}

export default function ManualEditor() {
  const navigate = useNavigate()

  // ─── モデル一覧 ───────────────────────────────────
  const [models, setModels] = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)

  // ─── 選択中モデル ─────────────────────────────────
  const [selectedModel, setSelectedModel] = useState(null)
  const [manual, setManual] = useState(null)

  // ─── ヘッダーフィールド ───────────────────────────
  const [version, setVersion] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [headerNotes, setHeaderNotes] = useState('')

  // ─── タブ / エディタ ──────────────────────────────
  const [activeTab, setActiveTab] = useState('error_codes')
  const [editMode, setEditMode] = useState(true)
  const [sections, setSections] = useState(INITIAL_SECTIONS)

  // ─── 保存状態 ─────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ─── 画像アップロード ─────────────────────────────
  const [imgUploading, setImgUploading] = useState(false)
  const [imgError, setImgError] = useState('')
  const fileInputRef = useRef(null)

  // ─── モデル一覧のロード ───────────────────────────
  useEffect(() => {
    setModelsLoading(true)
    getModels()
      .then(data => setModels(data))
      .finally(() => setModelsLoading(false))
  }, [])

  // ─── モデル選択時のマニュアルロード ──────────────
  const loadManual = async (model) => {
    const data = await getManualForModel(model.model_id)
    setManual(data)
    if (data) {
      setVersion(data.version || '')
      setIsPublished(!!data.is_published)
      setHeaderNotes(data.notes || '')
      const loaded = { ...INITIAL_SECTIONS }
      for (const st of SECTION_TYPES) {
        const found = (data.manual_sections || []).find(s => s.section_type === st.key)
        if (found) {
          loaded[st.key] = {
            section_id: found.section_id,
            content: found.content || '',
            title: found.title || st.title,
          }
        }
      }
      setSections(loaded)
    } else {
      setVersion('')
      setIsPublished(false)
      setHeaderNotes('')
      setSections(INITIAL_SECTIONS)
    }
  }

  const handleSelectModel = (model) => {
    setSelectedModel(model)
    setActiveTab('error_codes')
    setEditMode(true)
    setSaveError('')
    setSaveSuccess(false)
    setImgError('')
    loadManual(model)
  }

  const handleBackToList = () => {
    setSelectedModel(null)
    setManual(null)
    setSaveError('')
    setSaveSuccess(false)
    setImgError('')
  }

  // ─── セクション内容の更新 ─────────────────────────
  const setSectionContent = (key, content) => {
    setSections(prev => ({ ...prev, [key]: { ...prev[key], content } }))
  }

  // ─── 保存 ─────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      const savedManual = await upsertManual(selectedModel.model_id, {
        version,
        is_published: isPublished,
        notes: headerNotes,
      })
      const manualId = savedManual.manual_id
      for (const st of SECTION_TYPES) {
        const sec = sections[st.key]
        await saveSection(manualId, {
          section_id: sec.section_id || null,
          section_type: st.key,
          title: sec.title || st.title,
          content: sec.content,
          sort_order: st.sort_order,
        })
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
      // リロード
      await loadManual(selectedModel)
    } catch (err) {
      setSaveError(err.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // ─── 画像アップロード ─────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImgUploading(true)
    setImgError('')
    try {
      const url = await uploadManualImage(selectedModel.model_id, file)
      setSectionContent(activeTab, (sections[activeTab].content || '') + `\n![画像](${url})\n`)
    } catch (err) {
      setImgError(err.message || '画像アップロードに失敗しました')
    } finally {
      setImgUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ════════════════════════════════════════════════
  // Mode 1: モデル一覧
  // ════════════════════════════════════════════════
  if (selectedModel === null) {
    return (
      <div className="h-full flex flex-col">
        <div className="shrink-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-3 print:hidden">
          <button onClick={() => navigate('/admin/menu')} className="text-2xl text-muted">←</button>
          <div className="flex-1">
            <h2 className="text-base font-bold">マニュアル管理</h2>
            <p className="text-[11px] text-muted">機種マニュアルの作成・編集</p>
          </div>
          <LogoutButton to="/admin/menu" />
        </div>
        <AdminNav />

        <div className="flex-1 overflow-y-auto pb-16">
        {modelsLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
            <p className="text-muted text-sm">読み込み中...</p>
          </div>
        )}

        {!modelsLoading && models.length === 0 && (
          <div className="text-center py-16 text-muted text-sm">
            機種マスタが登録されていません
          </div>
        )}

        {!modelsLoading && models.map(model => (
          <div key={model.model_id} className="bg-surface border border-border rounded-xl p-3.5 mx-4 mt-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-text text-sm">{model.model_name}</div>
                {model.manufacturer && (
                  <div className="text-xs text-muted mt-0.5">{model.manufacturer}</div>
                )}
              </div>
              <button
                onClick={() => handleSelectModel(model)}
                className="shrink-0 text-sm text-blue-400 border border-border rounded-lg px-3 py-1.5 hover:bg-surface2 transition-colors"
              >
                マニュアル編集 →
              </button>
            </div>
          </div>
        ))}
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════
  // Mode 2: 編集画面
  // ════════════════════════════════════════════════
  const activeSection = SECTION_TYPES.find(s => s.key === activeTab)

  return (
    <div className="h-full flex flex-col">

      {/* Sticky header */}
      <div className="shrink-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-3 print:hidden">
        <button onClick={handleBackToList} className="text-2xl text-muted">←</button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold truncate">{selectedModel.model_name}</h2>
          <p className="text-[11px] text-muted">マニュアル編集</p>
        </div>
        <LogoutButton to="/admin/menu" />
      </div>
      <AdminNav />

      <div className="flex-1 overflow-y-auto pb-16">
      <div className="md:max-w-3xl md:mx-auto">
      {/* ── ヘッダー情報カード ── */}
      <div className="bg-surface border border-border rounded-xl p-4 mx-4 mt-4 space-y-3">
        <h3 className="text-sm font-bold text-accent">基本情報</h3>

        {/* バージョン */}
        <div>
          <label className="block text-xs text-muted mb-1">バージョン</label>
          <input
            type="text"
            value={version}
            onChange={e => setVersion(e.target.value)}
            placeholder="v1.0"
            className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {/* 備考 */}
        <div>
          <label className="block text-xs text-muted mb-1">備考</label>
          <input
            type="text"
            value={headerNotes}
            onChange={e => setHeaderNotes(e.target.value)}
            placeholder="備考"
            className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {/* 公開トグル */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-text">公開する（現場に表示）</label>
          <button
            type="button"
            onClick={() => setIsPublished(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isPublished ? 'bg-green-500' : 'bg-surface2 border border-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                isPublished ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* ── タブバー ── */}
      <div className="flex mx-4 mt-4 bg-surface border border-border rounded-xl overflow-hidden">
        {SECTION_TYPES.map((st, i) => (
          <button
            key={st.key}
            onClick={() => { setActiveTab(st.key); setEditMode(true) }}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              i > 0 ? 'border-l border-border' : ''
            } ${
              activeTab === st.key
                ? 'bg-surface2 text-accent'
                : 'text-muted hover:text-text hover:bg-surface2'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* ── エディタカード ── */}
      <div className="bg-surface border border-border rounded-xl mx-4 mt-2 overflow-hidden">

        {/* 編集 / プレビュー切替 */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setEditMode(true)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
              editMode ? 'bg-surface2 text-accent' : 'text-muted hover:text-text'
            }`}
          >
            編集
          </button>
          <button
            onClick={() => setEditMode(false)}
            className={`flex-1 py-2 text-xs font-semibold border-l border-border transition-colors ${
              !editMode ? 'bg-surface2 text-accent' : 'text-muted hover:text-text'
            }`}
          >
            プレビュー
          </button>
        </div>

        {/* テキストエリア or プレビュー */}
        {editMode ? (
          <textarea
            value={sections[activeTab].content}
            onChange={e => setSectionContent(activeTab, e.target.value)}
            placeholder={`${activeSection?.title} の内容を Markdown で入力...`}
            className="w-full min-h-[300px] bg-surface2 text-text text-sm p-4 outline-none resize-y font-mono leading-relaxed placeholder:text-muted"
          />
        ) : (
          <div className="p-4 bg-surface2 rounded-b-xl text-text text-sm leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-1.5 [&_h3]:font-semibold [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-0.5 [&_p]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:p-2 [&_strong]:font-bold [&_code]:bg-surface [&_code]:px-1 [&_code]:rounded [&_pre]:bg-surface [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted min-h-[200px]">
            {sections[activeTab].content ? (
              <ReactMarkdown>{sections[activeTab].content}</ReactMarkdown>
            ) : (
              <p className="text-muted italic">内容がありません</p>
            )}
          </div>
        )}

        {/* 画像アップロード (編集モードのみ) */}
        {editMode && (
          <div className="px-4 pb-4 pt-2 border-t border-border">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imgUploading}
              className="text-xs text-muted border border-border rounded-lg px-3 py-1.5 hover:bg-surface2 disabled:opacity-50 transition-colors"
            >
              {imgUploading ? 'アップロード中...' : '📷 画像を追加'}
            </button>
            {imgError && <p className="mt-1 text-xs text-accent2">{imgError}</p>}
          </div>
        )}
      </div>

      {/* ── 保存エラー ── */}
      {saveError && (
        <div className="mx-4 mt-3 bg-accent2/10 border border-accent2/30 rounded-xl px-4 py-3">
          <p className="text-accent2 text-sm">{saveError}</p>
        </div>
      )}

      {/* ── 保存成功フラッシュ ── */}
      {saveSuccess && (
        <div className="mx-4 mt-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
          <p className="text-green-400 text-sm">保存しました ✅</p>
        </div>
      )}

      {/* ── 保存ボタン ── */}
      <div className="mx-4 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
      </div>
      </div>
    </div>
  )
}
