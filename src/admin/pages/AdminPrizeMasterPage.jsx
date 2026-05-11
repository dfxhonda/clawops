import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'

const PAGE_SIZE = 50
const LIST_SELECT = 'prize_id,prize_name,short_name,category,status,original_cost,supplier_name,latest_order_date,phase,registered_at'
const EDIT_SELECT = LIST_SELECT + ',prize_name_kana,aliases,series,size,supplier_id,supplier_item_code,jan_code,default_case_quantity,image_url,notes,order_rules,tags,default_tag,weight_g,organization_id,updated_at,updated_by,registered_by'

const STATUS_VALUES = ['active', 'inactive', 'unknown']
const PHASE_VALUES  = ['normal', 'out_of_stock', 'discontinued']

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted">{label}</span>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', required }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="bg-bg border border-border rounded px-2 py-1 text-xs text-text w-full"
    />
  )
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className="bg-bg border border-border rounded px-2 py-1 text-xs text-text w-full"
    >
      <option value="">ALL</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function SortTh({ col, label, align = 'left', sortCol, sortAsc, onSort }) {
  const active = sortCol === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`py-1 px-2 whitespace-nowrap cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'} ${active ? 'text-blue-400' : 'text-muted hover:text-text'}`}
    >
      {label}{active ? (sortAsc ? ' ▲' : ' ▼') : ''}
    </th>
  )
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null
  const items = []
  const add = (p) => items.push({ type: 'page', p })
  const addDot = () => items.push({ type: 'dot' })

  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) add(i)
  } else {
    const near = new Set([0, totalPages - 1, page - 1, page, page + 1].filter(p => p >= 0 && p < totalPages))
    const sorted = [...near].sort((a, b) => a - b)
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) addDot()
      add(sorted[i])
    }
  }

  return (
    <div data-testid="prize-pagination" className="flex items-center justify-center gap-1 mt-3 flex-wrap">
      <button onClick={() => onPage(page - 1)} disabled={page === 0} className="px-2 py-1 text-xs text-muted disabled:opacity-30">‹</button>
      {items.map((it, i) =>
        it.type === 'dot'
          ? <span key={`d${i}`} className="px-1 text-xs text-muted">…</span>
          : <button
              key={it.p}
              onClick={() => onPage(it.p)}
              className={`px-2 py-1 text-xs rounded ${it.p === page ? 'bg-blue-600 text-white font-bold' : 'text-muted hover:text-text'}`}
            >
              {it.p + 1}
            </button>
      )}
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1} className="px-2 py-1 text-xs text-muted disabled:opacity-30">›</button>
    </div>
  )
}

const EMPTY_FORM = {
  prize_name: '', short_name: '', prize_name_kana: '', aliases: '', category: '',
  series: '', size: '', status: 'active', phase: 'normal',
  original_cost: '', supplier_id: '', supplier_name: '', supplier_item_code: '',
  jan_code: '', default_case_quantity: '', image_url: '', notes: '',
  order_rules: '', tags: '', default_tag: '', weight_g: '',
}

