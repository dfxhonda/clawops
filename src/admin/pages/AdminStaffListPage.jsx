import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

// IMPORTANT: pin and pin_hash must NEVER appear in any SELECT query
const LIST_SELECT = 'staff_id,name,name_kana,role,has_pin,is_active,joined_at,store_code,stores!store_code(store_name)'
const EDIT_SELECT = LIST_SELECT + ',email,phone,has_vehicle_stock,notes,created_at,organization_id'

const ROLE_VALUES = ['admin', 'manager', 'patrol', 'staff']

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted whitespace-nowrap">{label}</span>
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
      className={`bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full ${readOnly ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
    />
  )
}

function RoleBadge({ role }) {
  const colors = {
    admin:   'bg-purple-600 text-white',
    manager: 'bg-blue-600 text-white',
    patrol:  'bg-green-600 text-white',
    staff:   'bg-gray-600 text-white',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${colors[role] ?? 'bg-gray-500 text-white'}`}>
      {role ?? '—'}
    </span>
  )
}

export default function AdminStaffListPage() {
  const { staffName } = useAuth()
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [stores, setStores]       = useState([])
  const [storeFilter, setStore]   = useState('')
  const [roleFilter, setRole]     = useState('')
  const [activeFilter, setActive] = useState('')
  const [search, setSearch]       = useState('')
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState({})
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [loadKey, setLoadKey]     = useState(0)
  const [pinConfirm, setPinConfirm] = useState(false)
  const [pinResetting, setPinResetting] = useState(false)
  const [gridMode, setGridMode] = useState(false)
  const [gridEdits, setGridEdits] = useState({})
  const [gridSaving, setGridSaving] = useState(false)

  useEffect(() => {
    supabase.from('stores').select('store_code,store_name').order('store_code')
      .then(({ data }) => setStores(data ?? []))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function load() {
      let q = supabase
        .from('staff')
        .select(LIST_SELECT)
        .order('name_kana', { ascending: true, nullsLast: true })
      if (storeFilter)         q = q.eq('store_code', storeFilter)
      if (roleFilter)          q = q.eq('role', roleFilter)
      if (activeFilter !== '') q = q.eq('is_active', activeFilter === 'true')
      if (search.trim())       q = q.or(`name.ilike.%${search}%,name_kana.ilike.%${search}%`)
      const { data, error: loadErr } = await q
      if (!cancelled) {
        if (loadErr) setError(loadErr.message)
        else { setRows(data ?? []); setError(null) }
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [storeFilter, roleFilter, activeFilter, search, loadKey])

  function openModal(row) {
    supabase.from('staff').select(EDIT_SELECT).eq('staff_id', row.staff_id).single()
      .then(({ data }) => {
        if (!data) return
        setForm({ ...data, store_name: data.stores?.store_name ?? '' })
        setModal(data)
        setError(null)
        setPinConfirm(false)
      })
  }

  function setF(k) { return v => setForm(f => ({ ...f, [k]: v })) }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const str = v => v || null
    const patch = {
      name:              form.name,
      name_kana:         str(form.name_kana),
      email:             str(form.email),
      phone:             str(form.phone),
      role:              str(form.role),
      store_code:        str(form.store_code),
      has_vehicle_stock: form.has_vehicle_stock ?? false,
      is_active:         form.is_active,
      joined_at:         str(form.joined_at),
      notes:             str(form.notes),
      updated_at:        new Date().toISOString(),
      updated_by:        staffName || null,
    }
    const { error: saveErr } = await supabase
      .from('staff')
      .update(patch)
      .eq('staff_id', modal.staff_id)
    setSaving(false)
    if (saveErr) { setError(saveErr.message); return }
    setModal(null)
    setLoadKey(k => k + 1)
  }

  async function handlePinReset() {
    setPinResetting(true)
    setError(null)
    const { error: pinErr } = await supabase
      .from('staff')
      .update({ pin: null, has_pin: false, updated_at: new Date().toISOString() })
      .eq('staff_id', modal.staff_id)
    setPinResetting(false)
    if (pinErr) { setError(pinErr.message); return }
    setForm(f => ({ ...f, has_pin: false }))
    setPinConfirm(false)
    setLoadKey(k => k + 1)
  }

  const gridCellCls = "w-full h-7 px-1.5 bg-transparent border-0 text-text text-sm outline-none focus:bg-surface rounded [color-scheme:dark]"

  function setGCell(id, key, val) {
    setGridEdits(prev => {
      const row = rows.find(r => r.staff_id === id)
      const base = prev[id] ?? {
        name: row?.name ?? '',
        name_kana: row?.name_kana ?? '',
        role: row?.role ?? '',
        store_code: row?.store_code ?? '',
        is_active: row?.is_active ?? true,
      }
      return { ...prev, [id]: { ...base, [key]: val } }
    })
  }

  async function saveGridEdits() {
    setGridSaving(true)
    const now = new Date().toISOString()
    for (const [id, ge] of Object.entries(gridEdits)) {
      const { error: ge_err } = await supabase.from('staff').update({
        name: ge.name,
        name_kana: ge.name_kana || null,
        role: ge.role || null,
        store_code: ge.store_code || null,
        is_active: ge.is_active,
        updated_at: now,
        updated_by: staffName || null,
      }).eq('staff_id', id)
      if (ge_err) { setError(ge_err.message); setGridSaving(false); return }
    }
    setGridSaving(false)
    setGridEdits({})
    setLoadKey(k => k + 1)
  }

  return (
    <div data-testid="staff-list-page" className="flex flex-col" style={{ height: 'calc(100dvh - 80px)' }}>
      {/* toolbar */}
      <div className="flex-shrink-0 p-3 pb-2 flex flex-wrap gap-2 items-center border-b border-border">
        <input
          data-testid="staff-search"
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="氏名 / 氏名カナ"
          className="bg-bg border border-border rounded px-2 py-1 text-sm text-text w-40"
        />
        <select
          data-testid="staff-filter-store"
          value={storeFilter} onChange={e => setStore(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
        >
          <option value="">全店</option>
          {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
        </select>
        <select
          data-testid="staff-filter-role"
          value={roleFilter} onChange={e => setRole(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
        >
          <option value="">全ロール</option>
          {ROLE_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select
          data-testid="staff-filter-active"
          value={activeFilter} onChange={e => setActive(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
        >
          <option value="">全</option>
          <option value="true">在籍中</option>
          <option value="false">退職済</option>
        </select>
        <span className="text-sm text-muted ml-auto">{rows.length}件</span>
        <button
          onClick={() => { setGridMode(m => !m); setGridEdits({}) }}
          className={`px-3 py-1 rounded text-sm font-bold whitespace-nowrap border ${gridMode ? 'bg-amber-600 text-white border-transparent' : 'border-border text-muted'}`}
        >
          {gridMode ? '⊞ 表編集中' : '⊞ 表編集'}
        </button>
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
      <div className="flex-1 overflow-auto min-h-0">
        {error && <p className="text-red-400 text-sm p-3">{error}</p>}
        {loading && <p className="text-center text-muted text-sm py-8">読込中…</p>}
        {!loading && rows.length === 0 && <p className="text-center text-muted text-sm py-8">該当なし</p>}
        {!loading && rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-bg z-10">
              <tr className="border-b border-border text-muted">
                <th className="py-1 px-2 text-left whitespace-nowrap">氏名</th>
                <th className="py-1 px-2 text-left whitespace-nowrap">カナ</th>
                <th className="py-1 px-2 text-left whitespace-nowrap">ロール</th>
                <th className="py-1 px-2 text-left whitespace-nowrap">店舗</th>
                <th className="py-1 px-2 text-center whitespace-nowrap">PIN済</th>
                <th className="py-1 px-2 text-left whitespace-nowrap">入社日</th>
                <th className="py-1 px-2 text-center whitespace-nowrap">在籍</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const ge = gridEdits[r.staff_id]
                return (
                  <tr
                    key={r.staff_id}
                    data-testid={`staff-row-${r.staff_id}`}
                    onClick={gridMode ? undefined : () => openModal(r)}
                    className={`border-b border-border/50 ${gridMode ? (ge ? 'bg-amber-900/15' : 'hover:bg-surface/30') : 'hover:bg-surface cursor-pointer'}`}
                  >
                    <td className="py-0.5 px-1 font-bold">
                      {gridMode ? <input value={ge?.name ?? r.name ?? ''} onChange={ev => setGCell(r.staff_id, 'name', ev.target.value)} className={gridCellCls} /> : r.name}
                    </td>
                    <td className="py-0.5 px-1 text-muted">
                      {gridMode ? <input value={ge?.name_kana ?? r.name_kana ?? ''} onChange={ev => setGCell(r.staff_id, 'name_kana', ev.target.value)} className={gridCellCls} /> : (r.name_kana ?? '—')}
                    </td>
                    <td className="py-0.5 px-1">
                      {gridMode
                        ? <select value={ge?.role ?? r.role ?? ''} onChange={ev => setGCell(r.staff_id, 'role', ev.target.value)} className="h-7 px-1 bg-bg border border-border/50 text-text text-sm rounded w-full [color-scheme:dark]">
                            <option value="">—</option>
                            {ROLE_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        : <RoleBadge role={r.role} />}
                    </td>
                    <td className="py-0.5 px-1 text-muted">
                      {gridMode
                        ? <select value={ge?.store_code ?? r.store_code ?? ''} onChange={ev => setGCell(r.staff_id, 'store_code', ev.target.value)} className="h-7 px-1 bg-bg border border-border/50 text-text text-sm rounded w-full [color-scheme:dark]">
                            <option value="">—</option>
                            {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
                          </select>
                        : (r.stores?.store_name ?? r.store_code ?? '—')}
                    </td>
                    <td className="py-1 px-2 text-center">{r.has_pin ? '●' : '○'}</td>
                    <td className="py-1 px-2 text-muted">{r.joined_at ? r.joined_at.slice(0, 10) : '—'}</td>
                    <td className="py-0.5 px-1 text-center">
                      {gridMode
                        ? <input type="checkbox" checked={ge?.is_active ?? r.is_active ?? false} onChange={ev => setGCell(r.staff_id, 'is_active', ev.target.checked)} className="accent-blue-500" />
                        : (r.is_active ? '●' : '○')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* detail modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setModal(null)}>
          <form
            data-testid="staff-detail-modal"
            onSubmit={handleSave}
            onClick={e => e.stopPropagation()}
            className="bg-bg w-full max-w-lg rounded-t-2xl overflow-y-auto"
            style={{ maxHeight: '90dvh' }}
          >
            <div className="px-4 pt-4 pb-2 border-b border-border flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-text">{form.name || '—'}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <RoleBadge role={form.role} />
                  <span className="text-xs text-muted">
                    {form.has_pin ? 'PIN設定済' : 'PIN未設定'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="grid grid-cols-2 gap-3">
                <Field label="氏名">
                  <Input value={form.name} onChange={setF('name')} />
                </Field>
                <Field label="氏名カナ">
                  <Input value={form.name_kana} onChange={setF('name_kana')} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="メール">
                  <Input type="email" value={form.email} onChange={setF('email')} />
                </Field>
                <Field label="電話">
                  <Input type="tel" value={form.phone} onChange={setF('phone')} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="ロール">
                  <select
                    value={form.role ?? ''}
                    onChange={e => setF('role')(e.target.value)}
                    className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
                  >
                    <option value="">—</option>
                    {ROLE_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label="所属店舗">
                  <select
                    value={form.store_code ?? ''}
                    onChange={e => setF('store_code')(e.target.value)}
                    className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
                  >
                    <option value="">—</option>
                    {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="入社日">
                  <Input type="date" value={form.joined_at ? form.joined_at.slice(0, 10) : ''} onChange={setF('joined_at')} />
                </Field>
                <div className="flex flex-col gap-1 justify-end">
                  <label className="flex items-center gap-1.5 text-sm text-text cursor-pointer">
                    <input type="checkbox" checked={form.is_active ?? false}
                      onChange={e => setF('is_active')(e.target.checked)} className="accent-blue-500" />
                    在籍中
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-text cursor-pointer">
                    <input type="checkbox" checked={form.has_vehicle_stock ?? false}
                      onChange={e => setF('has_vehicle_stock')(e.target.checked)} className="accent-blue-500" />
                    車両在庫有
                  </label>
                </div>
              </div>

              <Field label="備考">
                <textarea
                  value={form.notes ?? ''}
                  onChange={e => setF('notes')(e.target.value)}
                  rows={2}
                  className="bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full resize-none"
                />
              </Field>

              <div className="text-xs text-muted font-mono">
                スタッフID: {modal.staff_id}
              </div>
            </div>

            <div className="px-4 pb-2 flex gap-2">
              <button type="button" onClick={() => setModal(null)}
                className="flex-1 py-2 rounded-lg bg-surface text-text text-sm font-bold">
                キャンセル
              </button>
              <button type="submit" data-testid="staff-save-button"
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-40">
                {saving ? '保存中…' : '保存'}
              </button>
            </div>

            {/* PIN reset */}
            <div className="px-4 pb-6 border-t border-border pt-3">
              {!pinConfirm ? (
                <button
                  type="button"
                  data-testid="pin-reset-button"
                  onClick={() => setPinConfirm(true)}
                  className="w-full py-2 rounded-lg bg-rose-600/20 text-rose-400 border border-rose-600/40 text-sm font-bold"
                >
                  PINリセット
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-rose-400 text-center">PINをリセットしますか？</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPinConfirm(false)}
                      className="flex-1 py-2 rounded-lg bg-surface text-text text-sm font-bold">
                      キャンセル
                    </button>
                    <button
                      type="button"
                      data-testid="pin-reset-confirm-button"
                      onClick={handlePinReset}
                      disabled={pinResetting}
                      className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold disabled:opacity-40"
                    >
                      {pinResetting ? 'リセット中…' : 'OK'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
