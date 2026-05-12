import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const LIST_SELECT = 'machine_code,machine_name,play_price,is_active,maintenance_status,installed_at,store_code,stores!store_code(store_name)'
const EDIT_SELECT = LIST_SELECT + ',meter_per_play,meter_unit_price,out_meter_count,floor,zone,ownership_type,acquisition_cost,acquired_at,lease_monthly,lease_months,lease_end_date,billing_order,notes,created_at,organization_id'

const MAINTENANCE_VALUES = ['normal', 'needs_repair', 'in_repair', 'retired']
const OWNERSHIP_VALUES   = ['owned', 'leased', 'rental']

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted whitespace-nowrap">{label}</span>
      {children}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder, readOnly, className = '' }) {
  return (
    <input
      type={type}
      readOnly={readOnly}
      value={value ?? ''}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={`bg-bg border border-border rounded px-2 py-1 text-xs text-text w-full ${readOnly ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
    />
  )
}

function FSelect({ value, onChange, options, emptyLabel = 'ALL' }) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className="bg-bg border border-border rounded px-2 py-1 text-xs text-text"
    >
      <option value="">{emptyLabel}</option>
      {options.map(o => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}
    </select>
  )
}

export default function AdminMasterMachinePage() {
  const { staffName } = useAuth()
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [stores, setStores]       = useState([])
  const [storeFilter, setStore]   = useState('')
  const [maintFilter, setMaint]   = useState('')
  const [activeFilter, setActive] = useState('')
  const [search, setSearch]       = useState('')
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState({})
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [loadKey, setLoadKey]     = useState(0)

  useEffect(() => {
    supabase.from('stores').select('store_code,store_name').order('store_code')
      .then(({ data }) => setStores(data ?? []))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function load() {
      let q = supabase
        .from('machines')
        .select(LIST_SELECT)
        .order('store_code', { ascending: true })
        .order('billing_order', { ascending: true, nullsLast: true })
      if (storeFilter)         q = q.eq('store_code', storeFilter)
      if (maintFilter)         q = q.eq('maintenance_status', maintFilter)
      if (activeFilter !== '') q = q.eq('is_active', activeFilter === 'true')
      if (search.trim())       q = q.or(`machine_code.ilike.%${search}%,machine_name.ilike.%${search}%`)
      const { data, error: loadErr } = await q
      if (!cancelled) {
        if (loadErr) setError(loadErr.message)
        else { setRows(data ?? []); setError(null) }
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [storeFilter, maintFilter, activeFilter, search, loadKey])

  function openModal(row) {
    supabase.from('machines').select(EDIT_SELECT).eq('machine_code', row.machine_code).single()
      .then(({ data }) => {
        if (!data) return
        setForm({ ...data, store_name: data.stores?.store_name ?? '' })
        setModal(data)
        setError(null)
      })
  }

  function setF(k) { return v => setForm(f => ({ ...f, [k]: v })) }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const num = v => (v !== '' && v != null) ? Number(v) : null
    const str = v => v || null
    const patch = {
      machine_name:       form.machine_name,
      play_price:         num(form.play_price),
      meter_per_play:     num(form.meter_per_play),
      meter_unit_price:   num(form.meter_unit_price),
      out_meter_count:    num(form.out_meter_count),
      floor:              str(form.floor),
      zone:               str(form.zone),
      notes:              str(form.notes),
      ownership_type:     str(form.ownership_type),
      acquisition_cost:   num(form.acquisition_cost),
      acquired_at:        str(form.acquired_at),
      lease_monthly:      num(form.lease_monthly),
      lease_months:       num(form.lease_months),
      lease_end_date:     str(form.lease_end_date),
      maintenance_status: str(form.maintenance_status),
      billing_order:      num(form.billing_order),
      is_active:          form.is_active,
      updated_at:         new Date().toISOString(),
      updated_by:         staffName || null,
    }
    const { error: saveErr } = await supabase
      .from('machines')
      .update(patch)
      .eq('machine_code', modal.machine_code)
    setSaving(false)
    if (saveErr) { setError(saveErr.message); return }
    setModal(null)
    setLoadKey(k => k + 1)
  }

  return (
    <div data-testid="machine-master-page" className="flex flex-col" style={{ height: 'calc(100dvh - 80px)' }}>
      {/* toolbar */}
      <div className="flex-shrink-0 p-3 pb-2 flex flex-wrap gap-2 items-center border-b border-border">
        <input
          data-testid="machine-search"
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="機械コード / 機械名"
          className="bg-bg border border-border rounded px-2 py-1 text-xs text-text w-44"
        />
        <select
          data-testid="machine-filter-store"
          value={storeFilter} onChange={e => setStore(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-xs text-text"
        >
          <option value="">全店</option>
          {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
        </select>
        <FSelect value={maintFilter} onChange={setMaint}
          options={MAINTENANCE_VALUES.map(v => ({ v, l: v }))} />
        <FSelect value={activeFilter} onChange={setActive}
          options={[{ v: 'true', l: '稼働中' }, { v: 'false', l: '停止中' }]} />
        <span className="text-xs text-muted ml-auto">{rows.length}件</span>
      </div>

      {/* list */}
      <div className="flex-1 overflow-auto min-h-0">
        {error && <p className="text-red-400 text-xs p-3">{error}</p>}
        {loading && <p className="text-center text-muted text-xs py-8">読込中…</p>}
        {!loading && rows.length === 0 && <p className="text-center text-muted text-xs py-8">該当なし</p>}
        {!loading && rows.length > 0 && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg z-10">
              <tr className="border-b border-border text-muted">
                <th className="py-1 px-2 text-left whitespace-nowrap">機械コード</th>
                <th className="py-1 px-2 text-left whitespace-nowrap">機械名</th>
                <th className="py-1 px-2 text-left whitespace-nowrap">店舗</th>
                <th className="py-1 px-2 text-right whitespace-nowrap">料金</th>
                <th className="py-1 px-2 text-left whitespace-nowrap">メンテ</th>
                <th className="py-1 px-2 text-left whitespace-nowrap">設置日</th>
                <th className="py-1 px-2 text-center whitespace-nowrap">稼働</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.machine_code}
                  data-testid={`machine-row-${r.machine_code}`}
                  onClick={() => openModal(r)}
                  className="border-b border-border/50 hover:bg-surface cursor-pointer"
                >
                  <td className="py-1 px-2 font-mono">{r.machine_code}</td>
                  <td className="py-1 px-2">{r.machine_name ?? '—'}</td>
                  <td className="py-1 px-2 text-muted">{r.stores?.store_name ?? r.store_code}</td>
                  <td className="py-1 px-2 text-right">{r.play_price != null ? `¥${r.play_price}` : '—'}</td>
                  <td className="py-1 px-2 text-muted">{r.maintenance_status ?? '—'}</td>
                  <td className="py-1 px-2 text-muted">{r.installed_at ? r.installed_at.slice(0, 10) : '—'}</td>
                  <td className="py-1 px-2 text-center">{r.is_active ? '●' : '○'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* detail modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setModal(null)}>
          <form
            data-testid="machine-detail-modal"
            onSubmit={handleSave}
            onClick={e => e.stopPropagation()}
            className="bg-bg w-full max-w-lg rounded-t-2xl overflow-y-auto"
            style={{ maxHeight: '90dvh' }}
          >
            <div className="px-4 pt-4 pb-2 border-b border-border">
              <p className="text-base font-bold text-text">{form.machine_name || '—'}</p>
              <p className="text-xs text-muted font-mono">{modal.machine_code}</p>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {error && <p className="text-red-400 text-xs">{error}</p>}

              <div className="grid grid-cols-2 gap-3">
                <Field label="機械名">
                  <Input value={form.machine_name} onChange={setF('machine_name')} />
                </Field>
                <Field label="料金 (¥)">
                  <Input type="number" value={form.play_price} onChange={setF('play_price')} />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="単位価格">
                  <Input type="number" value={form.meter_unit_price} onChange={setF('meter_unit_price')} />
                </Field>
                <Field label="消費/1play">
                  <Input type="number" value={form.meter_per_play} onChange={setF('meter_per_play')} />
                </Field>
                <Field label="OUTメーター数">
                  <Input type="number" value={form.out_meter_count} onChange={setF('out_meter_count')} />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="店舗 (読取専用)">
                  <Input value={form.store_name || form.store_code} readOnly />
                </Field>
                <Field label="フロア">
                  <Input value={form.floor} onChange={setF('floor')} />
                </Field>
                <Field label="ゾーン">
                  <Input value={form.zone} onChange={setF('zone')} />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="所有形態">
                  <select
                    value={form.ownership_type ?? ''}
                    onChange={e => setF('ownership_type')(e.target.value)}
                    className="bg-bg border border-border rounded px-2 py-1 text-xs text-text"
                  >
                    <option value="">—</option>
                    {OWNERSHIP_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label="取得費 (¥)">
                  <Input type="number" value={form.acquisition_cost} onChange={setF('acquisition_cost')} />
                </Field>
                <Field label="取得日">
                  <Input type="date" value={form.acquired_at ? form.acquired_at.slice(0, 10) : ''} onChange={setF('acquired_at')} />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="リース月額 (¥)">
                  <Input type="number" value={form.lease_monthly} onChange={setF('lease_monthly')} />
                </Field>
                <Field label="リース月数">
                  <Input type="number" value={form.lease_months} onChange={setF('lease_months')} />
                </Field>
                <Field label="リース終了日">
                  <Input type="date" value={form.lease_end_date ? form.lease_end_date.slice(0, 10) : ''} onChange={setF('lease_end_date')} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="メンテ状況">
                  <select
                    value={form.maintenance_status ?? ''}
                    onChange={e => setF('maintenance_status')(e.target.value)}
                    className="bg-bg border border-border rounded px-2 py-1 text-xs text-text"
                  >
                    <option value="">—</option>
                    {MAINTENANCE_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label="並び順">
                  <Input type="number" value={form.billing_order} onChange={setF('billing_order')} />
                </Field>
              </div>

              <label className="flex items-center gap-1.5 text-xs text-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active ?? false}
                  onChange={e => setF('is_active')(e.target.checked)}
                  className="accent-blue-500"
                />
                稼働中
              </label>

              <Field label="備考">
                <textarea
                  value={form.notes ?? ''}
                  onChange={e => setF('notes')(e.target.value)}
                  rows={2}
                  className="bg-bg border border-border rounded px-2 py-1 text-xs text-text w-full resize-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3 text-[10px] text-muted">
                <span>コード: {modal.machine_code}</span>
                <span>登録: {modal.created_at ? modal.created_at.slice(0, 10) : '—'}</span>
              </div>
            </div>

            <div className="px-4 pb-6 flex gap-2">
              <button type="button" onClick={() => setModal(null)}
                className="flex-1 py-2 rounded-lg bg-surface text-text text-sm font-bold">
                キャンセル
              </button>
              <button type="submit" data-testid="machine-save-button"
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-40">
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
