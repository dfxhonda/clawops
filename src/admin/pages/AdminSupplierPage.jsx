import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'

const LIST_SELECT = 'supplier_id,supplier_name,supplier_type,contact_method,contact_detail,order_method,default_prize_tag,lead_time_days,payment_terms,is_active,notes'

const EMPTY_FORM = {
  supplier_name: '', supplier_type: '', contact_method: '',
  contact_detail: '', order_method: '', default_prize_tag: '',
  lead_time_days: '', payment_terms: '', is_active: true, notes: '',
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && <span className="text-xs text-muted">{label}</span>}
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
      className="bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full"
    />
  )
}

export default function AdminSupplierPage() {
  const { staffName } = useAuth()
  const [rows, setRows]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [modal, setModal]           = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const [loadKey, setLoadKey]       = useState(0)
  const [gridMode, setGridMode] = useState(false)
  const [gridEdits, setGridEdits] = useState({})
  const [gridSaving, setGridSaving] = useState(false)

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
      .from('suppliers').select(LIST_SELECT)
      .eq('supplier_id', row.supplier_id).single()
    if (loadErr) { setError(loadErr.message); return }
    setForm({
      supplier_name:    data.supplier_name ?? '',
      supplier_type:    data.supplier_type ?? '',
      contact_method:   data.contact_method ?? '',
      contact_detail:   data.contact_detail ?? '',
      order_method:     data.order_method ?? '',
      default_prize_tag: data.default_prize_tag ?? '',
      lead_time_days:   data.lead_time_days ?? '',
      payment_terms:    data.payment_terms ?? '',
      is_active:        data.is_active ?? true,
      notes:            data.notes ?? '',
    })
    setModal(data)
    setError(null)
  }

  async function handleSave() {
    if (!form.supplier_name.trim()) { setError('取引先名は必須です'); return }
    setSaving(true)
    setError(null)
    const payload = {
      supplier_name:     form.supplier_name.trim(),
      supplier_type:     form.supplier_type || null,
      contact_method:    form.contact_method || null,
      contact_detail:    form.contact_detail || null,
      order_method:      form.order_method || null,
      default_prize_tag: form.default_prize_tag || null,
      lead_time_days:    form.lead_time_days !== '' ? Number(form.lead_time_days) : null,
      payment_terms:     form.payment_terms || null,
      is_active:         form.is_active,
      notes:             form.notes || null,
      updated_by:        staffName,
      updated_at:        new Date().toISOString(),
    }
    if (modal === 'new') {
      const { error: saveErr } = await supabase.from('suppliers').insert({
        supplier_id:     crypto.randomUUID(),
        organization_id: DFX_ORG_ID,
        ...payload,
        created_by: staffName,
      })
      if (saveErr) { setError(saveErr.message); setSaving(false); return }
    } else {
      const { error: saveErr } = await supabase.from('suppliers')
        .update(payload).eq('supplier_id', modal.supplier_id)
      if (saveErr) { setError(saveErr.message); setSaving(false); return }
    }
    setSaving(false)
    setModal(null)
    reload()
  }

  const f = v => setForm(prev => ({ ...prev, ...v }))

  const gridCellCls = "w-full h-7 px-1.5 bg-transparent border-0 text-text text-sm outline-none focus:bg-surface rounded [color-scheme:dark]"

  function setGCell(id, key, val) {
    setGridEdits(prev => {
      const row = rows.find(r => r.supplier_id === id)
      const base = prev[id] ?? {
        supplier_name: row?.supplier_name ?? '',
        supplier_type: row?.supplier_type ?? '',
        contact_method: row?.contact_method ?? '',
        contact_detail: row?.contact_detail ?? '',
        order_method: row?.order_method ?? '',
        lead_time_days: row?.lead_time_days ?? '',
        is_active: row?.is_active ?? true,
      }
      return { ...prev, [id]: { ...base, [key]: val } }
    })
  }

  async function saveGridEdits() {
    setGridSaving(true)
    const now = new Date().toISOString()
    for (const [id, ge] of Object.entries(gridEdits)) {
      const { error: ge_err } = await supabase.from('suppliers').update({
        supplier_name: ge.supplier_name.trim(),
        supplier_type: ge.supplier_type || null,
        contact_method: ge.contact_method || null,
        contact_detail: ge.contact_detail || null,
        order_method: ge.order_method || null,
        lead_time_days: ge.lead_time_days !== '' ? Number(ge.lead_time_days) : null,
        is_active: ge.is_active,
        updated_by: staffName,
        updated_at: now,
      }).eq('supplier_id', id)
      if (ge_err) { setError(ge_err.message); setGridSaving(false); return }
    }
    setGridSaving(false)
    setGridEdits({})
    reload()
  }

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
            className="bg-bg border border-border rounded px-2 py-1 text-sm text-text flex-1 min-w-[160px]"
          />
          <label className="flex items-center gap-1.5 text-sm text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={e => setActiveOnly(e.target.checked)}
              className="accent-accent"
              data-testid="supplier-active-toggle"
            />
            有効のみ
          </label>
          <span className="text-sm text-muted whitespace-nowrap">{rows.length}件</span>
          <button
            data-testid="supplier-new-button"
            onClick={openNew}
            className="ml-auto px-3 py-1 rounded bg-blue-600 text-white text-sm font-bold whitespace-nowrap"
          >
            + 新規登録
          </button>
          <button
            onClick={() => { setGridMode(m => !m); setGridEdits({}) }}
            className={`px-3 py-1 rounded text-sm font-bold whitespace-nowrap border ${gridMode ? 'bg-amber-600 text-white border-transparent' : 'border-border text-muted'}`}
          >
            {gridMode ? '⊞ 表編集中' : '⊞ 表編集'}
          </button>
        </div>
      </div>

      {gridMode && Object.keys(gridEdits).length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 border-y border-amber-700/40">
          <span className="text-sm text-amber-400">{Object.keys(gridEdits).length}件 変更あり</span>
          <button onClick={() => setGridEdits({})} className="ml-auto text-sm text-muted px-2 py-1 rounded border border-border">取消</button>
          <button onClick={saveGridEdits} disabled={gridSaving} className="text-sm text-white bg-blue-600 px-3 py-1 rounded font-bold disabled:opacity-50">
            {gridSaving ? '保存中…' : '一括保存'}
          </button>
        </div>
      )}

      {/* list */}
      <div className="flex-1 overflow-auto px-3 pb-3 min-h-0">
        {loading && <p className="text-center text-muted text-sm py-8">読込中…</p>}
        {!loading && rows.length === 0 && <p className="text-center text-muted text-sm py-8">該当なし</p>}
        {error && !modal && <p className="text-red-400 text-sm px-3 py-2">{error}</p>}
        <div data-testid="supplier-list">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-bg z-10">
              <tr className="border-b border-border">
                <th className="py-1 px-2 text-left text-muted">取引先名</th>
                <th className="py-1 px-2 text-left text-muted hidden md:table-cell">種別</th>
                <th className="py-1 px-2 text-left text-muted hidden md:table-cell">連絡方法</th>
                <th className="py-1 px-2 text-left text-muted">連絡先</th>
                <th className="py-1 px-2 text-left text-muted hidden md:table-cell">発注方法</th>
                <th className="py-1 px-2 text-right text-muted hidden md:table-cell">LT</th>
                <th className="py-1 px-2 text-left text-muted">ST</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const ge = gridEdits[r.supplier_id]
                return (
                  <tr
                    key={r.supplier_id}
                    data-testid="supplier-row"
                    onClick={gridMode ? undefined : () => openEdit(r)}
                    className={`border-b border-border/50 ${gridMode ? (ge ? 'bg-amber-900/15' : 'hover:bg-surface/30') : 'hover:bg-surface cursor-pointer'}`}
                  >
                    <td className="py-0.5 px-1 text-text font-medium max-w-[160px]">
                      {gridMode ? <input value={ge?.supplier_name ?? r.supplier_name ?? ''} onChange={ev => setGCell(r.supplier_id, 'supplier_name', ev.target.value)} className={gridCellCls} /> : <span className="truncate block">{r.supplier_name}</span>}
                    </td>
                    <td className="py-0.5 px-1 text-muted hidden md:table-cell">
                      {gridMode ? <input value={ge?.supplier_type ?? r.supplier_type ?? ''} onChange={ev => setGCell(r.supplier_id, 'supplier_type', ev.target.value)} className={gridCellCls} /> : r.supplier_type}
                    </td>
                    <td className="py-0.5 px-1 text-muted hidden md:table-cell">
                      {gridMode ? <input value={ge?.contact_method ?? r.contact_method ?? ''} onChange={ev => setGCell(r.supplier_id, 'contact_method', ev.target.value)} className={gridCellCls} /> : r.contact_method}
                    </td>
                    <td className="py-0.5 px-1 text-muted max-w-[140px]">
                      {gridMode ? <input value={ge?.contact_detail ?? r.contact_detail ?? ''} onChange={ev => setGCell(r.supplier_id, 'contact_detail', ev.target.value)} className={gridCellCls} /> : <span className="truncate block">{r.contact_detail}</span>}
                    </td>
                    <td className="py-0.5 px-1 text-muted hidden md:table-cell">
                      {gridMode ? <input value={ge?.order_method ?? r.order_method ?? ''} onChange={ev => setGCell(r.supplier_id, 'order_method', ev.target.value)} className={gridCellCls} /> : r.order_method}
                    </td>
                    <td className="py-0.5 px-1 text-right text-muted font-mono hidden md:table-cell">
                      {gridMode
                        ? <input type="number" value={ge?.lead_time_days ?? r.lead_time_days ?? ''} onChange={ev => setGCell(r.supplier_id, 'lead_time_days', ev.target.value)} className={`${gridCellCls} text-right`} />
                        : (r.lead_time_days != null ? `${r.lead_time_days}日` : '')}
                    </td>
                    <td className="py-0.5 px-1">
                      {gridMode
                        ? <input type="checkbox" checked={ge?.is_active ?? r.is_active ?? false} onChange={ev => setGCell(r.supplier_id, 'is_active', ev.target.checked)} className="accent-blue-500" />
                        : <span className={`px-1 py-0.5 rounded text-xs font-bold ${r.is_active ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>{r.is_active ? '有効' : '無効'}</span>}
                    </td>
                  </tr>
                )
              })}
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

            {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

            <div className="flex flex-col gap-3">
              <Field label="取引先名 *">
                <TInput value={form.supplier_name} onChange={v => f({ supplier_name: v })} placeholder="取引先名" />
              </Field>
              <Field label="種別">
                <TInput value={form.supplier_type} onChange={v => f({ supplier_type: v })} placeholder="景品メーカー / 問屋 など" />
              </Field>
              <Field label="連絡方法">
                <TInput value={form.contact_method} onChange={v => f({ contact_method: v })} placeholder="電話 / メール / LINE など" />
              </Field>
              <Field label="連絡先">
                <TInput value={form.contact_detail} onChange={v => f({ contact_detail: v })} placeholder="電話番号 / メールアドレス など" />
              </Field>
              <Field label="発注方法">
                <TInput value={form.order_method} onChange={v => f({ order_method: v })} placeholder="電話 / FAX / Web など" />
              </Field>
              <Field label="デフォルト景品タグ">
                <TInput value={form.default_prize_tag} onChange={v => f({ default_prize_tag: v })} placeholder="タグ" />
              </Field>
              <Field label="リードタイム (日)">
                <TInput value={form.lead_time_days} onChange={v => f({ lead_time_days: v })} placeholder="3" type="number" />
              </Field>
              <Field label="支払条件">
                <TInput value={form.payment_terms} onChange={v => f({ payment_terms: v })} placeholder="月末締め翌月払い など" />
              </Field>
              <Field label="備考">
                <textarea
                  value={form.notes ?? ''}
                  onChange={e => f({ notes: e.target.value })}
                  rows={3}
                  className="bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full resize-none"
                  placeholder="備考"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => f({ is_active: e.target.checked })} className="accent-accent" />
                有効 (is_active)
              </label>
            </div>

            <div className="flex gap-2 mt-4">
              <div className="flex-1" />
              <button onClick={() => setModal(null)} className="px-3 py-1.5 rounded border border-border text-sm text-muted">
                キャンセル
              </button>
              <button
                data-testid="supplier-save-button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
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
