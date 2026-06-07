import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { writeAuditLog } from '../../services/audit'
import { logger } from '../../lib/logger'

// T2c-AdminStaffListPage-refactor:
// - UI-CHARTER-V2 準拠 (カード型 min-h 88px / role chips / + 新規追加 / 削除確認)
// - staff_stores 中間テーブルで複数店舗担当 (checkbox)
// - 全 CUD 操作 + PIN 操作を audit_logs + logger に記録
// - PIN ハッシュアルゴリズム不変 (既存リセットボタン流用、新規 set は実装範囲外)
// - staff テーブルスキーマ不変、ログイン画面不変
// - IMPORTANT: pin / pin_hash は SELECT クエリに絶対含めない

const LIST_SELECT = 'staff_id,name,name_kana,role,has_pin,is_active,joined_at,store_code,stores!store_code(store_name)'
const EDIT_SELECT = LIST_SELECT + ',email,phone,has_vehicle_stock,notes,created_at,organization_id'

const ROLE_VALUES = ['admin', 'manager', 'patrol', 'staff']
const ROLE_LABEL = { admin: '管理者', manager: '社員', patrol: '新人', staff: 'アルバイト' }

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
  // T2c spec.badge: 管理者=danger / 社員=primary / アルバイト=success / 新人=neutral
  const colors = {
    admin:   'bg-red-600 text-white',
    manager: 'bg-blue-600 text-white',
    staff:   'bg-green-600 text-white',
    patrol:  'bg-gray-500 text-white',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${colors[role] ?? 'bg-gray-500 text-white'}`}>
      {ROLE_LABEL[role] ?? role ?? '—'}
    </span>
  )
}

export default function AdminStaffListPage() {
  const { staffId, staffName } = useAuth()
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [stores, setStores]       = useState([])
  const [storeFilter, setStore]   = useState('')
  const [roleFilter, setRole]     = useState('')
  const [activeFilter, setActive] = useState('')
  const [search, setSearch]       = useState('')
  const [sortKey, setSortKey]     = useState('name_kana')
  const [modal, setModal]         = useState(null) // existing row or { __new: true }
  const [form, setForm]           = useState({})
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [loadKey, setLoadKey]     = useState(0)
  const [pinConfirm, setPinConfirm] = useState(false)
  const [pinResetting, setPinResetting] = useState(false)
  const [view, setView]           = useState('card') // 'card' | 'grid'
  const [gridEdits, setGridEdits] = useState({})
  const [gridSaving, setGridSaving] = useState(false)
  const [assignedStoreCounts, setAssignedStoreCounts] = useState({})
  const [editAssigned, setEditAssigned] = useState(new Set())
  const [editAssignedLoaded, setEditAssignedLoaded] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.from('stores').select('store_code,store_name,is_active').order('store_code')
      .then(({ data, error: e }) => {
        if (e) { logger.error('staff_list_fetch_error', { code: 'ERR-STAFF-001', subject: 'stores', message: e.message }); return }
        setStores(data ?? [])
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function load() {
      let q = supabase.from('staff').select(LIST_SELECT)
      if (sortKey === 'name_kana') q = q.order('name_kana', { ascending: true, nullsLast: true })
      else if (sortKey === 'role') q = q.order('role', { ascending: true, nullsLast: true })
      else if (sortKey === 'created_at') q = q.order('created_at', { ascending: false, nullsLast: true })
      if (storeFilter)         q = q.eq('store_code', storeFilter)
      if (roleFilter)          q = q.eq('role', roleFilter)
      if (activeFilter !== '') q = q.eq('is_active', activeFilter === 'true')
      if (search.trim())       q = q.or(`name.ilike.%${search}%,name_kana.ilike.%${search}%,role.ilike.%${search}%`)
      const { data, error: loadErr } = await q
      if (cancelled) return
      if (loadErr) {
        setError(loadErr.message)
        logger.error('staff_list_fetch_error', { code: 'ERR-STAFF-001', message: loadErr.message })
      } else {
        setRows(data ?? [])
        setError(null)
        logger.info('staff_list_fetch_success', { count: data?.length ?? 0 })
        if (data && data.length > 0) {
          const ids = data.map(r => r.staff_id)
          const { data: ss } = await supabase.from('staff_stores').select('staff_id,store_code').in('staff_id', ids)
          const counts = {}
          for (const r of ss ?? []) counts[r.staff_id] = (counts[r.staff_id] ?? 0) + 1
          if (!cancelled) setAssignedStoreCounts(counts)
        }
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [storeFilter, roleFilter, activeFilter, search, sortKey, loadKey])

  function openCreateModal() {
    setForm({
      name: '', name_kana: '', email: '', phone: '', role: 'staff',
      store_code: '', is_active: true, has_vehicle_stock: false,
      joined_at: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }),
      notes: '',
    })
    setEditAssigned(new Set())
    setEditAssignedLoaded(true)
    setModal({ __new: true, staff_id: null })
    setError(null)
    setPinConfirm(false)
  }

  function openModal(row) {
    supabase.from('staff').select(EDIT_SELECT).eq('staff_id', row.staff_id).maybeSingle()
      .then(async ({ data, error: e }) => {
        if (e) { setError(e.message); return }
        if (!data) { setError('スタッフ取得失敗 (該当行なし)'); return }
        setForm({ ...data, store_name: data.stores?.store_name ?? '' })
        setModal(data)
        setError(null)
        setPinConfirm(false)
        setEditAssignedLoaded(false)
        const { data: ss } = await supabase.from('staff_stores').select('store_code').eq('staff_id', row.staff_id)
        setEditAssigned(new Set((ss ?? []).map(r => r.store_code)))
        setEditAssignedLoaded(true)
      })
  }

  function setF(k) { return v => setForm(f => ({ ...f, [k]: v })) }

  function toggleAssigned(storeCode) {
    setEditAssigned(prev => {
      const next = new Set(prev)
      if (next.has(storeCode)) next.delete(storeCode)
      else next.add(storeCode)
      return next
    })
  }

  async function syncStaffStores(targetStaffId, before, after) {
    const removed = [...before].filter(c => !after.has(c))
    const added = [...after].filter(c => !before.has(c))
    if (removed.length > 0) {
      const { error: delErr } = await supabase.from('staff_stores').delete()
        .eq('staff_id', targetStaffId).in('store_code', removed)
      if (delErr) throw delErr
    }
    if (added.length > 0) {
      const now = new Date().toISOString()
      const insRows = added.map(c => ({
        id: `${targetStaffId}::${c}::${Date.now()}::${Math.random().toString(36).slice(2, 8)}`,
        staff_id: targetStaffId,
        store_code: c,
        is_primary: false,
        created_at: now,
        updated_at: now,
        updated_by: staffName || null,
      }))
      const { error: insErr } = await supabase.from('staff_stores').insert(insRows)
      if (insErr) throw insErr
    }
    if (removed.length > 0 || added.length > 0) {
      await writeAuditLog({
        staff_id: staffId || undefined,
        action: 'UPDATE',
        target_table: 'staff_stores',
        target_id: targetStaffId,
        detail: `staff_stores 同期: +${added.length} / -${removed.length}`,
        before_data: { stores: [...before] },
        after_data: { stores: [...after] },
      })
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name?.trim()) { setError('氏名は必須です'); return }
    if (modal.__new && !form.name_kana?.trim()) { setError('フリガナ(name_kana)は必須です'); return }
    setSaving(true)
    setError(null)
    const str = v => v || null
    const now = new Date().toISOString()
    try {
      if (modal.__new) {
        const { data: maxRow } = await supabase.from('staff')
          .select('staff_id').like('staff_id', 'STAFF-%').order('staff_id', { ascending: false }).limit(1)
        const last = maxRow?.[0]?.staff_id ?? 'STAFF-00'
        const num = parseInt(String(last).replace(/^STAFF-?/, ''), 10) || 0
        const nextId = `STAFF-${String(num + 1).padStart(2, '0')}`
        const payload = {
          staff_id: nextId,
          // organization_id: DB DEFAULT default_org_id() に委ねる (J-STAFF-ORGID-DEVELOP-SYNC-01)
          name: form.name.trim(),
          name_kana: str(form.name_kana),
          email: str(form.email),
          phone: str(form.phone),
          role: str(form.role),
          store_code: str(form.store_code),
          has_vehicle_stock: form.has_vehicle_stock ?? false,
          is_active: form.is_active ?? true,
          joined_at: str(form.joined_at),
          notes: str(form.notes),
          created_at: now,
          updated_at: now,
          updated_by: staffName || null,
        }
        const { error: insErr } = await supabase.from('staff').insert(payload)
        if (insErr) throw insErr
        await syncStaffStores(nextId, new Set(), editAssigned)
        await writeAuditLog({
          staff_id: staffId || undefined,
          action: 'INSERT',
          target_table: 'staff',
          target_id: nextId,
          detail: `スタッフ新規作成: ${payload.name} (${payload.role ?? '-'})`,
          before_data: null,
          after_data: { ...payload, pin: undefined, pin_hash: undefined },
        })
        logger.info('staff_create_success', { staff_id: nextId, role: payload.role })
      } else {
        const before = {
          name: modal.name, name_kana: modal.name_kana, email: modal.email,
          phone: modal.phone, role: modal.role, store_code: modal.store_code,
          has_vehicle_stock: modal.has_vehicle_stock, is_active: modal.is_active,
          joined_at: modal.joined_at, notes: modal.notes,
        }
        const patch = {
          name:              form.name.trim(),
          name_kana:         str(form.name_kana),
          email:             str(form.email),
          phone:             str(form.phone),
          role:              str(form.role),
          store_code:        str(form.store_code),
          has_vehicle_stock: form.has_vehicle_stock ?? false,
          is_active:         form.is_active,
          joined_at:         str(form.joined_at),
          notes:             str(form.notes),
          updated_at:        now,
          updated_by:        staffName || null,
        }
        const { error: saveErr } = await supabase.from('staff').update(patch).eq('staff_id', modal.staff_id)
        if (saveErr) throw saveErr
        const { data: ssBefore } = await supabase.from('staff_stores').select('store_code').eq('staff_id', modal.staff_id)
        const beforeSet = new Set((ssBefore ?? []).map(r => r.store_code))
        await syncStaffStores(modal.staff_id, beforeSet, editAssigned)
        await writeAuditLog({
          staff_id: staffId || undefined,
          action: 'UPDATE',
          target_table: 'staff',
          target_id: modal.staff_id,
          detail: `スタッフ更新: ${patch.name}`,
          before_data: before,
          after_data: patch,
        })
        logger.info('staff_update_success', { staff_id: modal.staff_id })
      }
      setModal(null)
      setLoadKey(k => k + 1)
    } catch (err) {
      setError(err.message)
      logger.error(modal?.__new ? 'staff_create_error' : 'staff_update_error',
        { code: modal?.__new ? 'ERR-STAFF-002' : 'ERR-STAFF-003', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handlePinReset() {
    setPinResetting(true)
    setError(null)
    try {
      const { error: pinErr } = await supabase.from('staff')
        .update({ pin: null, has_pin: false, updated_at: new Date().toISOString() })
        .eq('staff_id', modal.staff_id)
      if (pinErr) throw pinErr
      await writeAuditLog({
        staff_id: staffId || undefined,
        action: 'UPDATE',
        target_table: 'staff',
        target_id: modal.staff_id,
        detail: `PIN リセット: ${modal.name ?? ''}`,
      })
      logger.info('staff_pin_set_success', { staff_id: modal.staff_id, action: 'reset' })
      setForm(f => ({ ...f, has_pin: false }))
      setPinConfirm(false)
      setLoadKey(k => k + 1)
    } catch (err) {
      setError(err.message)
      logger.error('staff_pin_set_error', { code: 'ERR-STAFF-005', message: err.message })
    } finally {
      setPinResetting(false)
    }
  }

  async function startDelete() {
    if (!modal || modal.__new) return
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data, error: e } = await supabase.from('device_login_history')
      .select('staff_id,last_login_at')
      .eq('staff_id', modal.staff_id)
      .gte('last_login_at', since)
      .limit(1)
    if (e) { setError(e.message); return }
    setDeleteConfirm({ active_within_24h: (data?.length ?? 0) > 0 })
  }

  async function confirmDelete() {
    if (!modal || modal.__new) return
    setDeleting(true)
    setError(null)
    try {
      await supabase.from('staff_stores').delete().eq('staff_id', modal.staff_id)
      const { error: delErr } = await supabase.from('staff').delete().eq('staff_id', modal.staff_id)
      if (delErr) throw delErr
      await writeAuditLog({
        staff_id: staffId || undefined,
        action: 'DELETE',
        target_table: 'staff',
        target_id: modal.staff_id,
        detail: `スタッフ削除: ${modal.name ?? ''} (24h内ログイン=${deleteConfirm?.active_within_24h ? 'YES' : 'NO'})`,
        before_data: { staff_id: modal.staff_id, name: modal.name, role: modal.role },
        after_data: null,
      })
      logger.info('staff_delete_success', { staff_id: modal.staff_id })
      setDeleteConfirm(null)
      setModal(null)
      setLoadKey(k => k + 1)
    } catch (err) {
      setError(err.message)
      logger.error('staff_delete_error', { code: 'ERR-STAFF-004', message: err.message })
    } finally {
      setDeleting(false)
    }
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
    try {
      for (const [id, ge] of Object.entries(gridEdits)) {
        const before = rows.find(r => r.staff_id === id)
        const { error: ge_err } = await supabase.from('staff').update({
          name: ge.name,
          name_kana: ge.name_kana || null,
          role: ge.role || null,
          store_code: ge.store_code || null,
          is_active: ge.is_active,
          updated_at: now,
          updated_by: staffName || null,
        }).eq('staff_id', id)
        if (ge_err) throw ge_err
        await writeAuditLog({
          staff_id: staffId || undefined,
          action: 'UPDATE',
          target_table: 'staff',
          target_id: id,
          detail: `表編集一括保存: ${ge.name}`,
          before_data: before ? { name: before.name, name_kana: before.name_kana, role: before.role, store_code: before.store_code, is_active: before.is_active } : null,
          after_data: ge,
        })
      }
      setGridEdits({})
      setLoadKey(k => k + 1)
      logger.info('staff_update_success', { source: 'grid_bulk', count: Object.keys(gridEdits).length })
    } catch (err) {
      setError(err.message)
      logger.error('staff_update_error', { code: 'ERR-STAFF-003', source: 'grid_bulk', message: err.message })
    } finally {
      setGridSaving(false)
    }
  }

  return (
    <div data-testid="staff-list-page" className="flex flex-col" style={{ height: 'calc(100dvh - 80px)' }}>
      <div className="flex-shrink-0 p-3 pb-2 flex items-center gap-2 border-b border-border">
        <a href="/launcher" data-testid="staff-home-link" className="text-sm text-muted">← ホーム</a>
        <h1 className="text-base font-bold text-text">スタッフマスタ</h1>
        <span className="text-sm text-muted">{rows.length}件</span>
        <div className="flex-1" />
        <button
          data-testid="staff-create-button"
          onClick={openCreateModal}
          className="bg-blue-600 text-white text-sm font-bold rounded px-3 min-h-[40px]"
        >+ 新規追加</button>
      </div>

      <div className="flex-shrink-0 p-3 pb-2 flex flex-wrap gap-2 items-center border-b border-border">
        <input
          data-testid="staff-search"
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="氏名 / カナ / role"
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
          data-testid="staff-filter-active"
          value={activeFilter} onChange={e => setActive(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
        >
          <option value="">全</option>
          <option value="true">在籍中</option>
          <option value="false">退職済</option>
        </select>
        <select
          data-testid="staff-sort"
          value={sortKey} onChange={e => setSortKey(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
        >
          <option value="name_kana">名前順</option>
          <option value="role">ロール順</option>
          <option value="created_at">作成新しい順</option>
        </select>
        <button
          data-testid="staff-view-toggle"
          onClick={() => setView(v => v === 'card' ? 'grid' : 'card')}
          className="px-3 py-1 rounded text-sm font-bold whitespace-nowrap border border-border text-muted"
        >{view === 'card' ? '⊞ 表編集' : '▤ カード'}</button>
      </div>

      <div data-testid="staff-role-chips" className="flex-shrink-0 px-3 py-2 flex gap-2 flex-wrap border-b border-border">
        <button
          data-testid="role-chip-all"
          onClick={() => setRole('')}
          className={`px-3 min-h-[36px] rounded-full text-sm font-bold border ${roleFilter === '' ? 'bg-blue-600 text-white border-transparent' : 'border-border text-muted'}`}
        >全ロール</button>
        {ROLE_VALUES.map(v => (
          <button
            key={v}
            data-testid={`role-chip-${v}`}
            onClick={() => setRole(v)}
            className={`px-3 min-h-[36px] rounded-full text-sm font-bold border ${roleFilter === v ? 'bg-blue-600 text-white border-transparent' : 'border-border text-muted'}`}
          >{ROLE_LABEL[v]}</button>
        ))}
      </div>

      {view === 'grid' && Object.keys(gridEdits).length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 border-y border-amber-700/40">
          <span className="text-sm text-amber-400">{Object.keys(gridEdits).length}件 変更あり</span>
          <button onClick={() => setGridEdits({})} className="ml-auto text-sm text-muted px-2 py-1 rounded border border-border">取消</button>
          <button onClick={saveGridEdits} disabled={gridSaving} className="text-sm text-white bg-blue-600 px-3 py-1 rounded font-bold disabled:opacity-50">
            {gridSaving ? '保存中…' : '一括保存'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto min-h-0">
        {error && <p data-testid="staff-error" className="text-red-400 text-sm p-3">{error}</p>}
        {loading && <p className="text-center text-muted text-sm py-8">読込中…</p>}
        {!loading && rows.length === 0 && <p className="text-center text-muted text-sm py-8">該当なし</p>}

        {!loading && rows.length > 0 && view === 'card' && (
          <ul className="px-3 py-2 space-y-2">
            {rows.map(r => (
              <li
                key={r.staff_id}
                data-testid={`staff-card-${r.staff_id}`}
                onClick={() => openModal(r)}
                className="bg-surface border border-border rounded-xl p-3 cursor-pointer hover:bg-surface/80 active:ring-2 active:ring-blue-500"
                style={{ minHeight: 88 }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[20px] font-bold text-text truncate">{r.name}</p>
                    <p className="text-xs text-muted truncate">{r.name_kana ?? '—'}</p>
                  </div>
                  <RoleBadge role={r.role} />
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-muted">
                  <span>担当 {assignedStoreCounts[r.staff_id] ?? 0} 店</span>
                  <span>主店舗 {r.stores?.store_name ?? r.store_code ?? '—'}</span>
                  {r.has_pin && (
                    <span data-testid={`pin-badge-${r.staff_id}`} className="bg-green-700 text-white px-1.5 rounded">PIN済</span>
                  )}
                  {!r.is_active && <span className="bg-gray-600 text-white px-1.5 rounded">退職済</span>}
                  {r.joined_at && <span>入社 {String(r.joined_at).slice(0, 10)}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && rows.length > 0 && view === 'grid' && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-bg z-10">
              <tr className="border-b border-border text-muted">
                <th className="py-1 px-2 text-left whitespace-nowrap">氏名</th>
                <th className="py-1 px-2 text-left whitespace-nowrap">カナ</th>
                <th className="py-1 px-2 text-left whitespace-nowrap">ロール</th>
                <th className="py-1 px-2 text-left whitespace-nowrap">主店舗</th>
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
                    className={`border-b border-border/50 ${ge ? 'bg-amber-900/15' : 'hover:bg-surface/30'}`}
                  >
                    <td className="py-0.5 px-1 font-bold">
                      <input value={ge?.name ?? r.name ?? ''} onChange={ev => setGCell(r.staff_id, 'name', ev.target.value)} className={gridCellCls} />
                    </td>
                    <td className="py-0.5 px-1 text-muted">
                      <input value={ge?.name_kana ?? r.name_kana ?? ''} onChange={ev => setGCell(r.staff_id, 'name_kana', ev.target.value)} className={gridCellCls} />
                    </td>
                    <td className="py-0.5 px-1">
                      <select value={ge?.role ?? r.role ?? ''} onChange={ev => setGCell(r.staff_id, 'role', ev.target.value)} className="h-7 px-1 bg-bg border border-border/50 text-text text-sm rounded w-full [color-scheme:dark]">
                        <option value="">—</option>
                        {ROLE_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </td>
                    <td className="py-0.5 px-1 text-muted">
                      <select value={ge?.store_code ?? r.store_code ?? ''} onChange={ev => setGCell(r.staff_id, 'store_code', ev.target.value)} className="h-7 px-1 bg-bg border border-border/50 text-text text-sm rounded w-full [color-scheme:dark]">
                        <option value="">—</option>
                        {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
                      </select>
                    </td>
                    <td className="py-1 px-2 text-center">{r.has_pin ? '●' : '○'}</td>
                    <td className="py-1 px-2 text-muted">{r.joined_at ? String(r.joined_at).slice(0, 10) : '—'}</td>
                    <td className="py-0.5 px-1 text-center">
                      <input type="checkbox" checked={ge?.is_active ?? r.is_active ?? false} onChange={ev => setGCell(r.staff_id, 'is_active', ev.target.checked)} className="accent-blue-500" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => { if (!deleteConfirm) setModal(null) }}>
          <form
            data-testid="staff-detail-modal"
            onSubmit={handleSave}
            onClick={e => e.stopPropagation()}
            className="bg-bg w-full max-w-lg rounded-t-2xl overflow-y-auto"
            style={{ maxHeight: '90dvh' }}
          >
            <div className="px-4 pt-4 pb-2 border-b border-border flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-text">{modal.__new ? '新規スタッフ追加' : (form.name || '—')}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <RoleBadge role={form.role} />
                  <span className="text-xs text-muted">{form.has_pin ? 'PIN設定済' : 'PIN未設定'}</span>
                </div>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="grid grid-cols-2 gap-3">
                <Field label="氏名"><Input value={form.name} onChange={setF('name')} /></Field>
                <Field label="氏名カナ"><Input value={form.name_kana} onChange={setF('name_kana')} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="メール"><Input type="email" value={form.email} onChange={setF('email')} /></Field>
                <Field label="電話"><Input type="tel" value={form.phone} onChange={setF('phone')} /></Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="ロール">
                  <select value={form.role ?? ''} onChange={e => setF('role')(e.target.value)} className="bg-bg border border-border rounded px-2 py-1 text-sm text-text">
                    <option value="">—</option>
                    {ROLE_VALUES.map(v => <option key={v} value={v}>{ROLE_LABEL[v]}</option>)}
                  </select>
                </Field>
                <Field label="主店舗 (任意)">
                  <select value={form.store_code ?? ''} onChange={e => setF('store_code')(e.target.value)} className="bg-bg border border-border rounded px-2 py-1 text-sm text-text">
                    <option value="">—</option>
                    {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="入社日">
                  <Input type="date" value={form.joined_at ? String(form.joined_at).slice(0, 10) : ''} onChange={setF('joined_at')} />
                </Field>
                <div className="flex flex-col gap-1 justify-end">
                  <label className="flex items-center gap-1.5 text-sm text-text cursor-pointer">
                    <input type="checkbox" checked={form.is_active ?? false} onChange={e => setF('is_active')(e.target.checked)} className="accent-blue-500" />
                    在籍中
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-text cursor-pointer">
                    <input type="checkbox" checked={form.has_vehicle_stock ?? false} onChange={e => setF('has_vehicle_stock')(e.target.checked)} className="accent-blue-500" />
                    車両在庫有
                  </label>
                </div>
              </div>

              <Field label="備考">
                <textarea value={form.notes ?? ''} onChange={e => setF('notes')(e.target.value)} rows={2}
                  className="bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full resize-none" />
              </Field>

              <Field label={`担当店舗 (${editAssigned.size}店)`}>
                {!editAssignedLoaded ? (
                  <span className="text-xs text-muted">読込中…</span>
                ) : (
                  <div data-testid="staff-assigned-stores" className="border border-border rounded p-2 max-h-40 overflow-y-auto grid grid-cols-2 gap-1">
                    {stores.filter(s => s.is_active !== false).map(s => (
                      <label key={s.store_code} className="flex items-center gap-1.5 text-xs text-text">
                        <input
                          type="checkbox"
                          data-testid={`staff-store-cb-${s.store_code}`}
                          checked={editAssigned.has(s.store_code)}
                          onChange={() => toggleAssigned(s.store_code)}
                          className="accent-blue-500"
                        />
                        {s.store_name}
                      </label>
                    ))}
                  </div>
                )}
              </Field>

              {!modal.__new && (
                <div className="text-xs text-muted font-mono">スタッフID: {modal.staff_id}</div>
              )}
            </div>

            <div className="px-4 pb-2 flex gap-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg bg-surface text-text text-sm font-bold">キャンセル</button>
              <button type="submit" data-testid="staff-save-button" disabled={saving} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-40">
                {saving ? '保存中…' : '保存'}
              </button>
            </div>

            {!modal.__new && (
              <div className="px-4 pb-6 border-t border-border pt-3 flex flex-col gap-2">
                {!pinConfirm ? (
                  <button type="button" data-testid="pin-reset-button" onClick={() => setPinConfirm(true)} className="w-full py-2 rounded-lg bg-rose-600/20 text-rose-400 border border-rose-600/40 text-sm font-bold">
                    PIN リセット
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-rose-400 text-center">PIN をリセットしますか？</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPinConfirm(false)} className="flex-1 py-2 rounded-lg bg-surface text-text text-sm font-bold">キャンセル</button>
                      <button type="button" data-testid="pin-reset-confirm-button" onClick={handlePinReset} disabled={pinResetting} className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold disabled:opacity-40">
                        {pinResetting ? 'リセット中…' : 'OK'}
                      </button>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  data-testid="staff-delete-button"
                  onClick={startDelete}
                  className="w-full py-2 rounded-lg bg-red-700 text-white text-sm font-bold"
                >このスタッフを削除</button>
              </div>
            )}
          </form>
        </div>
      )}

      {deleteConfirm && modal && (
        <div
          data-testid="staff-delete-backdrop"
          onClick={() => setDeleteConfirm(null)}
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center px-4"
        >
          <div
            data-testid="staff-delete-dialog"
            onClick={e => e.stopPropagation()}
            className="bg-bg border border-border rounded-xl p-4 w-full max-w-xs"
          >
            <p className="text-base text-text">スタッフを削除しますか？</p>
            <p className="text-xs text-muted mt-1 truncate">{modal.name} ({modal.staff_id})</p>
            {deleteConfirm.active_within_24h && (
              <p data-testid="staff-delete-warning" className="mt-2 text-xs text-amber-400">
                ⚠ 24時間以内にログイン履歴があります。本当に削除しますか？
              </p>
            )}
            <div className="mt-4 flex gap-2 justify-end">
              <button data-testid="staff-delete-cancel" onClick={() => setDeleteConfirm(null)} className="px-4 min-h-[44px] rounded-lg border border-border text-text text-sm">キャンセル</button>
              <button data-testid="staff-delete-confirm" onClick={confirmDelete} disabled={deleting} className="px-4 min-h-[44px] rounded-lg bg-red-600 text-white text-sm font-bold disabled:opacity-50">
                {deleting ? '削除中…' : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
