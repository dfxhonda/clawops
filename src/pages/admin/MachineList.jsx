import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAllStores,
  getMachineModels,
  getMachines,
  addMachine,
  updateMachine,
  deleteMachine,
  getNextMachineCode,
  addBooth,
} from '../../services/masters'
import LogoutButton from '../../components/LogoutButton'
import AdminNav from '../../components/AdminNav'

const EMPTY_FORM = {
  machine_name: '',
  model_id: '',
  play_price: '100',
  machine_number: '',
  booth_count: '',
  in_meter_count: '',
  out_meter_count: '',
  notes: '',
}

function MachineFields({ form, onChange, machineModels, hideModel = false }) {
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

export default function AdminMachineList() {
  const navigate = useNavigate()

  const [stores, setStores] = useState([])
  const [storeCode, setStoreCode] = useState(
    () => sessionStorage.getItem('admin_machine_store') || ''
  )
  const [machineModels, setMachineModels] = useState([])
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(false)
  const [nextCode, setNextCode] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [editCode, setEditCode] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState('')

  useEffect(() => {
    getAllStores().then(setStores).catch(() => {})
    getMachineModels().then(setMachineModels).catch(() => {})
  }, [])

  useEffect(() => {
    if (!storeCode) {
      setMachines([])
      setNextCode('')
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
      if (field === 'model_id' && value) {
        const m = machineModels.find(m => m.model_id === value)
        if (m) {
          next.booth_count = String(m.booth_count || '')
          next.in_meter_count = String(m.in_meter_count || '')
          next.out_meter_count = String(m.out_meter_count || '')
          next.play_price = String(m.meter_unit_price || '100')
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

  const selectedModel = machineModels.find(m => m.model_id === form.model_id)

  return (
    <div className="h-full flex flex-col">

      {/* Header */}
      <div className="shrink-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-3 print:hidden">
        <button onClick={() => navigate('/admin')} className="text-2xl text-muted">←</button>
        <div className="flex-1">
          <h2 className="text-base font-bold">機械登録</h2>
          <p className="text-[11px] text-muted">機械の追加・編集</p>
        </div>
        <LogoutButton />
      </div>
      <AdminNav />

      <div className="flex-1 overflow-y-auto pb-16">
      {/* Store selector */}
      <div className="mx-4 mt-4">
        <label className="block text-xs text-muted mb-1">店舗を選択</label>
        <select
          value={storeCode}
          onChange={e => setStoreCode(e.target.value)}
          className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">— 店舗を選択してください —</option>
          {stores.map(s => (
            <option key={s.store_code} value={s.store_code}>
              {s.store_name}（{s.store_code}）
            </option>
          ))}
        </select>
      </div>

      {/* Add machine form */}
      {storeCode && (
        <div className="bg-surface border border-border rounded-xl p-4 mx-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-bold text-accent flex-1">＋ 機械を追加</h3>
            {nextCode && (
              <span className="font-mono text-xs bg-surface2 border border-border rounded px-2 py-0.5 text-muted">
                {nextCode}
              </span>
            )}
          </div>
          <form onSubmit={handleAdd} className="space-y-3">
            <MachineFields
              form={form}
              onChange={handleFormChange}
              machineModels={machineModels}
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

      {/* Machine list */}
      {!loading && machines.map(m => (
        <div key={m.machine_code} className="bg-surface border border-border rounded-xl p-3.5 mx-4 mt-2">
          {editCode === m.machine_code ? (
            <div className="space-y-3">
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
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-[10px] text-muted">{m.machine_code}</span>
                </div>
                <div className="font-bold text-text text-sm">{m.machine_name}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                  {m.default_price != null && <span>¥{m.default_price}</span>}
                  {m.rental_code && <span>レンタル: {m.rental_code}</span>}
                  {m.location_note && <span>{m.location_note}</span>}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => startEdit(m)}
                  className="text-xs text-accent border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface2 transition-colors"
                >
                  編集
                </button>
                <button
                  onClick={() => handleDelete(m)}
                  className="text-xs text-accent2 border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface2 transition-colors"
                >
                  削除
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      </div>
    </div>
  )
}
