import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMachineModels, addMachineModel, updateMachineModel, deleteMachineModel } from '../../services/masters'
import { supabase } from '../../lib/supabase'
import LogoutButton from '../../components/LogoutButton'
import AdminNav from '../../components/AdminNav'

const EMPTY_FORM = {
  model_name: '',
  type_id: '',
  manufacturer: '',
  booth_count: '',
  in_meter_count: '',
  out_meter_count: '',
  meter_unit_price: '',
  size_info: '',
  weight_kg: '',
  power_w: '',
  image_url: '',
  notes: '',
}

export default function ModelList() {
  const navigate = useNavigate()
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)
  const [specCandidate, setSpecCandidate] = useState(null)
  const formRef = useRef(null)

  const loadModels = async () => {
    setLoading(true)
    try {
      const data = await getMachineModels()
      setModels(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadModels() }, [])

  const handleChange = (field, value) => {
    setForm(f => {
      const next = { ...f, [field]: value }
      if (field === 'booth_count') {
        if (!f.in_meter_count) next.in_meter_count = value
        if (!f.out_meter_count) next.out_meter_count = value
      }
      return next
    })
  }

  const startEdit = m => {
    setEditId(m.model_id)
    setForm({
      model_name: m.model_name || '',
      type_id: m.type_id || '',
      manufacturer: m.manufacturer || '',
      booth_count: m.booth_count ?? '',
      in_meter_count: m.in_meter_count ?? '',
      out_meter_count: m.out_meter_count ?? '',
      meter_unit_price: m.meter_unit_price ?? '',
      size_info: m.size_info || '',
      weight_kg: m.weight_kg ?? '',
      power_w: m.power_w ?? '',
      image_url: m.image_url || '',
      notes: m.notes || '',
    })
    setError('')
    setSpecCandidate(null)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const cancelEdit = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setError('')
    setSpecCandidate(null)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.model_name.trim()) { setError('機種名は必須です'); return }
    if (!form.type_id) { setError('カテゴリを選択してください'); return }

    if (!editId) {
      const dup = models.find(m => m.model_name === form.model_name.trim())
      if (dup) {
        if (!window.confirm(`「${form.model_name}」は既に登録されています。続けますか？`)) return
      }
    }

    setSaving(true)
    setError('')
    try {
      if (editId) {
        await updateMachineModel(editId, form)
        setEditId(null)
      } else {
        await addMachineModel(form)
      }
      setForm(EMPTY_FORM)
      setSpecCandidate(null)
      await loadModels()
    } catch (err) {
      setError(err.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async m => {
    if (!window.confirm(`「${m.model_name}」を削除しますか？\nこの操作は取り消せません。`)) return
    try {
      await deleteMachineModel(m.model_id)
      if (editId === m.model_id) cancelEdit()
      await loadModels()
    } catch (err) {
      alert(err.message || '削除に失敗しました')
    }
  }

  const handleSpecSearch = async () => {
    const q = form.model_name.trim()
    if (!q) return

    setSearching(true)
    setSpecCandidate(null)
    try {
      const { data, error } = await supabase.functions.invoke('model-spec-search', {
        body: { modelName: q },
      })
      if (error) throw error
      if (!data?.spec) throw new Error('仕様情報を取得できませんでした')
      setSpecCandidate(data.spec)
    } catch (e) {
      console.error('仕様検索エラー:', e)
      alert('検索に失敗しました: ' + e.message)
    } finally {
      setSearching(false)
    }
  }

  const applySpecCandidate = () => {
    if (!specCandidate) return
    setForm(f => ({
      ...f,
      manufacturer: specCandidate.manufacturer ?? f.manufacturer,
      size_info: specCandidate.size_info ?? f.size_info,
      weight_kg: specCandidate.weight_kg != null ? String(specCandidate.weight_kg) : f.weight_kg,
      power_w: specCandidate.power_w != null ? String(specCandidate.power_w) : f.power_w,
      image_url: specCandidate.image_url ?? f.image_url,
    }))
    setSpecCandidate(null)
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
          登録済み機種 {!loading && `（${models.length}件）`}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2">
            <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full" />
            <span className="text-muted text-sm">読み込み中...</span>
          </div>
        ) : models.length === 0 ? (
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
                  {models.map(m => (
                    <tr
                      key={m.model_id}
                      className={`border-t border-border transition-colors ${
                        editId === m.model_id ? 'bg-accent/5' : 'hover:bg-surface2/50'
                      }`}
                    >
                      <td className="px-3 py-2.5 font-medium">
                        {m.model_name}
                        {m.size_info && (
                          <span className="block text-[10px] text-muted font-normal">{m.size_info}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted">{m.manufacturer || '—'}</td>
                      <td className="px-2 py-2.5 text-center text-xs">{m.booth_count ?? '—'}</td>
                      <td className="px-2 py-2.5 text-center text-xs">{m.in_meter_count ?? '—'}</td>
                      <td className="px-2 py-2.5 text-center text-xs">{m.out_meter_count ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right text-xs">
                        {m.meter_unit_price != null ? `¥${m.meter_unit_price}` : '—'}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(m)}
                            className="text-[11px] text-accent border border-border rounded px-2 py-1 hover:bg-surface2 transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(m)}
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
                value={form.model_name}
                onChange={e => handleChange('model_name', e.target.value)}
                placeholder="例: バズクレ4"
                className="flex-1 bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={handleSpecSearch}
                disabled={!form.model_name.trim() || searching}
                className="shrink-0 px-3 py-2 rounded-lg border border-border text-xs font-bold text-muted bg-surface2 hover:bg-bg disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {searching ? '検索中...' : '仕様を検索'}
              </button>
            </div>
          </div>

          {/* 仕様検索結果 */}
          {specCandidate && (
            <div className="rounded-xl border border-border bg-surface2 p-3 text-xs space-y-1.5">
              <p className="font-bold text-muted uppercase tracking-wide text-[10px]">検索結果（参考）</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted">メーカー</span>
                <span className="font-medium">{specCandidate.manufacturer ?? '—'}</span>
                <span className="text-muted">サイズ</span>
                <span className="font-medium">{specCandidate.size_info ?? '—'}</span>
                <span className="text-muted">重量</span>
                <span className="font-medium">{specCandidate.weight_kg != null ? `${specCandidate.weight_kg} kg` : '—'}</span>
                <span className="text-muted">消費電力</span>
                <span className="font-medium">{specCandidate.power_w != null ? `${specCandidate.power_w} W` : '—'}</span>
              </div>
              {specCandidate.image_url && (
                <img src={specCandidate.image_url} alt="製品画像" className="mt-2 rounded-lg max-h-32 object-contain border border-border" />
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={applySpecCandidate}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded-lg text-xs transition-colors"
                >
                  全てフォームに反映
                </button>
                <button
                  type="button"
                  onClick={() => setSpecCandidate(null)}
                  className="px-3 bg-surface border border-border text-muted font-bold py-1.5 rounded-lg text-xs"
                >
                  閉じる
                </button>
              </div>
            </div>
          )}

          {/* カテゴリ（type_id） */}
          <div>
            <label className="block text-xs text-muted mb-1">
              カテゴリ <span className="text-accent2">*</span>
            </label>
            <select
              value={form.type_id}
              onChange={e => handleChange('type_id', e.target.value)}
              className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">カテゴリを選択</option>
              <option value="crane">クレーン</option>
              <option value="gacha">ガチャ</option>
              <option value="other">その他</option>
            </select>
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
              <label className="block text-xs text-muted mb-1">INメーター数</label>
              <input
                type="number"
                min="1"
                value={form.in_meter_count}
                onChange={e => handleChange('in_meter_count', e.target.value)}
                placeholder={form.booth_count || '例: 7'}
                className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">OUTメーター数</label>
              <input
                type="number"
                min="1"
                value={form.out_meter_count}
                onChange={e => handleChange('out_meter_count', e.target.value)}
                placeholder={form.in_meter_count || '例: 7'}
                className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
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

          {/* スペック情報 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-muted mb-1">サイズ（W×D×H mm）</label>
              <input
                type="text"
                value={form.size_info}
                onChange={e => handleChange('size_info', e.target.value)}
                placeholder="例: 900×900×1800 mm"
                className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">重量（kg）</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.weight_kg}
                onChange={e => handleChange('weight_kg', e.target.value)}
                placeholder="例: 120"
                className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">消費電力（W）</label>
              <input
                type="number"
                min="0"
                value={form.power_w}
                onChange={e => handleChange('power_w', e.target.value)}
                placeholder="例: 350"
                className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* 画像URL */}
          <div>
            <label className="block text-xs text-muted mb-1">画像URL</label>
            <input
              type="url"
              value={form.image_url}
              onChange={e => handleChange('image_url', e.target.value)}
              placeholder="https://..."
              className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {form.image_url && (
              <img src={form.image_url} alt="プレビュー" className="mt-2 rounded-lg max-h-32 object-contain border border-border" />
            )}
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
