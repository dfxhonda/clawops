import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMachineTypes, addMachineType, updateMachineType, deleteMachineType } from '../../services/masters'
import LogoutButton from '../../components/LogoutButton'
import AdminNav from '../../components/AdminNav'

const EMPTY_FORM = {
  type_name: '',
  manufacturer: '',
  booth_count: '',
  meter_count: '',
  meter_unit_price: '',
}

export default function ModelList() {
  const navigate = useNavigate()
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef(null)

  const loadTypes = async () => {
    setLoading(true)
    try {
      const data = await getMachineTypes()
      setTypes(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTypes() }, [])

  const handleChange = (field, value) => {
    setForm(f => {
      const next = { ...f, [field]: value }
      // booth_count 変更時、meter_count が空ならデフォルト補完
      if (field === 'booth_count' && !f.meter_count) {
        next.meter_count = value
      }
      return next
    })
  }

  const startEdit = t => {
    setEditId(t.type_id)
    setForm({
      type_name: t.type_name || '',
      manufacturer: t.manufacturer || '',
      booth_count: t.booth_count ?? '',
      meter_count: t.meter_count ?? '',
      meter_unit_price: t.meter_unit_price ?? '',
    })
    setError('')
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const cancelEdit = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.type_name.trim()) { setError('機種名は必須です'); return }

    if (!editId) {
      const dup = types.find(t => t.type_name === form.type_name.trim())
      if (dup) {
        if (!window.confirm(`「${form.type_name}」は既に登録されています。続けますか？`)) return
      }
    }

    setSaving(true)
    setError('')
    try {
      if (editId) {
        await updateMachineType(editId, form)
        setEditId(null)
      } else {
        await addMachineType(form)
      }
      setForm(EMPTY_FORM)
      await loadTypes()
    } catch (err) {
      setError(err.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async t => {
    if (!window.confirm(`「${t.type_name}」を削除しますか？\nこの操作は取り消せません。`)) return
    try {
      await deleteMachineType(t.type_id)
      if (editId === t.type_id) cancelEdit()
      await loadTypes()
    } catch (err) {
      alert(err.message || '削除に失敗しました')
    }
  }

  const handleSpecSearch = () => {
    const q = form.type_name.trim()
    if (!q) return
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(q + ' 仕様 スペック アーケード')}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <div className="min-h-screen pb-16">

      {/* ━━━ ヘッダー ━━━ */}
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-3 print:hidden">
        <button onClick={() => navigate('/admin')} className="text-2xl text-muted">←</button>
        <div className="flex-1">
          <h2 className="text-base font-bold">機種マスタ</h2>
          <p className="text-[11px] text-muted">機種の登録・編集・削除</p>
        </div>
        <LogoutButton />
      </div>
      <AdminNav />

      {/* ━━━ 登録済み一覧 ━━━ */}
      <div className="px-4 mt-4">
        <p className="text-[11px] font-bold text-muted uppercase tracking-wide mb-2">
          登録済み機種 {!loading && `（${types.length}件）`}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2">
            <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full" />
            <span className="text-muted text-sm">読み込み中...</span>
          </div>
        ) : types.length === 0 ? (
          <div className="text-center py-10 text-muted text-sm border border-border border-dashed rounded-xl">
            登録された機種がありません
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b border-border bg-surface2 text-xs font-bold text-muted">
                    <th className="text-left px-3 py-2">機種名</th>
                    <th className="text-left px-3 py-2">メーカー</th>
                    <th className="text-center px-2 py-2">ブース</th>
                    <th className="text-center px-2 py-2">IN</th>
                    <th className="text-center px-2 py-2">OUT</th>
                    <th className="text-right px-3 py-2">単価</th>
                    <th className="px-2 py-2 w-[90px]" />
                  </tr>
                </thead>
                <tbody>
                  {types.map(t => (
                    <tr
                      key={t.type_id}
                      className={`border-t border-border transition-colors ${
                        editId === t.type_id ? 'bg-accent/5' : 'hover:bg-surface2/50'
                      }`}
                    >
                      <td className="px-3 py-2.5 font-medium">
                        {t.type_name}
                        {t.notes && (
                          <span className="block text-[10px] text-muted font-normal">{t.notes}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted">{t.manufacturer || '—'}</td>
                      <td className="px-2 py-2.5 text-center text-xs">{t.booth_count ?? '—'}</td>
                      <td className="px-2 py-2.5 text-center text-xs">{t.meter_count ?? '—'}</td>
                      <td className="px-2 py-2.5 text-center text-xs">{t.meter_count ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right text-xs">
                        {t.meter_unit_price != null ? `¥${t.meter_unit_price}` : '—'}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(t)}
                            className="text-[11px] text-accent border border-border rounded px-2 py-1 hover:bg-surface2 transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(t)}
                            className="text-[11px] text-accent2 border border-border rounded px-2 py-1 hover:bg-surface2 transition-colors"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ━━━ 登録 / 編集フォーム ━━━ */}
      <div ref={formRef} className="mx-4 mt-6 bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-bold mb-4 text-accent">
          {editId ? '✏️ 機種を編集' : '＋ 新規登録'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">

          {/* 機種名 + 仕様を検索 */}
          <div>
            <label className="block text-xs text-muted mb-1">
              機種名 <span className="text-accent2">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.type_name}
                onChange={e => handleChange('type_name', e.target.value)}
                placeholder="例: バズクレ4"
                className="flex-1 bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={handleSpecSearch}
                disabled={!form.type_name.trim()}
                className="shrink-0 px-3 py-2 rounded-lg border border-border text-xs font-bold text-muted bg-surface2 hover:bg-bg disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                仕様を検索
              </button>
            </div>
          </div>

          {/* メーカー */}
          <div>
            <label className="block text-xs text-muted mb-1">メーカー</label>
            <input
              type="text"
              value={form.manufacturer}
              onChange={e => handleChange('manufacturer', e.target.value)}
              placeholder="例: SEGA"
              className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          {/* ブース数 / INメーター数 / OUTメーター数 / 単価 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">ブース数</label>
              <input
                type="number"
                min="1"
                value={form.booth_count}
                onChange={e => handleChange('booth_count', e.target.value)}
                placeholder="例: 2"
                className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">
                INメーター数
                {form.booth_count && !form.meter_count && (
                  <span className="ml-1 text-muted/60">（デフォルト: {form.booth_count}）</span>
                )}
              </label>
              <input
                type="number"
                min="1"
                value={form.meter_count}
                onChange={e => handleChange('meter_count', e.target.value)}
                placeholder={form.booth_count || '例: 7'}
                className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">OUTメーター数</label>
              <input
                type="number"
                min="1"
                value={form.meter_count}
                readOnly
                tabIndex={-1}
                placeholder="INと同じ"
                className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none opacity-50 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">単価（円）</label>
              <input
                type="number"
                min="0"
                value={form.meter_unit_price}
                onChange={e => handleChange('meter_unit_price', e.target.value)}
                placeholder="例: 100"
                className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          {error && <p className="text-accent2 text-xs">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              {saving ? '保存中...' : editId ? '更新' : '登録'}
            </button>
            {editId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-5 bg-surface2 border border-border text-text font-bold py-2.5 rounded-xl text-sm"
              >
                キャンセル
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
