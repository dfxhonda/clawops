import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'

const LIST_SELECT = 'supplier_id,supplier_name,supplier_kana,phone,email,website,notes,is_active'

const EMPTY_FORM = {
  supplier_name: '', supplier_kana: '', phone: '', email: '',
  website: '', notes: '', is_active: true,
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && <span className="text-[10px] text-muted">{label}</span>}
      {children}
    </div>
  )
}

function TInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-bg border border-border rounded px-2 py-1 text-xs text-text w-full"
    />
  )
}

export default function AdminSupplierPage() {
  const { staffName } = useAuth()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      let q = supabase.from('suppliers').select(LIST_SELECT).order('supplier_name')
      if (search.trim()) q = q.ilike('supplier_name', `%${search.trim()}%`)
      if (activeOnly)    q = q.eq('is_active', true)
      const { data, error: loadErr } = await q
      if (cancelled) return
      if (loadErr) setError(loadErr.message)
      else setRows(data ?? [])
      setLoading(false)
    }
    fetchData()
    return () => { cancelled = true }
  }, [search, activeOnly, loadKey])

  function reload() { setLoadKey(k => k + 1) }

  function openNew() {
    setForm(EMPTY_FORM)
    setModal('new')
    setError(null)
  }

  async function openEdit(row) {
    const { data, error: loadErr } = await supabase
      .from('suppliers')
      .select(LIST_SELECT)
      .eq('supplier_id', row.supplier_id)
      .single()
    if (loadErr) { setError(loadErr.message); return }
    setForm({
      supplier_name: data.supplier_name ?? '', supplier_kana: data.supplier_kana ?? '',
      phone: data.phone ?? '', email: data.email ?? '',
      website: data.website ?? '', notes: data.notes ?? '',
      is_active: data.is_active ?? true,
    })
    setModal(data)
    setError(null)
  }

  async function handleSave() {
    if (!form.supplier_name.trim()) { setError('取引先名は必須です'); return }
    setSaving(true)
    setError(null)
    const payload = {
      supplier_name: form.supplier_name.trim(),
      supplier_kana: form.supplier_kana || null,
      phone:    form.phone || null,
      email:    form.email || null,
      website:  form.website || null,
      notes:    form.notes || null,
      is_active: form.is_active,
      updated_by: staffName,
      updated_at: new Date().toISOString(),
    }
    if (modal === 'new') {
      const { error: saveErr } = await supabase.from('suppliers').insert({
        supplier_id: crypto.randomUUID(),
        organization_id: DFX_ORG_ID,
        ...payload,
        created_by: staffName,
      })
      if (saveErr) { setError(saveErr.message); setSaving(false); return }
    } else {
      const { error: saveErr } = await supabase.from('suppliers')
        .update(payload)
        .eq('supplier_id', modal.supplier_id)
      if (saveErr) { setError(saveErr.message); setSaving(false); return }
    }
    setSaving(false)
    setModal(null)
    reload()
  }

  const f = (v) => setForm(prev => ({ ...prev, ...v }))

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 80px)' }}>
      {/* toolbar */}
      <div className="flex-shrink-0 p-3 pb-2">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            data-testid="supplier-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="取引先名 検索"
            className="bg-bg border border-border rounded px-2 py-1 text-xs text-text flex-1 min-w-[160px]"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={e => setActiveOnly(e.target.checked)}
              className="accent-accent"
              data-testid="supplier-active-toggle"
            />
            有効のみ
          </label>
          <span className="text-xs text-muted whitespace-nowrap">
            {rows.length}件
          </span>
          <button
            data-testid="supplier-new-button"
            onClick={openNew}
            className="ml-auto px-3 py-1 rounded bg-blue-600 text-white text-xs font-bold whitespace-nowrap"
          >
            + 新規登録
          </button>
        </div>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
        {loading && <p className="text-center text-muted text-xs py-8">読込中…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-center text-muted text-xs py-8">該当なし</p>
        )}
        {error && !modal && <p className="text-red-400 text-xs px-3 py-2">{error}</p>}
        <div data-testid="supplier-list">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-bg z-10">
              <tr className="border-b border-border">
                <th className="py-1 px-2 text-left text-muted">取引先名</th>
                <th className="py-1 px-2 text-left text-muted">カナ</th>
                <th className="py-1 px-2 text-left text-muted">電話</th>
                <th className="py-1 px-2 text-left text-muted">メール</th>
                <th className="py-1 px-2 text-left text-muted">ST</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.supplier_id}
                  data-testid="supplier-row"
                  onClick={() => openEdit(r)}
                  className="border-b border-border/50 hover:bg-surface cursor-pointer"
                >
                  <td className="py-1.5 px-2 text-text font-medium max-w-[180px] truncate">{r.supplier_name}</td>
                  <td className="py-1.5 px-2 text-muted max-w-[120px] truncate">{r.supplier_kana}</td>
                  <td className="py-1.5 px-2 text-muted">{r.phone}</td>
                  <td className="py-1.5 px-2 text-muted max-w-[160px] truncate">{r.email}</td>
                  <td className="py-1.5 px-2">
                    <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                      r.is_active ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                    }`}>
                      {r.is_active ? '有効' : '無効'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* modal */}
      {modal !== null && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div data-testid="supplier-modal" className="bg-bg border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-text">
                {modal === 'new' ? '取引先 新規登録' : '取引先編集'}
              </span>
              <button onClick={() => setModal(null)} className="text-muted text-lg leading-none">✕</button>
            </div>

            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

            <div className="flex flex-col gap-3">
              <Field label="取引先名 *">
                <TInput value={form.supplier_name} onChange={v => f({ supplier_name: v })} placeholder="取引先名" />
              </Field>
              <Field label="カナ">
                <TInput value={form.supplier_kana} onChange={v => f({ supplier_kana: v })} placeholder="カタカナ" />
              </Field>
              <Field label="電話番号">
                <TInput value={form.phone} onChange={v => f({ phone: v })} placeholder="0120-..." type="tel" />
              </Field>
              <Field label="メールアドレス">
                <TInput value={form.email} onChange={v => f({ email: v })} placeholder="info@example.com" type="email" />
              </Field>
              <Field label="Webサイト">
                <TInput value={form.website} onChange={v => f({ website: v })} placeholder="https://..." />
              </Field>
              <Field label="備考">
                <textarea
                  value={form.notes ?? ''}
                  onChange={e => f({ notes: e.target.value })}
                  rows={3}
                  className="bg-bg border border-border rounded px-2 py-1 text-xs text-text w-full resize-none"
                  placeholder="備考"
                />
              </Field>
              <label className="flex items-center gap-2 text-xs text-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => f({ is_active: e.target.checked })}
                  className="accent-accent"
                />
                有効 (is_active)
              </label>
            </div>

            <div className="flex gap-2 mt-4">
              <div className="flex-1" />
              <button onClick={() => setModal(null)} className="px-3 py-1.5 rounded border border-border text-xs text-muted">
                キャンセル
              </button>
              <button
                data-testid="supplier-save-button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 rounded bg-blue-600 text-white text-xs font-bold disabled:opacity-50"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
