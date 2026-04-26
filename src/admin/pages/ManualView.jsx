import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { getPublishedManual } from '../../services/manuals'

const SECTION_ORDER = ['error_codes', 'troubleshooting', 'settings']
const SECTION_LABELS = {
  error_codes: '⚠️ エラーコード',
  troubleshooting: '🔧 トラブル',
  settings: '⚙️ 設定',
}

export default function ManualView() {
  const { modelId } = useParams()
  const navigate = useNavigate()
  const [manual, setManual] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await getPublishedManual(modelId)
        if (!data) {
          setError('マニュアルがありません')
        } else {
          setManual(data)
          // Set initial tab to first available section in defined order
          const available = SECTION_ORDER.filter(type =>
            (data.manual_sections || []).some(s => s.section_type === type)
          )
          setActiveTab(available[0] ?? null)
        }
      } catch (e) {
        setError('読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [modelId])

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-muted text-sm">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error || !manual) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-surface gap-4">
        <p className="text-muted text-base">{error || 'マニュアルがありません'}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-accent text-sm underline underline-offset-2"
        >
          ← 戻る
        </button>
      </div>
    )
  }

  const sections = manual.manual_sections || []
  const availableTabs = SECTION_ORDER.filter(type =>
    sections.some(s => s.section_type === type)
  )
  const activeSection = sections.find(s => s.section_type === activeTab)
  const content = activeSection?.content || ''

  const updatedLabel = manual.updated_at
    ? new Date(manual.updated_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })
    : null

  return (
    <div className="h-dvh flex flex-col bg-surface text-text max-w-lg md:max-w-3xl mx-auto">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 pt-5 pb-3 border-b border-border">
        <button
          onClick={() => navigate(-1)}
          className="text-2xl text-muted hover:text-accent transition-colors leading-none"
          aria-label="戻る"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold truncate">
            {manual.model_name || 'マニュアル'}
          </h1>
          {updatedLabel && (
            <p className="text-xs text-muted">{updatedLabel}</p>
          )}
        </div>
      </div>

      {/* Tab bar */}
      {availableTabs.length > 0 && (
        <div className="shrink-0 flex border-b border-border bg-surface">
          {availableTabs.map(type => (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors relative
                ${activeTab === type
                  ? 'text-accent after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent'
                  : 'text-muted hover:text-text'
                }`}
            >
              {SECTION_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {content ? (
          <div className="px-4 py-3 text-base leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_p]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-3 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-surface2 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:p-2 [&_strong]:font-bold [&_code]:bg-surface2 [&_code]:px-1.5 [&_code]:rounded [&_code]:text-accent3 [&_pre]:bg-surface2 [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_img]:max-w-full [&_img]:rounded-xl">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted text-sm">このセクションにはコンテンツがありません</p>
          </div>
        )}
      </div>
    </div>
  )
}
