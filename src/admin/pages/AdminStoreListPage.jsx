import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'
import StoreCrudDrawer from '../components/StoreCrudDrawer'

const LIST_SELECT = 'store_id,store_code,store_name,store_name_official,brand_name,store_type,phone,address,region,locality,locality_kana,is_active,opened_at,closed_at,is_collection_day,notes'

const EMPTY_FORM = {
  store_code: '', store_name: '', store_name_official: '',
  brand_name: '', store_type: '', phone: '', address: '',
  region: '', locality: '', locality_kana: '',
  is_active: true, opened_at: '', closed_at: '',
  is_collection_day: false, notes: '',
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

export default function AdminStoreListPage() {
  const navigate = useNavigate()
  const { staffName } = useAuth()
  const [rows, setRows]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [brandFilter, setBrandFilter] = useState('')
  const [brands, setBrands]         = useState([])
  const [modal, setModal]           = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const [loadKey, setLoadKey]       = useState(0)
  const [gridMode, setGridMode] = useState(false)
  const [gridEdits, setGridEdits] = useState({})
  const [gridSaving, setGridSaving] = useState(false)
  const [detailStore, setDetailStore] = useState(null) // 店舗詳細ドロワー対象

  useEffect(() => {
    supabase.from('stores').select('brand_name').then(({ data }) => {
      const unique = [...new Set((data ?? []).map(r => r.brand_name).filter(Boolean))].sort()
      setBrands(unique)
    })
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('stores').select(LIST_SELECT).order('store_name')
    if (search.trim()) {
      const s = search.trim()
      q = q.or(`store_name.ilike.%${s}%,store_name_official.ilike.%${s}%,locality.ilike.%${s}%`)
    }
    if (activeOnly)    q = q.eq('is_active', true)
    if (brandFilter)   q = q.eq('brand_name', brandFilter)
    const { data, error: loadErr } = await q
    if (loadErr) setError(loadErr.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [search, activeOnly, brandFilter, loadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchRows() }, [fetchRows])

  function reload() { setLoadKey(k => k + 1) }

  function openNew() {
    setForm(EMPTY_FORM)
    setModal('new')
    setError(null)
  }

  async function openEdit(row) {
    const { data, error: loadErr } = await supabase
      .from('stores').select(LIST_SELECT)
      .eq('store_id', row.store_id).single()
    if (loadErr) { setError(loadErr.message); return }
    setForm({
      store_code:           data.store_code ?? '',
      store_name:           data.store_name ?? '',
      store_name_official:  data.store_name_official ?? '',
      brand_name:           data.brand_name ?? '',
      store_type:           data.store_type ?? '',
      phone:                data.phone ?? '',
      address:              data.address ?? '',
      region:               data.region ?? '',
      locality:             data.locality ?? '',
      locality_kana:        data.locality_kana ?? '',
      is_active:            data.is_active ?? true,
      opened_at:            data.opened_at ?? '',
      closed_at:            data.closed_at ?? '',
      is_collection_day:    data.is_collection_day ?? false,
      notes:                data.notes ?? '',
    })
    setModal(data)
    setError(null)
  }

  async function handleSave() {
    if (!form.store_name.trim()) { setError('店舗名は必須です'); return }
    setSaving(true)
    setError(null)
    const payload = {
      store_name:          form.store_name.trim(),
      store_name_official: form.store_name_official || null,
      store_code:          form.store_code || null,
      brand_name:          form.brand_name || null,
      store_type:          form.store_type || null,
      phone:               form.phone || null,
      address:             form.address || null,
      region:              form.region || null,
      locality:            form.locality || null,
      locality_kana:       form.locality_kana || null,
      is_active:           form.is_active,
      opened_at:           form.opened_at || null,
      closed_at:           form.closed_at || null,
      is_collection_day:   form.is_collection_day,
      notes:               form.notes || null,
      updated_by:          staffName,
      updated_at:          new Date().toISOString(),
    }
    if (modal === 'new') {
      const { error: saveErr } = await supabase.from('stores').insert({
        store_id:        crypto.randomUUID(),
        organization_id: DFX_ORG_ID,
        ...payload,
        created_by: staffName,
      })
      if (saveErr) { setError(saveErr.message); setSaving(false); return }
    } else {
      const { error: saveErr } = await supabase.from('stores')
        .update(payload).eq('store_id', modal.store_id)
      if (saveErr) { setError(saveErr.message); setSaving(false); return }
    }
    setSaving(false)
    setModal(null)
    reload()
  }

  const f = v => setForm(prev => ({ ...prev, ...v }))

  const gridCellCls = "w-full h-7 px-1.5 bg-transparent border-0 text-text text-xs outline-none focus:bg-surface rounded [color-scheme:dark]"

  function setGCell(id, key, val) {
    setGridEdits(prev => {
      const row = rows.find(r => r.store_id === id)
      const base = prev[id] ?? {
        store_name: row?.store_name ?? '',
        store_code: row?.store_code ?? '',
        address: row?.address ?? '',
        phone: row?.phone ?? '',
        brand_name: row?.brand_name ?? '',
        is_active: row?.is_active ?? true,
      }
      return { ...prev, [id]: { ...base, [key]: val } }
    })
  }

  async function saveGridEdits() {
    setGridSaving(true)
    const now = new Date().toISOString()
    for (const [id, ge] of Object.entries(gridEdits)) {
      const { error: ge_err } = await supabase.from('stores').update({
        store_name: ge.store_name.trim(),
        store_code: ge.store_code || null,
        address: ge.address || null,
        phone: ge.phone || null,
        brand_name: ge.brand_name || null,
        is_active: ge.is_active,
        updated_by: staffName,
        updated_at: now,
      }).eq('store_id', id)
      if (ge_err) { setError(ge_err.message); setGridSaving(false); return }
    }
    setGridSaving(false)
    setGridEdits({})
    reload()
  }

  return (
    <div data-testid="admin-store-list" className="flex flex-col" style={{ height: 'calc(100dvh - 80px)' }}>
      {/* toolbar */}
      <div className="flex-shrink-0 p-3 pb-2">
        <button
          onClick={() => navigate('/admin/masters')}
          className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mb-3"
        >
          ← 戻る
        </button>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            data-testid="store-list-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="店舗名 / 正式名 / 地域"
            className="bg-bg border border-border rounded px-2 py-1 text-xs text-text flex-1 min-w-[160px]"
          />
          <select
            data-testid="store-list-brand-filter"
            value={brandFilter}
            onChange={e => setBrandFilter(e.target.value)}
            className="bg-bg border border-border rounded px-2 py-1 text-xs text-text"
          >
            <option value="">ブランド全て</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={e => setActiveOnly(e.target.checked)}
              className="accent-accent"
              data-testid="store-list-active-toggle"
            />
            有効のみ
          </label>
          <span className="text-xs text-muted whitespace-nowrap">{rows.length}件</span>
          <button
            data-testid="store-list-new-button"
            onClick={openNew}
            className="ml-auto px-3 py-1 rounded bg-blue-600 text-white text-xs font-bold whitespace-nowrap"
          >
            + 新規登録
          </button>
          <button
            onClick={() => { setGridMode(m => !m); setGridEdits({}) }}
            className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap border ${gridMode ? 'bg-amber-600 text-white border-transparent' : 'border-border text-muted'}`}
          >
            {gridMode ? '⊞ 表編集中' : '⊞ 表編集'}
          </button>
        </div>
      </div>

      {gridMode && Object.keys(gridEdits).length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 border-y border-amber-700/40">
          <span className="text-xs text-amber-400">{Object.keys(gridEdits).length}件 変更あり</span>
          <button onClick={() => setGridEdits({})} className="ml-auto text-xs text-muted px-2 py-1 rounded border border-border">取消</button>
          <button onClick={saveGridEdits} disabled={gridSaving} className="text-xs text-white bg-blue-600 px-3 py-1 rounded font-bold disabled:opacity-50">
            {gridSaving ? '保存中…' : '一括保存'}
          </button>
        </div>
      )}

      {/* list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
        {loading && <p className="text-center text-muted text-xs py-8">読込中…</p>}
        {!loading && rows.length === 0 && <p className="text-center text-muted text-xs py-8">該当なし</p>}
        {error && !modal && <p className="text-red-400 text-xs px-3 py-2">{error}</p>}

        <table data-testid="store-list-table" className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-bg z-10">
            <tr className="border-b border-border">
              <th className="py-1 px-2 text-left text-muted">店舗名</th>
              <th className="py-1 px-2 text-left text-muted">コード</th>
              <th className="py-1 px-2 text-left text-muted hidden md:table-cell">住所</th>
              <th className="py-1 px-2 text-left text-muted hidden md:table-cell">電話</th>
              <th className="py-1 px-2 text-left text-muted hidden md:table-cell">ブランド</th>
              <th className="py-1 px-2 text-left text-muted">ST</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const ge = gridEdits[r.store_id]
              return (
                <tr
                  key={r.store_id}
                  data-testid="store-list-row"
                  onClick={gridMode ? undefined : () => { setDetailStore(r); setError(null) }}
                  className={`border-b border-border/50 ${gridMode ? (ge ? 'bg-amber-900/15' : 'hover:bg-surface/30') : 'hover:bg-surface cursor-pointer'}`}
                >
                  <td className="py-0.5 px-1 text-text font-medium max-w-[180px]">
                    {gridMode ? <input value={ge?.store_name ?? r.store_name ?? ''} onChange={ev => setGCell(r.store_id, 'store_name', ev.target.value)} className={gridCellCls} /> : <span className="truncate block">{r.store_name}</span>}
                  </td>
                  <td className="py-0.5 px-1 text-muted font-mono">
                    {gridMode ? <input value={ge?.store_code ?? r.store_code ?? ''} onChange={ev => setGCell(r.store_id, 'store_code', ev.target.value)} className={gridCellCls} /> : r.store_code}
                  </td>
                  <td className="py-0.5 px-1 text-muted max-w-[200px] hidden md:table-cell">
                    {gridMode ? <input value={ge?.address ?? r.address ?? ''} onChange={ev => setGCell(r.store_id, 'address', ev.target.value)} className={gridCellCls} /> : <span className="truncate block">{r.address}</span>}
                  </td>
                  <td className="py-0.5 px-1 text-muted hidden md:table-cell">
                    {gridMode ? <input value={ge?.phone ?? r.phone ?? ''} onChange={ev => setGCell(r.store_id, 'phone', ev.target.value)} className={gridCellCls} /> : r.phone}
                  </td>
                  <td className="py-0.5 px-1 text-muted hidden md:table-cell">
                    {gridMode ? <input value={ge?.brand_name ?? r.brand_name ?? ''} onChange={ev => setGCell(r.store_id, 'brand_name', ev.target.value)} className={gridCellCls} /> : r.brand_name}
                  </td>
                  <td className="py-0.5 px-1">
                    {gridMode
                      ? <input type="checkbox" checked={ge?.is_active ?? r.is_active ?? false} onChange={ev => setGCell(r.store_id, 'is_active', ev.target.checked)} className="accent-blue-500" />
                      : <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${r.is_active ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>{r.is_active ? '有効' : '無効'}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* modal */}
      {modal !== null && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div data-testid="store-list-modal" className="bg-bg border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-text">
                {modal === 'new' ? '店舗 新規登録' : '店舗編集'}
              </span>
              <button onClick={() => setModal(null)} className="text-muted text-lg leading-none">✕</button>
            </div>

            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

            <div className="flex flex-col gap-3">
              <Field label="店舗名 *">
                <TInput value={form.store_name} onChange={v => f({ store_name: v })} placeholder="店舗名" />
              </Field>
              <Field label="正式名称">
                <TInput value={form.store_name_official} onChange={v => f({ store_name_official: v })} placeholder="正式名称（対外書類用）" />
              </Field>
              <Field label="店舗コード">
                <TInput value={form.store_code} onChange={v => f({ store_code: v })} placeholder="KKY01" />
              </Field>
              <Field label="ブランド名">
                <TInput value={form.brand_name} onChange={v => f({ brand_name: v })} placeholder="ブランド名" />
              </Field>
              <Field label="店舗種別">
                <TInput value={form.store_type} onChange={v => f({ store_type: v })} placeholder="店舗種別" />
              </Field>
              <Field label="電話番号">
                <TInput value={form.phone} onChange={v => f({ phone: v })} placeholder="0120-..." type="tel" />
              </Field>
              <Field label="住所">
                <TInput value={form.address} onChange={v => f({ address: v })} placeholder="住所" />
              </Field>
              <Field label="地域">
                <TInput value={form.region} onChange={v => f({ region: v })} placeholder="地域" />
              </Field>
              <Field label="市区町村">
                <TInput value={form.locality} onChange={v => f({ locality: v })} placeholder="市区町村" />
              </Field>
              <Field label="市区町村カナ">
                <TInput value={form.locality_kana} onChange={v => f({ locality_kana: v })} placeholder="カタカナ" />
              </Field>
              <Field label="開業日">
                <TInput value={form.opened_at} onChange={v => f({ opened_at: v })} type="date" />
              </Field>
              <Field label="閉業日">
                <TInput value={form.closed_at} onChange={v => f({ closed_at: v })} type="date" />
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
                <input type="checkbox" checked={form.is_active} onChange={e => f({ is_active: e.target.checked })} className="accent-accent" />
                有効 (is_active)
              </label>
              <label className="flex items-center gap-2 text-xs text-text cursor-pointer">
                <input type="checkbox" checked={form.is_collection_day} onChange={e => f({ is_collection_day: e.target.checked })} className="accent-accent" />
                集金日対象 (is_collection_day)
              </label>
            </div>

            <div className="flex gap-2 mt-4">
              <div className="flex-1" />
              <button onClick={() => setModal(null)} className="px-3 py-1.5 rounded border border-border text-xs text-muted">
                キャンセル
              </button>
              <button
                data-testid="store-list-save-button"
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

      {detailStore && (
        <StoreCrudDrawer
          storeCode={detailStore.store_code}
          storeName={detailStore.store_name}
          onClose={() => setDetailStore(null)}
          onEditStore={() => { const s = detailStore; setDetailStore(null); openEdit(s) }}
        />
      )}
    </div>
  )
}
