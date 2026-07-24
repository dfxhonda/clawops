import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import StorePickerSheet from '../../components/StorePickerSheet'
import {
  getMachineModels,
  getMachines,
  addMachine,
  updateMachine,
  deleteMachine,
  getNextMachineCode,
  addBooth,
  batchUpdateOrder,
} from '../../services/masters'
import LogoutButton from '../../components/LogoutButton'
import { UNIT_MARKS, buildMachineName, computeUsedMarks } from '../../lib/machineNaming'

const EMPTY_FORM = {
  machine_name: '',
  model_id: '',
  play_price: '100',
  machine_number: '',
  booth_count: '',
  in_meter_count: '',
  out_meter_count: '',
  notes: '',
  unit_mark: '',      // D-117: 丸数字 (「なし」は '')
  name_manual: false, // D-117: ユーザーが機械名を手編集したら true (以後自動上書きしない)
}

function MachineFields({ form, onChange, machineModels, hideModel = false, showUnitMark = false, unitMarkUsed = null, unitMarkDisabled = false }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2">
        <label className="block text-xs text-muted mb-1">機械名 <span className="text-accent2">*</span></label>
        <input
          type="text"
          value={form.machine_name}
          onChange={e => onChange('machine_name', e.target.value)}
          placeholder="例: バズクレ4 No.1"
          className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      {!hideModel && (
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted mb-1">機種 <span className="text-accent2">*</span></label>
          <select
            value={form.model_id}
            onChange={e => onChange('model_id', e.target.value)}
            required
            className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">機種を選択してください</option>
            {machineModels.map(m => (
              <option key={m.model_id} value={m.model_id}>
                {m.model_name}（{m.manufacturer || 'メーカー不明'}）
              </option>
            ))}
          </select>
        </div>
      )}
      {showUnitMark && (
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted mb-1">番号（丸数字）</label>
          <select
            value={form.unit_mark || ''}
            onChange={e => onChange('unit_mark', e.target.value)}
            disabled={unitMarkDisabled}
            aria-label="番号（丸数字）"
            className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
          >
            <option value="" disabled={!!(unitMarkUsed && unitMarkUsed.has(null))}>
              なし{unitMarkUsed && unitMarkUsed.has(null) ? '（使用済）' : ''}
            </option>
            {UNIT_MARKS.map(mk => (
              <option key={mk} value={mk} disabled={!!(unitMarkUsed && unitMarkUsed.has(mk))}>
                {mk}{unitMarkUsed && unitMarkUsed.has(mk) ? '（使用済）' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs text-muted mb-1">プレイ単価</label>
        <input
          type="number"
          value={form.play_price}
          onChange={e => onChange('play_price', e.target.value)}
          placeholder="100"
          className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">レンタルコード</label>
        <input
          type="text"
          value={form.machine_number}
          onChange={e => onChange('machine_number', e.target.value)}
          placeholder="例: R2001"
          className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">備考</label>
        <input
          type="text"
          value={form.notes}
          onChange={e => onChange('notes', e.target.value)}
          placeholder="備考"
          className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
    </div>
  )
}

function SortableMachineItem({ m, activeColumn, editCode, editForm, editError, saving, onEditChange, onSave, onCancelEdit, onStartEdit, onDelete, machineModels }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: m.machine_code })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  const orderValue = m[activeColumn]

  return (
    <div ref={setNodeRef} style={style} className="bg-surface border border-border rounded-xl px-3 py-2 mx-4 mt-1.5">
      {editCode === m.machine_code ? (
        <div className="space-y-3 pt-1">
          <MachineFields
            form={editForm}
            onChange={onEditChange}
            machineModels={machineModels}
            hideModel
          />
          {editError && <p className="text-accent2 text-xs">{editError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => onSave(m.machine_code)}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-sm transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={onCancelEdit}
              className="flex-1 bg-surface2 border border-border text-text font-bold py-2 rounded-xl text-sm"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            {...attributes}
            {...listeners}
            className="touch-none shrink-0 text-muted text-base px-0.5 cursor-grab active:cursor-grabbing select-none"
            aria-label="並び替え"
            tabIndex={-1}
          >
            ⠿
          </button>
          <span className="text-[10px] text-accent/70 shrink-0 font-mono w-6 text-right">
            #{orderValue ?? '—'}
          </span>
          <span className="font-bold text-text text-sm flex-1 truncate min-w-0">{m.machine_name}</span>
          {m.rental_code && (
            <span className="text-[10px] text-muted shrink-0 hidden sm:block">{m.rental_code}</span>
          )}
          <button
            onClick={() => onStartEdit(m)}
            className="shrink-0 text-xs text-accent border border-border rounded-lg px-2 py-1 hover:bg-surface2 transition-colors"
          >
            編集
          </button>
          <button
            onClick={() => onDelete(m)}
            className="shrink-0 text-xs text-accent2 border border-border rounded-lg px-2 py-1 hover:bg-surface2 transition-colors"
          >
            削除
          </button>
        </div>
      )}
    </div>
  )
}

export default function AdminMachineList() {
  const navigate = useNavigate()

  const [storeCode, setStoreCode] = useState(
    () => sessionStorage.getItem('admin_machine_store') || ''
  )
  const [machineModels, setMachineModels] = useState([])
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(false)
  const [nextCode, setNextCode] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [editCode, setEditCode] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState('')
  const [reordering, setReordering] = useState(false)
  const [reorderError, setReorderError] = useState('')
  const [orderMode, setOrderMode] = useState('junkai')
  const [stagedNonChanger, setStagedNonChanger] = useState(null)
  const [shukinSaving, setShukinSaving] = useState(false)

  const activeColumn = orderMode === 'shukin' ? 'billing_order' : 'round_order'

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const changerModelIds = useMemo(
    () => new Set(machineModels.filter(mm => mm.type_id === 'changer').map(mm => mm.model_id)),
    [machineModels]
  )

  const changerMachines = useMemo(
    () => machines.filter(m => changerModelIds.has(m.model_id)),
    [machines, changerModelIds]
  )

  const nonChangerMachines = useMemo(
    () => machines
      .filter(m => !changerModelIds.has(m.model_id))
      .sort((a, b) => (a[activeColumn] ?? 9999) - (b[activeColumn] ?? 9999)),
    [machines, changerModelIds, activeColumn]
  )

  useEffect(() => {
    getMachineModels().then(setMachineModels).catch(() => {})
  }, [])

  const displayedNonChanger = (orderMode === 'shukin' && stagedNonChanger !== null)
    ? stagedNonChanger
    : nonChangerMachines

  const switchOrderMode = newMode => {
    if (newMode === orderMode) return
    if (stagedNonChanger !== null) {
      if (!window.confirm('集金順の変更が保存されていません。破棄して切り替えますか？')) return
      setStagedNonChanger(null)
    }
    setOrderMode(newMode)
  }

  const handleBack = () => {
    if (stagedNonChanger !== null) {
      if (!window.confirm('集金順の変更が保存されていません。移動しますか？')) return
      setStagedNonChanger(null)
    }
    navigate('/admin/masters')
  }

  const handleShukinSave = async () => {
    if (!stagedNonChanger) return
    setShukinSaving(true)
    try {
      await batchUpdateOrder(
        storeCode,
        stagedNonChanger.map(m => ({ machine_code: m.machine_code, order_value: m.billing_order })),
        'billing_order'
      )
      setStagedNonChanger(null)
      await reloadMachines()
    } catch (err) {
      alert(err.message || '保存に失敗しました')
    } finally {
      setShukinSaving(false)
    }
  }

  useEffect(() => {
    if (!storeCode) {
      setMachines([])
      setNextCode('')
      setStagedNonChanger(null)
      return
    }
    sessionStorage.setItem('admin_machine_store', storeCode)
    setLoading(true)
    Promise.all([
      getMachines(storeCode),
      getNextMachineCode(storeCode),
    ]).then(([ms, nc]) => {
      setMachines(ms)
      setNextCode(nc)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [storeCode])

  const reloadMachines = async () => {
    if (!storeCode) return
    setLoading(true)
    try {
      const [ms, nc] = await Promise.all([
        getMachines(storeCode),
        getNextMachineCode(storeCode),
      ])
      setMachines(ms)
      setNextCode(nc)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleFormChange = (field, value) => {
    setForm(f => {
      const next = { ...f, [field]: value }
      // D5: ユーザーが機械名を手編集したら以後は自動上書きしない
      if (field === 'machine_name') next.name_manual = true
      if (field === 'model_id') {
        const m = value ? machineModels.find(mm => mm.model_id === value) : null
        if (m) {
          next.booth_count = String(m.booth_count || '')
          next.in_meter_count = String(m.in_meter_count || '')
          next.out_meter_count = String(m.out_meter_count || '')
          next.play_price = String(m.meter_unit_price || '100')
        }
        // D3: 未編集(name_manual=false)時のみ機械名を再合成
        if (!next.name_manual && m) {
          if (m.type_id === 'changer') {
            next.machine_name = '両替機' // R4: 両替機は固定文字列、丸数字なし
            next.unit_mark = ''
          } else if (m.short_name) { // D9: short_name 空/null は自動入力しない
            next.machine_name = buildMachineName(m.short_name, next.unit_mark)
          }
        }
      }
      // D4: 丸数字変更時、未編集なら再合成 (changer/short_name無しは対象外)。手入力時は unit_mark だけ保持。
      if (field === 'unit_mark' && !next.name_manual) {
        const m = machineModels.find(mm => mm.model_id === next.model_id)
        if (m && m.type_id !== 'changer' && m.short_name) {
          next.machine_name = buildMachineName(m.short_name, value)
        }
      }
      return next
    })
  }

  const handleEditChange = (field, value) =>
    setEditForm(f => ({ ...f, [field]: value }))

  const handleAdd = async e => {
    e.preventDefault()
    if (!form.machine_name.trim()) { setFormError('機械名は必須です'); return }
    setSaving(true)
    setFormError('')
    try {
      const machine = await addMachine({
        machine_code: nextCode,
        store_code: storeCode,
        machine_name: form.machine_name.trim(),
        model_id: form.model_id || null,
        play_price: form.play_price ? Number(form.play_price) : 100,
        machine_number: form.machine_number || null,
        notes: form.notes || null,
      })

      const boothCount = Number(form.booth_count) || 0
      for (let i = 0; i < boothCount; i++) {
        await addBooth({
          store_code: storeCode,
          machine_code: machine.machine_code,
          booth_number: i + 1,
          play_price: form.play_price ? Number(form.play_price) : 100,
          meter_in_number: Number(form.in_meter_count) || 7,
          meter_out_number: Number(form.out_meter_count) || 7,
        })
      }

      setForm(EMPTY_FORM)
      setShowForm(false)
      await reloadMachines()
    } catch (err) {
      setFormError(err.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = m => {
    setEditCode(m.machine_code)
    setEditForm({
      machine_name: m.machine_name || '',
      play_price: m.default_price != null ? String(m.default_price) : '',
      machine_number: m.rental_code || '',
      notes: m.location_note || '',
    })
    setEditError('')
  }

  const handleSave = async machineCode => {
    if (!editForm.machine_name.trim()) { setEditError('機械名は必須です'); return }
    setSaving(true)
    setEditError('')
    try {
      await updateMachine(machineCode, {
        machine_name: editForm.machine_name.trim(),
        play_price: editForm.play_price ? Number(editForm.play_price) : undefined,
        machine_number: editForm.machine_number || null,
        notes: editForm.notes || null,
      })
      setEditCode(null)
      await reloadMachines()
    } catch (err) {
      setEditError(err.message || '更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async m => {
    if (!window.confirm(`「${m.machine_name}」を削除しますか？`)) return
    try {
      await deleteMachine(m.machine_code)
      await reloadMachines()
    } catch (err) {
      alert(err.message || '削除に失敗しました')
    }
  }

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const base = displayedNonChanger
    const oldIdx = base.findIndex(m => m.machine_code === active.id)
    const newIdx = base.findIndex(m => m.machine_code === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(base, oldIdx, newIdx)
    const withNewOrder = reordered.map((m, i) => ({ ...m, [activeColumn]: i + 1 }))

    if (orderMode === 'junkai') {
      const snapshot = machines
      setMachines([...changerMachines, ...withNewOrder])
      setReordering(true)
      setReorderError('')
      try {
        await batchUpdateOrder(
          storeCode,
          withNewOrder.map(m => ({ machine_code: m.machine_code, order_value: m[activeColumn] })),
          activeColumn
        )
      } catch (err) {
        setReorderError(err.message || '並び替えの保存に失敗しました')
        setMachines(snapshot)
      } finally {
        setReordering(false)
      }
    } else {
      setStagedNonChanger(withNewOrder)
    }
  }

  const selectedModel = machineModels.find(m => m.model_id === form.model_id)

  // D-117: 追加フォームの丸数字 使用済み集合 (short_name グルーピング)。changer/short_name無しは対象外。
  const addUnitMarkUsed = useMemo(
    () => (selectedModel && selectedModel.type_id !== 'changer' && selectedModel.short_name)
      ? computeUsedMarks(machines, machineModels, selectedModel.short_name)
      : new Set(),
    [selectedModel, machines, machineModels]
  )
  // R4/AC7: 両替機は丸数字ドロップダウン非表示。それ以外(未選択含む)は表示。
  const showAddUnitMark = !(selectedModel && selectedModel.type_id === 'changer')

  return (
    <div className="h-full flex flex-col">

      {/* Header */}
      <div className="shrink-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-3 print:hidden" style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#3b82f6' }}>
        <button onClick={handleBack} className="text-2xl text-muted">←</button>
        <div className="flex-1">
          <h2 className="text-base font-bold">機械登録</h2>
          <p className="text-[11px] text-muted">機械の追加・編集・並び替え</p>
        </div>
        <LogoutButton to="/admin/masters" />
      </div>

      <div className="flex-1 overflow-y-auto list-scroll">
      <div className="md:max-w-3xl md:mx-auto">

      {/* Store selector */}
      <div className="mx-4 mt-4">
        <label className="block text-xs text-muted mb-1">店舗を選択</label>
        <StorePickerSheet
          value={storeCode || null}
          onChange={code => setStoreCode(code ?? '')}
          showAllOption={false}
          placeholder="店舗を選択…"
        />
      </div>

      {/* Add machine toggle */}
      {storeCode && (
        <div className="mx-4 mt-4">
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 text-sm font-bold text-accent"
          >
            <span className="text-base leading-none">{showForm ? '▾' : '▸'}</span>
            <span>機械を追加</span>
            {nextCode && (
              <span className="font-mono text-xs bg-surface2 border border-border rounded px-2 py-0.5 text-muted ml-2">
                {nextCode}
              </span>
            )}
          </button>
          {showForm && (
            <div className="bg-surface border border-border rounded-xl p-4 mt-2">
              <form onSubmit={handleAdd} className="space-y-3">
                <MachineFields
                  form={form}
                  onChange={handleFormChange}
                  machineModels={machineModels}
                  showUnitMark={showAddUnitMark}
                  unitMarkUsed={addUnitMarkUsed}
                  unitMarkDisabled={!form.model_id}
                />
                {selectedModel && Number(form.booth_count) > 0 && (
                  <p className="text-xs text-accent3">
                    保存時にブースを {form.booth_count} 個自動生成します（IN: {form.in_meter_count} / OUT: {form.out_meter_count}）
                  </p>
                )}
                {formError && <p className="text-accent2 text-xs">{formError}</p>}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  {saving ? '保存中...' : '追加'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
          <p className="text-muted text-sm">読み込み中...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && storeCode && machines.length === 0 && (
        <div className="text-center py-16 text-muted text-sm">
          この店舗に機械が登録されていません
        </div>
      )}

      {/* Order mode toggle: LEFT=巡回順 RIGHT=集金順 */}
      {!loading && storeCode && machines.length > 0 && (
        <div className="flex mx-4 mt-4 rounded-lg overflow-hidden border border-border">
          <button
            onClick={() => switchOrderMode('junkai')}
            className={`flex-1 py-1.5 text-xs font-bold transition-colors ${orderMode === 'junkai' ? 'bg-blue-600 text-white' : 'bg-surface text-muted hover:bg-surface2'}`}
          >
            巡回順
          </button>
          <button
            onClick={() => switchOrderMode('shukin')}
            className={`flex-1 py-1.5 text-xs font-bold transition-colors ${orderMode === 'shukin' ? 'bg-blue-600 text-white' : 'bg-surface text-muted hover:bg-surface2'}`}
          >
            集金順
          </button>
        </div>
      )}

      {/* Shukin dirty bar: save / reset */}
      {orderMode === 'shukin' && stagedNonChanger !== null && (
        <div className="mx-4 mt-2 px-3 py-2 bg-amber-900/20 border border-amber-500/30 rounded-lg flex items-center gap-2">
          <span className="text-xs text-amber-400 flex-1">集金順 未保存の変更あり</span>
          <button
            onClick={() => setStagedNonChanger(null)}
            className="text-xs text-muted border border-border px-3 py-1 rounded"
          >
            リセット
          </button>
          <button
            onClick={handleShukinSave}
            disabled={shukinSaving}
            className="text-xs text-white bg-blue-600 px-4 py-1 rounded font-bold disabled:opacity-50"
          >
            {shukinSaving ? '保存中…' : '保存'}
          </button>
        </div>
      )}

      {/* Reorder error banner */}
      {reorderError && (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-400">
          {reorderError}
        </div>
      )}

      {/* Changer machines (fixed top, non-draggable, both modes) */}
      {!loading && changerMachines.map(m => (
        <div key={m.machine_code} className="bg-surface border border-border rounded-xl px-3 py-2 mx-4 mt-1.5 border-l-4 border-l-amber-600/60">
          {editCode === m.machine_code ? (
            <div className="space-y-3 pt-1">
              <MachineFields
                form={editForm}
                onChange={handleEditChange}
                machineModels={machineModels}
                hideModel
              />
              {editError && <p className="text-accent2 text-xs">{editError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave(m.machine_code)}
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-sm transition-colors"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setEditCode(null)}
                  className="flex-1 bg-surface2 border border-border text-text font-bold py-2 rounded-xl text-sm"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="shrink-0 text-muted text-base px-0.5 select-none opacity-20">⠿</div>
              <span className="text-[10px] font-bold px-1 py-0 rounded bg-amber-600/20 text-amber-400 shrink-0">両替</span>
              <span className="font-bold text-text text-sm flex-1 truncate min-w-0">{m.machine_name}</span>
              <button
                onClick={() => startEdit(m)}
                className="shrink-0 text-xs text-accent border border-border rounded-lg px-2 py-1 hover:bg-surface2 transition-colors"
              >
                編集
              </button>
              <button
                onClick={() => handleDelete(m)}
                className="shrink-0 text-xs text-accent2 border border-border rounded-lg px-2 py-1 hover:bg-surface2 transition-colors"
              >
                削除
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Non-changer machines with drag-to-reorder */}
      {!loading && displayedNonChanger.length > 0 && (
        <>
          {displayedNonChanger.length > 1 && (
            <p className="mx-4 mt-2 mb-0.5 text-[11px] text-muted/60">
              ⠿ を長押しでドラッグして並び替え
              {orderMode === 'junkai' && reordering ? '（保存中...）' : ''}
              {orderMode === 'shukin' && '（集金順・保存ボタンで確定）'}
            </p>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayedNonChanger.map(m => m.machine_code)}
              strategy={verticalListSortingStrategy}
            >
              {displayedNonChanger.map(m => (
                <SortableMachineItem
                  key={m.machine_code}
                  m={m}
                  activeColumn={activeColumn}
                  editCode={editCode}
                  editForm={editForm}
                  editError={editError}
                  saving={saving}
                  onEditChange={handleEditChange}
                  onSave={handleSave}
                  onCancelEdit={() => setEditCode(null)}
                  onStartEdit={startEdit}
                  onDelete={handleDelete}
                  machineModels={machineModels}
                />
              ))}
            </SortableContext>
          </DndContext>
        </>
      )}
      </div>
      </div>
    </div>
  )
}
