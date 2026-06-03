import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHierarchicalBack } from '../../shared/nav/hierarchicalBack' // J-NAV-BACK-HIERARCHICAL-01
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { logger } from '../../lib/logger'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'

const TYPE_OPTIONS = ['crane', 'gacha', 'other']
const TYPE_LABELS  = { crane: 'クレーン', gacha: 'ガチャ', other: 'その他' }

const SORT_OPTIONS = [
  { v: 'name_asc',    l: '名前 ↑' },
  { v: 'name_desc',   l: '名前 ↓' },
  { v: 'newest',      l: '登録日 新' },
  { v: 'oldest',      l: '登録日 古' },
]

const EMPTY_FORM = {
  model_name: '', type_id: 'crane', meter_unit_price: 100,
  in_meter_count: 1, out_meter_count: 1, manufacturer: '', notes: '',
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 min-h-[88px] flex items-center gap-3 animate-pulse">
      <div className="flex-1 space-y-2">
        <div className="h-5 bg-surface rounded w-2/5" />
        <div className="h-4 bg-surface rounded w-1/3" />
      </div>
    </div>
  )
}

async function insertAuditLog({ staffId, action, targetId, before, after }) {
  try {
    await supabase.from('operation_logs').insert({
      staff_id: staffId,
      action,
      target_id: targetId,
      target_table: 'machine_models',
      before_data: before ?? null,
      after_data: after ?? null,
      detail: 'AdminMasterMachinePage',
      organization_id: DFX_ORG_ID,
    })
  } catch {}
}

