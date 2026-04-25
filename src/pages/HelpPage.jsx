import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGlossaryStore } from '../stores/glossaryStore'

export default function HelpPage() {
  const navigate = useNavigate()
  const { terms, loading } = useGlossaryStore()
  const [search, setSearch] = useState('')

  const termList = useMemo(() => Object.values(terms), [terms])

  const filtered = useMemo(() => {
    if (!search.trim()) return termList
    const q = search.trim().toLowerCase()
    return termList.filter(t =>
      t.term_id.toLowerCase().includes(q) ||
      (t.label_short || '').toLowerCase().includes(q) ||
      (t.label_full || '').toLowerCase().includes(q) ||
      (t.bubble_text || '').toLowerCase().includes(q) ||
      (t.detail_text || '').toLowerCase().includes(q)
    )
  }, [termList, search])

  // カテゴリ別グルーピング・sort_order順
  const grouped = useMemo(() => {
    const cats = {}
    const sorted = [...filtered].sort((a, b) => {
      if (a.category < b.category) return -1
      if (a.category > b.category) return 1
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })
    for (const t of sorted) {
      const cat = t.category || 'その他'
      if (!cats[cat]) cats[cat] = []
      cats[cat].push(t)
    }
    return cats
  }, [filtered])

  return (
    <div className="min-h-screen bg-bg text-foreground">
      {/* ヘッダー */}
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="text-muted hover:text-foreground text-lg leading-none px-1"
        >
          ‹
        </button>
        <div className="text-base font-bold flex-1">ヘルプ</div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">

        {/* 検索ボックス */}
        <input
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
          placeholder="用語を検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* チュートリアルボタン */}
        <button
          onClick={() => alert('準備中')}
          className="w-full py-3 rounded-xl border-2 border-blue-600 text-blue-400 text-sm font-semibold hover:bg-blue-950/30"
        >
          チュートリアルを見る
        </button>

        {/* 操作ヒントバナー */}
        <div className="bg-blue-950/40 border border-blue-800/50 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <div className="text-sm font-semibold text-blue-300">操作ヒント</div>
            <div className="text-xs text-blue-200/70 mt-0.5">
              画面内のラベル（IN・OUT・残 など）を長押しすると意味が表示されます
            </div>
          </div>
        </div>

        {/* 用語集 */}
        <div>
          <div className="text-xs text-muted font-bold uppercase tracking-wider mb-3">用語集</div>

          {loading ? (
            <div className="text-muted text-sm text-center py-8">読み込み中...</div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-muted text-sm text-center py-8">
              {search ? '該当する用語がありません' : '用語が登録されていません'}
            </div>
          ) : (
            Object.entries(grouped).map(([cat, catTerms]) => (
              <div key={cat} className="mb-6">
                <div className="text-xs text-muted font-semibold uppercase tracking-wider mb-2 px-1">
                  {cat}
                </div>
                <div className="space-y-2">
                  {catTerms.map(t => (
                    <div key={t.term_id}
                      className="bg-surface border border-border rounded-xl px-4 py-3">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-bold text-sm"
                          style={t.display_color ? { color: t.display_color } : {}}>
                          {t.label_short}
                        </span>
                        {t.label_full && (
                          <span className="text-xs text-muted">{t.label_full}</span>
                        )}
                      </div>
                      {t.bubble_text && (
                        <div className="text-xs text-foreground/80 leading-relaxed">
                          {t.bubble_text}
                        </div>
                      )}
                      {t.detail_text && (
                        <div className="text-xs text-muted mt-1 leading-relaxed">
                          {t.detail_text}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* よくある質問・店舗管理者ボタン */}
        <div className="space-y-2 pb-8">
          <button
            onClick={() => alert('準備中')}
            className="w-full py-3 rounded-xl bg-surface border border-border text-sm text-left px-4 flex items-center gap-3"
          >
            <span className="text-xl">❓</span>
            <span>よくある質問</span>
            <span className="ml-auto text-muted/50">›</span>
          </button>
          <button
            onClick={() => alert('準備中')}
            className="w-full py-3 rounded-xl bg-surface border border-border text-sm text-left px-4 flex items-center gap-3"
          >
            <span className="text-xl">📞</span>
            <span>店舗管理者を呼ぶ</span>
            <span className="ml-auto text-muted/50">›</span>
          </button>
        </div>

      </div>
    </div>
  )
}
