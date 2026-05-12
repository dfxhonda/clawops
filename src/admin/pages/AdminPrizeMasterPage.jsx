import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'

const LIST_SELECT = 'prize_id,prize_name,aliases,category,status,original_cost,supplier_name,latest_order_date,phase,registered_at'
// EDIT_SELECT maintains short_name for DB read/write even though it's removed from list
const EDIT_SELECT = LIST_SELECT + ',short_name,prize_name_kana,series,size,supplier_id,supplier_item_code,jan_code,default_case_quantity,image_url,notes,order_rules,tags,default_tag,weight_g,organization_id,updated_at,updated_by,registered_by'

const STATUS_VALUES = ['active', 'inactive', 'unknown']
const PHASE_VALUES  = ['normal', 'out_of_stock', 'discontinued']

function alias0(val) {
  try { return JSON.parse(val)?.[0] ?? null } catch { return val || null }
}
function wrapAlias(v) { return v.trim() ? JSON.stringify([v.trim()]) : null }

function Field({ label, children, row }) {
  return (
    <div className={`flex ${row ? 'flex-row items-center gap-2' : 'flex-col gap-0.5'}`}>
      {label && <span className="text-[10px] text-muted whitespace-nowrap">{label}</span>}
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', required, className = '' }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className={`bg-bg border border-border rounded px-2 py-1 text-xs text-text w-full ${className}`}
    />
  )
}