export default function AdminMasterMachinePage() {
  const navigate = useNavigate()
  const goBack = useHierarchicalBack() // J-NAV-BACK-HIERARCHICAL-01
  const { staffName, staffId } = useAuth()

  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [loadKey, setLoadKey] = useState(0)

  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sort, setSort]             = useState('name_asc')

  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState(null)

  const [deleteTarget, setDeleteTarget]       = useState(null)
  const [deleteUsageCount, setDeleteUsageCount] = useState(0)
  const [deleting, setDeleting]               = useState(false)
  const [gridMode, setGridMode] = useState(false)
  const [gridEdits, setGridEdits] = useState({})
  const [gridSaving, setGridSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('machine_models')
      .select('model_id,model_name,type_id,manufacturer,meter_unit_price,in_meter_count,out_meter_count,notes,created_at')
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) {
          logger.error('machine_list_fetch_error', { code: 'ERR-MACHINE-001', err: e })
          setError('読み込みに失敗しました (ERR-MACHINE-001)')
        } else {
          setRows(data ?? [])
          setError(null)
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [loadKey])

  const filtered = useMemo(() => {
    let r = rows
    if (typeFilter) r = r.filter(m => m.type_id === typeFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      r = r.filter(m =>
        m.model_name?.toLowerCase().includes(q) ||
        m.manufacturer?.toLowerCase().includes(q)
      )
    }
    switch (sort) {
      case 'name_asc':  return [...r].sort((a, b) => (a.model_name ?? '').localeCompare(b.model_name ?? '', 'ja'))
      case 'name_desc': return [...r].sort((a, b) => (b.model_name ?? '').localeCompare(a.model_name ?? '', 'ja'))
      case 'newest':    return [...r].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      case 'oldest':    return [...r].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
      default:          return r
    }
  }, [rows, typeFilter, search, sort])

  function openNew() {
    setForm({ ...EMPTY_FORM })
    setModal('new')
    setFormError(null)
  }

  function openEdit(row) {
    setForm({
      model_name:       row.model_name      ?? '',
      type_id:          row.type_id         ?? 'crane',
      meter_unit_price: row.meter_unit_price ?? 100,
      in_meter_count:   row.in_meter_count  ?? 1,
      out_meter_count:  row.out_meter_count ?? 1,
      manufacturer:     row.manufacturer    ?? '',
      notes:            row.notes           ?? '',
    })
    setModal(row)
    setFormError(null)
  }

  async function handleSave() {
    if (!form.model_name.trim()) { setFormError('機種名は必須です'); return }
    if (!form.type_id)           { setFormError('種別は必須です');   return }
    setSaving(true)
    setFormError(null)
    try {
      if (modal === 'new') {
        const newId = crypto.randomUUID()
        const payload = {
          model_id:         newId,
          model_name:       form.model_name.trim(),
          type_id:          form.type_id,
          meter_unit_price: Number(form.meter_unit_price) || 100,
          in_meter_count:   Number(form.in_meter_count)   || 1,
          out_meter_count:  Number(form.out_meter_count)  || 1,
          manufacturer:     form.manufacturer.trim() || null,
          notes:            form.notes.trim()        || null,
          organization_id:  DFX_ORG_ID,
          updated_at:       new Date().toISOString(),
          updated_by:       staffName || null,
        }
        const { error: e } = await supabase.from('machine_models').insert(payload)
        if (e) throw e
        await insertAuditLog({ staffId, action: 'machine_model_create', targetId: newId, after: payload })
        logger.info('machine_create_success', { model_name: form.model_name })
      } else {
        const before = { ...modal }
        const patch = {
          model_name:       form.model_name.trim(),
          type_id:          form.type_id,
          meter_unit_price: Number(form.meter_unit_price) || 100,
          in_meter_count:   Number(form.in_meter_count)   || 1,
          out_meter_count:  Number(form.out_meter_count)  || 1,
          manufacturer:     form.manufacturer.trim() || null,
          notes:            form.notes.trim()        || null,
          updated_at:       new Date().toISOString(),
          updated_by:       staffName || null,
        }
        const { error: e } = await supabase.from('machine_models')
          .update(patch)
          .eq('model_id', modal.model_id)
        if (e) throw e
        await insertAuditLog({ staffId, action: 'machine_model_update', targetId: modal.model_id, before, after: patch })
        logger.info('machine_update_success', { model_id: modal.model_id })
      }
      setModal(null)
      setLoadKey(k => k + 1)
    } catch (e) {
      const code = modal === 'new' ? 'ERR-MACHINE-002' : 'ERR-MACHINE-003'
      logger.error(`machine_${modal === 'new' ? 'create' : 'update'}_error`, { code, err: e })
      setFormError(`保存できませんでした (${code})`)
    } finally {
      setSaving(false)
    }
  }

  async function openDelete(row) {
    const { count } = await supabase
      .from('machines')
      .select('*', { count: 'exact', head: true })
      .eq('model_id', row.model_id)
    setDeleteUsageCount(count ?? 0)
    setDeleteTarget(row)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const before = { ...deleteTarget }
    try {
      const { error: e } = await supabase.from('machine_models')
        .delete()
        .eq('model_id', deleteTarget.model_id)
      if (e) throw e
      await insertAuditLog({ staffId, action: 'machine_model_delete', targetId: deleteTarget.model_id, before })
      logger.info('machine_delete_success', { model_id: deleteTarget.model_id })
      setDeleteTarget(null)
      setLoadKey(k => k + 1)
    } catch (e) {
      logger.error('machine_delete_error', { code: 'ERR-MACHINE-004', err: e })
      setError('削除に失敗しました (ERR-MACHINE-004)')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const inputCls = 'w-full border border-border rounded-lg px-4 py-3 text-base bg-bg text-text placeholder-muted focus:outline-none focus:border-blue-500 min-h-[44px]'
  const labelCls = 'text-sm font-medium text-text'
  const gridCellCls = 'w-full h-8 px-1.5 bg-transparent border-0 text-text text-sm outline-none focus:bg-surface rounded'

  function setGCell(id, key, val) {
    setGridEdits(prev => {
      const row = rows.find(r => r.model_id === id)
      const base = prev[id] ?? {
        model_name: row?.model_name ?? '',
        type_id: row?.type_id ?? 'crane',
        manufacturer: row?.manufacturer ?? '',
        meter_unit_price: row?.meter_unit_price ?? 100,
        in_meter_count: row?.in_meter_count ?? 1,
        out_meter_count: row?.out_meter_count ?? 1,
      }
      return { ...prev, [id]: { ...base, [key]: val } }
    })
  }

  async function saveGridEdits() {
    setGridSaving(true)
    const now = new Date().toISOString()
    for (const [id, ge] of Object.entries(gridEdits)) {
      const row = rows.find(r => r.model_id === id)
      const before = { ...row }
      const patch = {
        model_name: ge.model_name,
        type_id: ge.type_id,
        manufacturer: ge.manufacturer || null,
        meter_unit_price: Number(ge.meter_unit_price) || 100,
        in_meter_count: Number(ge.in_meter_count) || 1,
        out_meter_count: Number(ge.out_meter_count) || 1,
        updated_at: now,
        updated_by: staffName || null,
      }
      const { error: ge_err } = await supabase.from('machine_models').update(patch).eq('model_id', id)
      if (ge_err) { setError(ge_err.message); setGridSaving(false); return }
      await insertAuditLog({ staffId, action: 'machine_model_update', targetId: id, before, after: patch })
    }
    setGridSaving(false)
    setGridEdits({})
    setLoadKey(k => k + 1)
  }

  return (
    <div className="min-h-screen bg-bg text-text">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          className="text-muted text-sm hover:text-text min-h-[44px] flex items-center pr-2"
        >
          ← 戻る
        </button>
        <h1 className="text-2xl font-bold flex-1">機種マスタ</h1>
        <button
          type="button"
          onClick={openNew}
          className="px-5 py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-base font-bold rounded-lg min-h-[44px]"
        >
          + 新規追加
        </button>
        <button
          type="button"
          onClick={() => { setGridMode(m => !m); setGridEdits({}) }}
          className={`px-4 py-3 text-sm font-bold rounded-lg min-h-[44px] border ${gridMode ? 'bg-amber-900/200 text-white border-transparent' : 'bg-bg text-text border-border'}`}
        >
          {gridMode ? '⊞ 表編集中' : '⊞ 表編集'}
        </button>
      </div>

      {/* Search / filter / sort */}
      <div className="px-4 py-3 border-b border-border space-y-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="名前 / メーカーで検索"
          className={inputCls}
        />
        <div className="flex gap-2 flex-wrap items-center">
          <button
            type="button"
            onClick={() => setTypeFilter('')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors min-h-[36px] ${
              typeFilter === ''
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-bg text-text border-border hover:bg-surface'
            }`}
          >
            全種別
          </button>
          {TYPE_OPTIONS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(prev => prev === t ? '' : t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors min-h-[36px] ${
                typeFilter === t
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-bg text-text border-border hover:bg-surface'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="ml-auto border border-border rounded-lg px-3 py-2 text-sm bg-bg text-text min-h-[36px]"
          >
            {SORT_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          <span className="text-sm text-muted">{filtered.length}件</span>
        </div>
      </div>

      {gridMode && Object.keys(gridEdits).length > 0 && (
        <div className="px-4 py-2 bg-amber-900/20 border-y border-amber-200 flex items-center gap-2">
          <span className="text-sm text-amber-700">{Object.keys(gridEdits).length}件 変更あり</span>
          <button onClick={() => setGridEdits({})} className="ml-auto text-sm text-muted px-3 py-1 rounded border border-border">取消</button>
          <button onClick={saveGridEdits} disabled={gridSaving} className="text-sm text-white bg-blue-500 px-4 py-1 rounded font-bold disabled:opacity-50">
            {gridSaving ? '保存中…' : '一括保存'}
          </button>
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-4 space-y-2">

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-red-700 text-base">{error}</span>
            <button
              type="button"
              onClick={() => { setError(null); setLoadKey(k => k + 1) }}
              className="text-red-700 text-sm underline ml-4 whitespace-nowrap"
            >
              再読み込み
            </button>
          </div>
        )}

        {/* Skeleton */}
        {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}

        {/* Empty state */}
        {!loading && !error && rows.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <p className="text-muted text-base">まだ機種が登録されていません</p>
            <button
              type="button"
              onClick={openNew}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg text-base min-h-[44px]"
            >
              初めて追加
            </button>
          </div>
        )}

        {/* No match */}
        {!loading && !error && rows.length > 0 && filtered.length === 0 && (
          <p className="text-center text-muted text-base py-8">検索条件に一致する機種がありません</p>
        )}

        {/* Grid table */}
        {gridMode && !loading && filtered.length > 0 && (
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-muted text-left bg-surface">
                  <th className="py-1.5 px-2">機種名</th>
                  <th className="py-1.5 px-2">種別</th>
                  <th className="py-1.5 px-2">メーカー</th>
                  <th className="py-1.5 px-2 text-right">単価</th>
                  <th className="py-1.5 px-2 text-right">IN数</th>
                  <th className="py-1.5 px-2 text-right">OUT数</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const ge = gridEdits[row.model_id]
                  return (
                    <tr key={row.model_id} className={`border-b border-border ${ge ? 'bg-amber-900/20' : 'hover:bg-surface'}`}>
                      <td className="py-0.5 px-1"><input value={ge?.model_name ?? row.model_name ?? ''} onChange={ev => setGCell(row.model_id, 'model_name', ev.target.value)} className={gridCellCls} /></td>
                      <td className="py-0.5 px-1">
                        <select value={ge?.type_id ?? row.type_id ?? 'crane'} onChange={ev => setGCell(row.model_id, 'type_id', ev.target.value)} className="h-8 px-1 bg-bg border border-border text-text text-sm rounded w-full">
                          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                        </select>
                      </td>
                      <td className="py-0.5 px-1"><input value={ge?.manufacturer ?? row.manufacturer ?? ''} onChange={ev => setGCell(row.model_id, 'manufacturer', ev.target.value)} className={gridCellCls} /></td>
                      <td className="py-0.5 px-1"><input type="number" value={ge?.meter_unit_price ?? row.meter_unit_price ?? 100} onChange={ev => setGCell(row.model_id, 'meter_unit_price', ev.target.value)} className={`${gridCellCls} text-right`} /></td>
                      <td className="py-0.5 px-1"><input type="number" value={ge?.in_meter_count ?? row.in_meter_count ?? 1} onChange={ev => setGCell(row.model_id, 'in_meter_count', ev.target.value)} className={`${gridCellCls} text-right`} /></td>
                      <td className="py-0.5 px-1"><input type="number" value={ge?.out_meter_count ?? row.out_meter_count ?? 1} onChange={ev => setGCell(row.model_id, 'out_meter_count', ev.target.value)} className={`${gridCellCls} text-right`} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Card list */}
        {!gridMode && !loading && filtered.map(row => (
          <div
            key={row.model_id}
            onClick={() => openEdit(row)}
            className="bg-surface border border-border rounded-xl p-4 min-h-[88px] flex items-center gap-3 cursor-pointer hover:bg-surface hover:shadow-md transition-all"
          >
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-text truncate">{row.model_name}</p>
              <p className="text-sm text-muted mt-0.5">
                {TYPE_LABELS[row.type_id] ?? row.type_id}
                {' · '}¥{row.meter_unit_price ?? '—'}
                {' · '}IN{row.in_meter_count}/OUT{row.out_meter_count}
                {row.manufacturer && ` · ${row.manufacturer}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={e => { e.stopPropagation(); openDelete(row) }}
                className="px-3 py-1.5 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 min-h-[36px]"
              >
                削除
              </button>
              <span className="text-muted text-xl leading-none">›</span>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / New Modal */}
      {modal && (
        <div className="fixed inset-0 z-[9000] flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(null)} />
          <div
            className="relative w-full md:max-w-lg bg-bg rounded-t-2xl md:rounded-2xl px-6 pb-10 pt-5 space-y-4 overflow-y-auto"
            style={{ maxHeight: '90dvh' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold">
                {modal === 'new' ? '新規機種追加' : `編集: ${modal.model_name}`}
              </p>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="text-muted text-2xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center hover:text-text"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className={labelCls}>機種名 <span className="text-red-500">*</span></span>
                <input
                  type="text"
                  value={form.model_name}
                  onChange={e => setForm(f => ({ ...f, model_name: e.target.value }))}
                  placeholder="例: BUZZCRE 4"
                  className={`mt-1 ${inputCls}`}
                />
              </label>

              <label className="block">
                <span className={labelCls}>種別 <span className="text-red-500">*</span></span>
                <select
                  value={form.type_id}
                  onChange={e => setForm(f => ({ ...f, type_id: e.target.value }))}
                  className={`mt-1 ${inputCls}`}
                >
                  {TYPE_OPTIONS.map(t => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className={labelCls}>単価 (¥)</span>
                  <input
                    type="number"
                    value={form.meter_unit_price}
                    onChange={e => setForm(f => ({ ...f, meter_unit_price: e.target.value }))}
                    min="0"
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>INメーター数</span>
                  <input
                    type="number"
                    value={form.in_meter_count}
                    onChange={e => setForm(f => ({ ...f, in_meter_count: e.target.value }))}
                    min="0"
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>OUTメーター数</span>
                  <input
                    type="number"
                    value={form.out_meter_count}
                    onChange={e => setForm(f => ({ ...f, out_meter_count: e.target.value }))}
                    min="1"
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
              </div>

              <label className="block">
                <span className={labelCls}>メーカー</span>
                <input
                  type="text"
                  value={form.manufacturer}
                  onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))}
                  placeholder="例: 株式会社BUZZGAMES"
                  className={`mt-1 ${inputCls}`}
                />
              </label>

              <label className="block">
                <span className={labelCls}>備考</span>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full border border-border rounded-lg px-4 py-3 text-base bg-bg text-text focus:outline-none focus:border-blue-500 resize-none"
                />
              </label>
            </div>

            {formError && <p className="text-red-600 text-sm">{formError}</p>}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex-1 py-3 rounded-xl border border-border text-text text-base font-bold hover:bg-surface min-h-[44px]"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-base font-bold min-h-[44px]"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[9001] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-[320px] bg-bg rounded-2xl p-6 space-y-4 shadow-xl">
            <p className="text-lg font-bold">削除しますか？</p>
            <p className="text-base text-text">
              「{deleteTarget.model_name}」を削除します。この操作は取り消せません。
            </p>
            {deleteUsageCount > 0 && (
              <p className="text-sm text-amber-700 bg-amber-900/20 rounded-lg px-3 py-2">
                この機種は {deleteUsageCount} 件の機械で使用中です
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 rounded-xl border border-border text-text font-bold hover:bg-surface min-h-[44px]"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-700 disabled:opacity-40 text-white font-bold min-h-[44px]"
              >
                {deleting ? '削除中…' : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