export default function AdminPrizeMasterPage() {
  const { staffName } = useAuth()
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [totalCount, setTotal]  = useState(null)
  const [page, setPage]         = useState(0)
  const [sortCol, setSortCol]   = useState('registered_at')
  const [sortAsc, setSortAsc]   = useState(false)
  const [loadKey, setLoadKey]   = useState(0)
  const [search, setSearch]     = useState('')
  const [catFilter, setCat]     = useState('')
  const [stFilter, setSt]       = useState('')
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      let q = supabase
        .from('prize_masters')
        .select(LIST_SELECT, { count: 'exact' })
        .order(sortCol, { ascending: sortAsc })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (search.trim()) q = q.or(`prize_name.ilike.%${search}%,short_name.ilike.%${search}%,aliases.ilike.%${search}%`)
      if (catFilter)     q = q.ilike('category', `%${catFilter}%`)
      if (stFilter)      q = q.eq('status', stFilter)
      const { data, count, error: e } = await q
      if (cancelled) return
      if (e) setError(e.message)
      else { setRows(data ?? []); if (count !== null) setTotal(count) }
      setLoading(false)
    }
    fetchData()
    return () => { cancelled = true }
  }, [page, sortCol, sortAsc, search, catFilter, stFilter, loadKey]) // eslint-disable-line

  function handleSort(col) {
    if (col === sortCol) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(false) }
    setPage(0)
  }

  function handleSearch(v)  { setSearch(v);   setPage(0) }
  function handleCat(v)     { setCat(v);       setPage(0) }
  function handleSt(v)      { setSt(v);        setPage(0) }
  function reload()         { setLoadKey(k => k + 1) }

  function openNew() {
    setForm(EMPTY_FORM)
    setModal('new')
    setError(null)
  }

  async function openEdit(row) {
    const { data, error: e } = await supabase
      .from('prize_masters')
      .select(EDIT_SELECT)
      .eq('prize_id', row.prize_id)
      .single()
    if (e) { setError(e.message); return }
    setForm({
      prize_name: data.prize_name ?? '', short_name: data.short_name ?? '',
      prize_name_kana: data.prize_name_kana ?? '', aliases: data.aliases ?? '',
      category: data.category ?? '', series: data.series ?? '', size: data.size ?? '',
      status: data.status ?? 'active', phase: data.phase ?? 'normal',
      original_cost: data.original_cost ?? '', supplier_id: data.supplier_id ?? '',
      supplier_name: data.supplier_name ?? '', supplier_item_code: data.supplier_item_code ?? '',
      jan_code: data.jan_code ?? '', default_case_quantity: data.default_case_quantity ?? '',
      image_url: data.image_url ?? '', notes: data.notes ?? '',
      order_rules: data.order_rules ?? '', tags: data.tags ?? '',
      default_tag: data.default_tag ?? '', weight_g: data.weight_g ?? '',
    })
    setModal(data)
    setError(null)
  }

  async function handleSave() {
    if (!form.prize_name.trim()) { setError('景品名は必須です'); return }
    setSaving(true)
    setError(null)
    const now = new Date().toISOString()
    if (modal === 'new') {
      const { error: e } = await supabase.from('prize_masters').insert({
        prize_id: crypto.randomUUID(),
        organization_id: DFX_ORG_ID,
        ...form,
        original_cost: form.original_cost === '' ? null : Number(form.original_cost),
        default_case_quantity: form.default_case_quantity === '' ? null : Number(form.default_case_quantity),
        weight_g: form.weight_g === '' ? null : Number(form.weight_g),
        registered_by: staffName,
        updated_by: staffName,
        updated_at: now,
      })
      if (e) { setError(e.message); setSaving(false); return }
    } else {
      const { error: e } = await supabase.from('prize_masters')
        .update({
          ...form,
          original_cost: form.original_cost === '' ? null : Number(form.original_cost),
          default_case_quantity: form.default_case_quantity === '' ? null : Number(form.default_case_quantity),
          weight_g: form.weight_g === '' ? null : Number(form.weight_g),
          updated_by: staffName,
          updated_at: now,
        })
        .eq('prize_id', modal.prize_id)
      if (e) { setError(e.message); setSaving(false); return }
    }
    setSaving(false)
    setModal(null)
    reload()
  }

  async function handleSoftDelete() {
    if (!modal || modal === 'new') return
    setSaving(true)
    const { error: e } = await supabase.from('prize_masters')
      .update({ status: 'inactive', updated_by: staffName, updated_at: new Date().toISOString() })
      .eq('prize_id', modal.prize_id)
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null)
    reload()
  }

  const f = (v) => setForm(prev => ({ ...prev, ...v }))
  const totalPages = totalCount !== null ? Math.ceil(totalCount / PAGE_SIZE) : 0

  return (
    <div className="p-3 min-h-full">
      {/* toolbar */}
      <div className="flex flex-wrap gap-2 mb-2 items-center">
        <input
          data-testid="prize-search"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="景品名・短縮名・alias 検索"
          className="bg-bg border border-border rounded px-2 py-1 text-xs text-text flex-1 min-w-[160px]"
        />
        <input
          data-testid="prize-filter-category"
          value={catFilter}
          onChange={e => handleCat(e.target.value)}
          placeholder="カテゴリ絞込"
          className="bg-bg border border-border rounded px-2 py-1 text-xs text-text w-28"
        />
        <select
          data-testid="prize-filter-status"
          value={stFilter}
          onChange={e => handleSt(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-xs text-text"
        >
          <option value="">ステータス ALL</option>
          {STATUS_VALUES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {totalCount !== null && (
          <span data-testid="prize-total-count" className="text-xs text-muted whitespace-nowrap">
            全{totalCount.toLocaleString()}件
          </span>
        )}
        <button
          data-testid="prize-new-button"
          onClick={openNew}
          className="ml-auto px-3 py-1 rounded bg-blue-600 text-white text-xs font-bold whitespace-nowrap"
        >
          + 新規登録
        </button>
      </div>

      {loading && <p className="text-center text-muted text-xs py-8">読込中…</p>}
      {!loading && rows.length === 0 && (
        <p className="text-center text-muted text-xs py-8">該当なし</p>
      )}

      {/* list */}
      <div data-testid="prize-list" className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border">
              <SortTh col="prize_name"        label="景品名"   align="left"  sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort} />
              <th className="py-1 px-2 whitespace-nowrap text-left text-muted">短縮名</th>
              <th className="py-1 px-2 whitespace-nowrap text-left text-muted">カテゴリ</th>
              <th className="py-1 px-2 whitespace-nowrap text-left text-muted">ST</th>
              <SortTh col="original_cost"     label="原価"     align="right" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort} />
              <th className="py-1 px-2 whitespace-nowrap text-left text-muted">取引先</th>
              <SortTh col="latest_order_date" label="最終発注" align="left"  sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.prize_id}
                data-testid="prize-row"
                onClick={() => openEdit(r)}
                className="border-b border-border/50 hover:bg-surface cursor-pointer"
              >
                <td className="py-1 px-2 text-text font-medium max-w-[200px] truncate">{r.prize_name}</td>
                <td className="py-1 px-2 text-muted">{r.short_name}</td>
                <td className="py-1 px-2 text-muted">{r.category}</td>
                <td className="py-1 px-2">
                  <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                    r.status === 'active'   ? 'bg-green-600 text-white' :
                    r.status === 'inactive' ? 'bg-gray-600 text-gray-300' :
                    'bg-amber-600 text-white'
                  }`}>{r.status}</span>
                </td>
                <td className="py-1 px-2 text-right text-muted">{r.original_cost != null ? r.original_cost.toLocaleString() : ''}</td>
                <td className="py-1 px-2 text-muted max-w-[120px] truncate">{r.supplier_name}</td>
                <td className="py-1 px-2 text-muted">{r.latest_order_date ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />

      {/* modal */}
      {modal !== null && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div data-testid="prize-modal" className="bg-bg border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90dvh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-text">
                {modal === 'new' ? '景品 新規登録' : '景品編集'}
              </span>
              <button onClick={() => setModal(null)} className="text-muted text-lg leading-none">✕</button>
            </div>

            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              {/* left: 基本情報 */}
              <div className="flex flex-col gap-3">
                <Field label="景品名 *">
                  <Input value={form.prize_name} onChange={v => f({ prize_name: v })} placeholder="景品名" required />
                </Field>
                <Field label="短縮名">
                  <Input value={form.short_name} onChange={v => f({ short_name: v })} placeholder="短縮名" />
                </Field>
                <Field label="読み仮名">
                  <Input value={form.prize_name_kana} onChange={v => f({ prize_name_kana: v })} placeholder="かな" />
                </Field>
                <Field label="aliases">
                  <Input value={form.aliases} onChange={v => f({ aliases: v })} placeholder="別名・検索用" />
                </Field>
                <Field label="カテゴリ">
                  <Input value={form.category} onChange={v => f({ category: v })} placeholder="カテゴリ" />
                </Field>
                <Field label="シリーズ">
                  <Input value={form.series} onChange={v => f({ series: v })} placeholder="シリーズ" />
                </Field>
                <Field label="サイズ">
                  <Input value={form.size} onChange={v => f({ size: v })} placeholder="サイズ" />
                </Field>
                <Field label="ステータス">
                  <Select value={form.status} onChange={v => f({ status: v })} options={STATUS_VALUES} />
                </Field>
                <Field label="フェーズ">
                  <Select value={form.phase} onChange={v => f({ phase: v })} options={PHASE_VALUES} />
                </Field>
              </div>

              {/* right: 仕入れ・分類・備考 */}
              <div className="flex flex-col gap-3">
                <Field label="原価">
                  <Input value={form.original_cost} onChange={v => f({ original_cost: v })} type="number" placeholder="0" />
                </Field>
                <Field label="取引先ID">
                  <Input value={form.supplier_id} onChange={v => f({ supplier_id: v })} placeholder="supplier_id" />
                </Field>
                <Field label="取引先名">
                  <Input value={form.supplier_name} onChange={v => f({ supplier_name: v })} placeholder="取引先名" />
                </Field>
                <Field label="取引先品番">
                  <Input value={form.supplier_item_code} onChange={v => f({ supplier_item_code: v })} placeholder="品番" />
                </Field>
                <Field label="JANコード">
                  <Input value={form.jan_code} onChange={v => f({ jan_code: v })} placeholder="JAN" />
                </Field>
                <Field label="入数">
                  <Input value={form.default_case_quantity} onChange={v => f({ default_case_quantity: v })} type="number" placeholder="0" />
                </Field>
                <Field label="重量(g)">
                  <Input value={form.weight_g} onChange={v => f({ weight_g: v })} type="number" placeholder="0" />
                </Field>
                <Field label="画像URL">
                  <Input value={form.image_url} onChange={v => f({ image_url: v })} placeholder="https://..." />
                </Field>
                <Field label="備考">
                  <textarea
                    value={form.notes ?? ''}
                    onChange={e => f({ notes: e.target.value })}
                    rows={2}
                    className="bg-bg border border-border rounded px-2 py-1 text-xs text-text w-full resize-none"
                    placeholder="備考"
                  />
                </Field>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              {modal !== 'new' && (
                <button
                  data-testid="prize-delete-button"
                  onClick={handleSoftDelete}
                  disabled={saving}
                  className="px-3 py-1.5 rounded bg-red-800 text-white text-xs font-bold disabled:opacity-50"
                >
                  廃止
                </button>
              )}
              <div className="flex-1" />
              <button onClick={() => setModal(null)} className="px-3 py-1.5 rounded border border-border text-xs text-muted">
                キャンセル
              </button>
              <button
                data-testid="prize-save-button"
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
