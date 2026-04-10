import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMachineTypes, addMachineType, updateMachineType, deleteMachineType } from '../../services/masters'
import LogoutButton from '../../components/LogoutButton'
import AdminNav from '../../components/AdminNav'

const EMPTY_FORM = {
  type_name: '',
  category: '',
  manufacturer: '',
  booth_count: '',
  meter_count: '',
  meter_unit_price: '',
  locker_slots: '',
  notes: '',
}

function TypeFields({ form, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2">
        <label className="block text-xs text-muted mb-1">機種名 <span className="text-accent2">*</span></label>
        <input
          type="text"
          value={form.type_name}
          onChange={e => onChange('type_name', e.target.value)}
          placeholder="例: バズクレ4"
          className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">カテゴリ</label>
        <input
          type="text"
          value={form.category}
          onChange={e => onChange('category', e.target.value)}
          placeholder="例: クレーンゲーム"
          className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">メーカー</label>
        <input
          type="text"
          value={form.manufacturer}
          onChange={e => onChange('manufacturer', e.target.value)}
          placeholder="例: SEGA"
          className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">ブース数</label>
        <input
          type="number"
          value={form.booth_count}
          onChange={e => onChange('booth_count', e.target.value)}
          placeholder="例: 2"
          className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">メーター数</label>
        <input
          type="number"
          value={form.meter_count}
          onChange={e => onChange('meter_count', e.target.value)}
          placeholder="例: 7"
          className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">プレイ単価</label>
        <input
          type="number"
          value={form.meter_unit_price}
          onChange={e => onChange('meter_unit_price', e.target.value)}
          placeholder="例: 100"
          className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">ロッカースロット</label>
        <input
          type="number"
          value={form.locker_slots}
          onChange={e => onChange('locker_slots', e.target.value)}
          placeholder="例: 0"
          className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="sm:col-span-2">
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

export default function ModelList() {
  const navigate = useNavigate()
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState('')

  const loadTypes = () => {
    setLoading(true)
    getMachineTypes().then(data => {
      setTypes(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadTypes() }, [])

  const handleFormChange = (field, value) => setForm(f => ({ ...f, [field]: value }))
  const handleEditChange = (field, value) => setEditForm(f => ({ ...f, [field]: value }))

  const handleAdd = async e => {
    e.preventDefault()
    if (!form.type_name.trim()) { setFormError('機種名は必須です'); return }
    setSaving(true)
    setFormError('')
    try {
      await addMachineType(form)
      setForm(EMPTY_FORM)
      loadTypes()
    } catch (err) {
      setFormError(err.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = t => {
    setEditId(t.type_id)
    setEditForm({
      type_name: t.type_name || '',
      category: t.category || '',
      manufacturer: t.manufacturer || '',
      booth_count: t.booth_count ?? '',
      meter_count: t.meter_count ?? '',
      meter_unit_price: t.meter_unit_price ?? '',
      locker_slots: t.locker_slots ?? '',
      notes: t.notes || '',
    })
    setEditError('')
  }

  const handleSave = async typeId => {
    if (!editForm.type_name.trim()) { setEditError('機種名は必須です'); return }
    setSaving(true)
    setEditError('')
    try {
      await updateMachineType(typeId, editForm)
      setEditId(null)
      loadTypes()
    } catch (err) {
      setEditError(err.message || '更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async t => {
    if (!window.confirm(`「${t.type_name}」を削除しますか？`)) return
    try {
      await deleteMachineType(t.type_id)
      loadTypes()
    } catch (err) {
      alert(err.message || '削除に失敗しました')
    }
  }

  return (
    <div className="min-h-screen pb-16">

      <div className="sticky top-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-3 print:hidden">
        <button onClick={() => navigate('/admin')} className="text-2xl text-muted">←</button>
        <div className="flex-1">
          <h2 className="text-base font-bold">機種マスタ</h2>
          <p className="text-[11px] text-muted">機種の登録・編集・削除</p>
        </div>
        <LogoutButton />
      </div>
      <AdminNav />

      <div className="bg-surface border border-border rounded-xl p-4 mx-4 mt-4">
        <h3 className="text-sm font-bold mb-3 text-accent">＋ 機種を追加</h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <TypeFields form={form} onChange={handleFormChange} />
          {formError && (
            <p className="text-accent2 text-xs">{formError}</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            {saving ? '保存中...' : '追加'}
          </button>
        </form>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
          <p className="text-muted text-sm">読み込み中...</p>
        </div>
      )}

      {!loading && types.length === 0 && (
        <div className="text-center py-16 text-muted text-sm">
          機種が登録されていません
        </div>
      )}

      {!loading && types.map(t => (
        <div key={t.type_id} className="bg-surface border border-border rounded-xl p-3.5 mx-4 mt-2">
          {editId === t.type_id ? (
            <div className="space-y-3">
              <TypeFields form={editForm} onChange={handleEditChange} />
              {editError && <p className="text-accent2 text-xs">{editError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave(t.type_id)}
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-sm transition-colors"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="flex-1 bg-surface2 border border-border text-text font-bold py-2 rounded-xl text-sm"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-text text-sm">{t.type_name}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                  {(t.category || t.manufacturer) && (
                    <span>{[t.category, t.manufacturer].filter(Boolean).join(' / ')}</span>
                  )}
                  {t.booth_count != null && <span>{t.booth_count}台</span>}
                  {t.meter_unit_price != null && <span>プレイ単価 ¥{t.meter_unit_price}</span>}
                  {t.notes && <span className="text-muted">{t.notes}</span>}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => startEdit(t)}
                  className="text-xs text-accent border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface2 transition-colors"
                >
                  編集
                </button>
                <button
                  onClick={() => handleDelete(t)}
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
  )
}