function FSelect({ value, onChange, options }) {
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

const EMPTY_FORM = {
  prize_name: '', aliases: '', prize_name_kana: '', category: '',
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
  const [sortCol, setSortCol]   = useState('registered_at')
  const [sortAsc, setSortAsc]   = useState(false)
  const [loadKey, setLoadKey]   = useState(0)
  const [search, setSearch]     = useState('')
  const [catFilter, setCat]     = useState('')
  const [stFilter, setSt]       = useState('')
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [showMore, setShowMore] = useState(false)
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
  }, [sortCol, sortAsc, search, catFilter, stFilter, loadKey]) // eslint-disable-line

  function handleSort(col) {
    if (col === sortCol) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(false) }
  }
  function handleSearch(v)  { setSearch(v) }
  function handleCat(v)     { setCat(v) }
  function handleSt(v)      { setSt(v) }
  function reload()         { setLoadKey(k => k + 1) }

  function openNew() {
    setForm(EMPTY_FORM)
    setModal('new')
    setShowMore(false)
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
      prize_name: data.prize_name ?? '', aliases: data.aliases ?? '',
      prize_name_kana: data.prize_name_kana ?? '', category: data.category ?? '',
      series: data.series ?? '', size: data.size ?? '',
      status: data.status ?? 'active', phase: data.phase ?? 'normal',
      original_cost: data.original_cost ?? '', supplier_id: data.supplier_id ?? '',
      supplier_name: data.supplier_name ?? '', supplier_item_code: data.supplier_item_code ?? '',
      jan_code: data.jan_code ?? '', default_case_quantity: data.default_case_quantity ?? '',
      image_url: data.image_url ?? '', notes: data.notes ?? '',
      order_rules: data.order_rules ?? '', tags: data.tags ?? '',
      default_tag: data.default_tag ?? '', weight_g: data.weight_g ?? '',
    })
    setModal(data)
    setShowMore(false)
    setError(null)
  }

  async function handleSave() {
    if (!form.prize_name.trim()) { setError('景品名は必須です'); return }
    setSaving(true)
    setError(null)
    const now = new Date().toISOString()
    const payload = {
      ...form,
      aliases: form.aliases || null,
      original_cost: form.original_cost === '' ? null : Number(form.original_cost),
      default_case_quantity: form.default_case_quantity === '' ? null : Number(form.default_case_quantity),
      weight_g: form.weight_g === '' ? null : Number(form.weight_g),
      updated_by: staffName,
      updated_at: now,
    }
    if (modal === 'new') {
      const { error: e } = await supabase.from('prize_masters').insert({
        prize_id: crypto.randomUUID(),
        organization_id: DFX_ORG_ID,
        ...payload,
        registered_by: staffName,
      })
      if (e) { setError(e.message); setSaving(false); return }
    } else {
      const { error: e } = await supabase.from('prize_masters')
        .update(payload)
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
  const caseTotal = (Number(form.original_cost) || 0) * (Number(form.default_case_quantity) || 0)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 80px)' }}>
      {/* toolbar */}
      <div className="flex-shrink-0 p-3 pb-2">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            data-testid="prize-search"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="景品名・alias 検索"
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
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0 overflow-x-auto">
        {loading && <p className="text-center text-muted text-xs py-8">読込中…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-center text-muted text-xs py-8">該当なし</p>
        )}
        <div data-testid="prize-list">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-bg z-10">
              <tr className="border-b border-border">
                <SortTh col="prize_name"        label="景品名"   align="left"  sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort} />
                <th className="py-1 px-2 whitespace-nowrap text-left text-muted">カテゴリ</th>
                <th className="py-1 px-2 whitespace-nowrap text-left text-muted">ST</th>
                <SortTh col="original_cost"     label="原価"     align="right" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort} />
                <th className="py-1 px-2 whitespace-nowrap text-left text-muted">取引先</th>
                <SortTh col="latest_order_date" label="最終発注" align="left"  sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const a0 = alias0(r.aliases)
                return (
                  <tr
                    key={r.prize_id}
                    data-testid="prize-row"
                    onClick={() => openEdit(r)}
                    className="border-b border-border/50 hover:bg-surface cursor-pointer"
                  >
                    <td className="py-1 px-2 max-w-[220px]">
                      <div className="truncate text-text font-medium">{r.prize_name}</div>
                      {a0 && <div className="truncate text-xs text-gray-400">{a0}</div>}
                    </td>
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
          <div data-testid="prize-modal" className="bg-bg border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-text">
                {modal === 'new' ? '景品 新規登録' : '景品編集'}
              </span>
              <button onClick={() => setModal(null)} className="text-muted text-lg leading-none">✕</button>
            </div>

            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

            <div className="flex flex-col gap-3">
              {/* 1: 景品名 (短縮形) */}
              <Field label="景品名 (短縮形) *">
                <input
                  type="text"
                  value={form.prize_name}
                  onChange={e => f({ prize_name: e.target.value })}
                  placeholder="景品名"
                  className="bg-bg border border-border rounded px-2 py-2 text-sm text-text w-full"
                />
              </Field>

              {/* 2: 正式名称 */}
              <Field label="正式名称">
                <Input
                  value={alias0(form.aliases) ?? ''}
                  onChange={v => f({ aliases: wrapAlias(v) })}
                  placeholder="正式名称"
                />
              </Field>

              {/* 3: 原価 + 入数 + ケース金額 */}
              <div className="flex gap-2 items-end">
                <div className="flex flex-col gap-0.5 w-24">
                  <span className="text-[10px] text-muted">単価</span>
                  <Input value={form.original_cost} onChange={v => f({ original_cost: v })} type="number" placeholder="0" />
                </div>
                <div className="flex flex-col gap-0.5 w-20">
                  <span className="text-[10px] text-muted">入数</span>
                  <Input value={form.default_case_quantity} onChange={v => f({ default_case_quantity: v })} type="number" placeholder="0" />
                </div>
                <div className="flex flex-col gap-0.5 flex-1">
                  <span className="text-[10px] text-muted">ケース金額</span>
                  <div className="bg-bg border border-border/50 rounded px-2 py-1 text-xs text-muted">
                    {caseTotal > 0 ? caseTotal.toLocaleString() : '—'}
                  </div>
                </div>
              </div>

              {/* 4: 取引先名 + 取引先ID */}
              <div className="flex gap-2">
                <div className="flex flex-col gap-0.5 flex-1">
                  <span className="text-[10px] text-muted">取引先名</span>
                  <Input value={form.supplier_name} onChange={v => f({ supplier_name: v })} placeholder="取引先名" />
                </div>
                <div className="flex flex-col gap-0.5 w-28">
                  <span className="text-[10px] text-muted">取引先ID</span>
                  <Input value={form.supplier_id} onChange={v => f({ supplier_id: v })} placeholder="ID" />
                </div>
              </div>

              {/* 5: カテゴリ */}
              <Field label="カテゴリ">
                <Input value={form.category} onChange={v => f({ category: v })} placeholder="カテゴリ" />
              </Field>

              {/* 6: 画像URL */}
              <Field label="画像URL">
                <Input value={form.image_url} onChange={v => f({ image_url: v })} placeholder="https://..." />
              </Field>

              {/* その他 (折りたたみ) */}
              <button
                type="button"
                onClick={() => setShowMore(m => !m)}
                className="text-left text-xs text-muted border-t border-border pt-2 flex items-center gap-1"
              >
                その他 {showMore ? '▲' : '▼'}
              </button>
              {showMore && (
                <div className="flex flex-col gap-3">
                  <Field label="ステータス">
                    <FSelect value={form.status} onChange={v => f({ status: v })} options={STATUS_VALUES} />
                  </Field>
                  <Field label="フェーズ">
                    <FSelect value={form.phase} onChange={v => f({ phase: v })} options={PHASE_VALUES} />
                  </Field>
                  <Field label="シリーズ">
                    <Input value={form.series} onChange={v => f({ series: v })} placeholder="シリーズ" />
                  </Field>
                  <Field label="サイズ">
                    <Input value={form.size} onChange={v => f({ size: v })} placeholder="サイズ" />
                  </Field>
                  <Field label="JANコード">
                    <Input value={form.jan_code} onChange={v => f({ jan_code: v })} placeholder="JAN" />
                  </Field>
                  <Field label="重量(g)">
                    <Input value={form.weight_g} onChange={v => f({ weight_g: v })} type="number" placeholder="0" />
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
                  <Field label="発注ルール">
                    <Input value={form.order_rules} onChange={v => f({ order_rules: v })} placeholder="発注ルール" />
                  </Field>
                  <Field label="タグ">
                    <Input value={form.tags} onChange={v => f({ tags: v })} placeholder="タグ" />
                  </Field>
                </div>
              )}
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
