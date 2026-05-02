import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'
import { useAuth } from '../../hooks/useAuth'
import LogoutButton from '../../components/LogoutButton'

const EMPTY_FORM = {
  term_id: '',
  category: '',
  label_short: '',
  label_full: '',
  bubble_text: '',
  detail_text: '',
  related_terms: '',
  display_color: '',
  screen_locations: '',
  sort_order: 0,
  is_active: true,
}

function formToRow(f, staffId) {
  return {
    organization_id: DFX_ORG_ID,
    term_id: f.term_id.trim(),
    category: f.category.trim(),
    label_short: f.label_short.trim(),
    label_full: f.label_full.trim(),
    bubble_text: f.bubble_text.trim(),
    detail_text: f.detail_text.trim(),
    related_terms: f.related_terms
      ? f.related_terms.split(',').map(s => s.trim()).filter(Boolean)
      : [],
    display_color: f.display_color.trim(),
    screen_locations: f.screen_locations
      ? f.screen_locations.split(',').map(s => s.trim()).filter(Boolean)
      : [],
    sort_order: parseInt(f.sort_order) || 0,
    is_active: f.is_active,
    updated_at: new Date().toISOString(),
    updated_by: staffId || 'admin',
  }
}

export default function AdminGlossary() {
  const navigate = useNavigate()
  const { staffId } = useAuth()

  const [terms, setTerms]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [catFilter, setCatFilter] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [editId, setEditId]       = useState(null)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState('')

  const [confirmDelete, setConfirmDelete] = useState(null)

  const loadTerms = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('glossary_terms')
      .select('*')
      .eq('organization_id', DFX_ORG_ID)
      .order('category')
      .order('sort_order')
    if (!error) setTerms(data || [])
    setLoading(false)
  }

  useEffect(() => { loadTerms() }, [])

  const categories = useMemo(() => {
    const cats = [...new Set(terms.map(t => t.category).filter(Boolean))]
    cats.sort()
    return cats
  }, [terms])

  const filtered = useMemo(() => {
    let list = terms
    if (catFilter) list = list.filter(t => t.category === catFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(t =>
        t.term_id.toLowerCase().includes(q) ||
        (t.label_short || '').toLowerCase().includes(q) ||
        (t.label_full || '').toLowerCase().includes(q) ||
        (t.bubble_text || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [terms, search, catFilter])

  const openNew = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setSaveError('')
    setShowModal(true)
  }

  const openEdit = (t) => {
    setEditId(t.term_id)
    setForm({
      term_id: t.term_id,
      category: t.category || '',
      label_short: t.label_short || '',
      label_full: t.label_full || '',
      bubble_text: t.bubble_text || '',
      detail_text: t.detail_text || '',
      related_terms: (t.related_terms || []).join(', '),
      display_color: t.display_color || '',
      screen_locations: (t.screen_locations || []).join(', '),
      sort_order: t.sort_order ?? 0,
      is_active: t.is_active ?? true,
    })
    setSaveError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaveError('')
    if (!form.term_id.trim()) { setSaveError('term_id は必須です'); return }
    setSaving(true)
    try {
      const row = formToRow(form, staffId)
      const { error } = await supabase
        .from('glossary_terms')
        .upsert(row, { onConflict: 'organization_id,term_id' })
      if (error) throw error
      setShowModal(false)
      await loadTerms()
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (term) => {
    setConfirmDelete(null)
    const { error } = await supabase
      .from('glossary_terms')
      .delete()
      .eq('organization_id', DFX_ORG_ID)
      .eq('term_id', term.term_id)
    if (!error) await loadTerms()
  }

  const fc = (field, value) => setForm(f => ({ ...f, [field]: value }))

  return (
    <div className="h-full flex flex-col bg-bg text-foreground">
      {/* ヘッダー */}
      <div className="shrink-0 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-2" style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#3b82f6' }}>
        <button onClick={() => navigate('/admin/menu')}
          className="text-muted hover:text-foreground text-lg leading-none px-1">‹</button>
        <div className="text-base font-bold flex-1">用語マスタ管理</div>
        <LogoutButton />
      </div>

      {/* 検索・フィルタ */}
      <div className="shrink-0 px-3 pt-3 pb-2 flex gap-2 flex-wrap border-b border-border/40">
        <input
          className="flex-1 min-w-0 bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
          placeholder="検索 (term_id / ラベル / 説明文)"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none"
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
        >
          <option value="">全カテゴリ</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={openNew}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          + 新規
        </button>
      </div>

      {/* リスト (スクロールエリア) */}
      <div className="flex-1 overflow-y-auto overscroll-contain pb-8">
        {loading ? (
          <div className="text-muted text-sm text-center py-12">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-muted text-sm text-center py-12">該当なし</div>
        ) : (
          filtered.map(t => (
            <div key={t.term_id} className="flex items-start gap-2 px-3 py-3 border-b border-border/50 hover:bg-surface/50">
              <div className="flex-1 min-w-0">
                {/* 上段: term_id / label_short / カテゴリバッジ / 有効フラグ */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-blue-400 shrink-0">{t.term_id}</span>
                  {t.label_short && (
                    <span className="text-sm font-bold text-amber-400 shrink-0">{t.label_short}</span>
                  )}
                  {t.category && (
                    <span className="text-xs px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded shrink-0">
                      {t.category}
                    </span>
                  )}
                  {!t.is_active && (
                    <span className="text-xs px-1.5 py-0.5 bg-red-900/40 text-red-400 rounded shrink-0">無効</span>
                  )}
                </div>
                {/* 中段: label_full */}
                {t.label_full && (
                  <div className="text-sm text-foreground mt-0.5 truncate">{t.label_full}</div>
                )}
                {/* 下段: bubble_text プレビュー */}
                {t.bubble_text && (
                  <div className="text-xs text-muted mt-0.5 line-clamp-2">{t.bubble_text}</div>
                )}
              </div>
              {/* ボタン */}
              <div className="flex gap-1 shrink-0 pt-0.5">
                <button
                  onClick={() => openEdit(t)}
                  className="text-xs bg-surface border border-border px-2.5 py-1.5 rounded hover:border-blue-500 active:bg-surface2"
                  aria-label="編集"
                >✏️</button>
                <button
                  onClick={() => setConfirmDelete(t)}
                  className="text-xs bg-surface border border-red-900/50 px-2.5 py-1.5 rounded text-red-400 hover:border-red-500 active:bg-red-950/30"
                  aria-label="削除"
                >🗑</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 編集モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-bg border border-border rounded-2xl w-full max-w-lg my-4">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="font-bold text-base">{editId ? '用語を編集' : '新規用語'}</div>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-foreground text-2xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-3">
              <Field label="term_id *">
                <input className={INPUT_CLS} value={form.term_id}
                  onChange={e => fc('term_id', e.target.value)}
                  readOnly={!!editId}
                  placeholder="例: in" />
              </Field>
              <Field label="カテゴリ">
                <input className={INPUT_CLS} value={form.category}
                  onChange={e => fc('category', e.target.value)}
                  placeholder="例: meter" />
              </Field>
              <div className="flex gap-2">
                <Field label="label_short">
                  <input className={INPUT_CLS} value={form.label_short}
                    onChange={e => fc('label_short', e.target.value)}
                    placeholder="例: IN" />
                </Field>
                <Field label="label_full">
                  <input className={INPUT_CLS} value={form.label_full}
                    onChange={e => fc('label_full', e.target.value)}
                    placeholder="例: インプット" />
                </Field>
              </div>
              <Field label="bubble_text (長押し吹き出し)">
                <textarea className={INPUT_CLS + ' min-h-[72px] resize-y'} value={form.bubble_text}
                  onChange={e => fc('bubble_text', e.target.value)}
                  placeholder="長押し時に表示される説明文" />
              </Field>

              {/* プレビュー */}
              <div className="rounded-xl border border-border bg-surface p-3">
                <div className="text-xs text-muted mb-2 font-medium">吹き出しプレビュー</div>
                <div style={{
                  background: '#0f172a',
                  border: '2px solid #06b6d4',
                  borderRadius: 8,
                  padding: '8px 12px',
                  minHeight: 48,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#06b6d4', marginBottom: 4 }}>
                    {[form.label_short, form.label_full].filter(Boolean).join(' — ') || '(ラベル未入力)'}
                  </div>
                  {form.bubble_text && (
                    <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {form.bubble_text}
                    </div>
                  )}
                </div>
              </div>

              <Field label="detail_text">
                <textarea className={INPUT_CLS + ' min-h-[56px] resize-y'} value={form.detail_text}
                  onChange={e => fc('detail_text', e.target.value)} />
              </Field>
              <Field label="related_terms (カンマ区切り)">
                <input className={INPUT_CLS} value={form.related_terms}
                  onChange={e => fc('related_terms', e.target.value)}
                  placeholder="例: out, residual" />
              </Field>
              <Field label="display_color">
                <input className={INPUT_CLS} value={form.display_color}
                  onChange={e => fc('display_color', e.target.value)}
                  placeholder="例: #06b6d4" />
              </Field>
              <Field label="screen_locations (カンマ区切り)">
                <input className={INPUT_CLS} value={form.screen_locations}
                  onChange={e => fc('screen_locations', e.target.value)}
                  placeholder="例: patrol, booth" />
              </Field>
              <div className="flex gap-3 items-center">
                <Field label="sort_order">
                  <input className={INPUT_CLS + ' w-24'} type="number" value={form.sort_order}
                    onChange={e => fc('sort_order', e.target.value)} />
                </Field>
                <label className="flex items-center gap-2 text-sm cursor-pointer mt-4">
                  <input type="checkbox" checked={form.is_active}
                    onChange={e => fc('is_active', e.target.checked)} />
                  有効
                </label>
              </div>

              {saveError && (
                <div className="text-red-400 text-sm bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
                  {saveError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm">キャンセル</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-bg border border-border rounded-2xl p-6 max-w-sm w-full">
            <div className="font-bold text-base mb-2">用語を削除しますか？</div>
            <div className="text-sm text-muted mb-4">
              <span className="text-foreground font-mono">{confirmDelete.term_id}</span>（{confirmDelete.label_short}）
              を完全に削除します。この操作は取り消せません。
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm">キャンセル</button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold">
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const INPUT_CLS = 'w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500'

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted font-medium">{label}</label>
      {children}
    </div>
  )
}
