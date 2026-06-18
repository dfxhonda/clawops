import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMachineModels, addMachineModel, updateMachineModel, deleteMachineModel } from '../../services/masters'
import { supabase } from '../../lib/supabase'
import LogoutButton from '../../components/LogoutButton'

const TYPE_OPTIONS = ['crane', 'gacha', 'other']
const TYPE_LABELS  = { crane: 'クレーン', gacha: 'ガチャ', other: 'その他' }

const SORT_OPTIONS = [
  { v: 'name_asc',  l: '名前 ↑' },
  { v: 'name_desc', l: '名前 ↓' },
  { v: 'newest',    l: '登録日 新' },
  { v: 'oldest',    l: '登録日 古' },
]

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
  width_mm: '',
  depth_mm: '',
  height_mm: '',
  image_url: '',
  notes: '',
}

export default function ModelList() {
  const navigate = useNavigate()
  const [models, setModels]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [editId, setEditId]       = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [searching, setSearching] = useState(false)
  const [specCandidate, setSpecCandidate] = useState(null)

  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sort, setSort]             = useState('name_asc')

  const [gridMode, setGridMode]     = useState(false)
  const [gridEdits, setGridEdits]   = useState({})
  const [gridSaving, setGridSaving] = useState(false)

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

  const filtered = useMemo(() => {
    let r = models
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
  }, [models, typeFilter, search, sort])

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

  const openNew = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setError('')
    setSpecCandidate(null)
    setShowModal(true)
  }

  const openEdit = m => {
    setEditId(m.model_id)
    setForm({
      model_name:       m.model_name      || '',
      type_id:          m.type_id         || '',
      manufacturer:     m.manufacturer    || '',
      booth_count:      m.booth_count     ?? '',
      in_meter_count:   m.in_meter_count  ?? '',
      out_meter_count:  m.out_meter_count ?? '',
      meter_unit_price: m.meter_unit_price ?? '',
      size_info:        m.size_info       || '',
      weight_kg:        m.weight_kg       ?? '',
      power_w:          m.power_w         ?? '',
      width_mm:         m.width_mm        ?? '',
      depth_mm:         m.depth_mm        ?? '',
      height_mm:        m.height_mm       ?? '',
      image_url:        m.image_url       || '',
      notes:            m.notes           || '',
    })
    setError('')
    setSpecCandidate(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
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
      } else {
        await addMachineModel(form)
      }
      closeModal()
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
      const { data, error: fnErr } = await supabase.functions.invoke('model-spec-search', {
        body: { modelName: q },
      })
      if (fnErr) throw fnErr
      if (!data?.spec) throw new Error('仕様情報を取得できませんでした')
      setSpecCandidate(data.spec)
    } catch (e) {
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
      size_info:    specCandidate.size_info     ?? f.size_info,
      weight_kg:    specCandidate.weight_kg  != null ? String(specCandidate.weight_kg)  : f.weight_kg,
      power_w:      specCandidate.power_w    != null ? String(specCandidate.power_w)    : f.power_w,
      image_url:    specCandidate.image_url     ?? f.image_url,
    }))
    setSpecCandidate(null)
  }

  function setGCell(id, key, val) {
    setGridEdits(prev => {
      const row = models.find(r => r.model_id === id)
      const base = prev[id] ?? {
        model_name:       row?.model_name       ?? '',
        type_id:          row?.type_id          ?? 'crane',
        manufacturer:     row?.manufacturer     ?? '',
        meter_unit_price: row?.meter_unit_price ?? '',
        in_meter_count:   row?.in_meter_count   ?? '',
        out_meter_count:  row?.out_meter_count  ?? '',
      }
      return { ...prev, [id]: { ...base, [key]: val } }
    })
  }

  async function saveGridEdits() {
    setGridSaving(true)
    for (const [id, ge] of Object.entries(gridEdits)) {
      const row = models.find(r => r.model_id === id)
      const patch = {
        ...row,
        model_name:       ge.model_name,
        type_id:          ge.type_id,
        manufacturer:     ge.manufacturer || null,
        meter_unit_price: ge.meter_unit_price !== '' ? Number(ge.meter_unit_price) : null,
        in_meter_count:   ge.in_meter_count  !== '' ? Number(ge.in_meter_count)   : null,
        out_meter_count:  ge.out_meter_count !== '' ? Number(ge.out_meter_count)  : null,
      }
      try {
        await updateMachineModel(id, patch)
      } catch (e) {
        alert(e.message || '保存に失敗しました')
        setGridSaving(false)
        return
      }
    }
    setGridSaving(false)
    setGridEdits({})
    await loadModels()
  }

  const inputCls    = 'w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent'
  const gridCellCls = 'w-full h-8 px-1.5 bg-transparent border-0 text-text text-sm outline-none focus:bg-surface rounded'

  return (
    <div className="h-full flex flex-col">

      {/* ヘッダー */}
      <div className="shrink-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-3 print:hidden" style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#3b82f6' }}>
        <button onClick={() => navigate('/admin/menu')} className="text-2xl text-muted">←</button>
        <div className="flex-1">
          <h2 className="text-base font-bold">機種マスタ</h2>
          <p className="text-[11px] text-muted">機種の登録・編集・削除</p>
        </div>
        <LogoutButton to="/admin/menu" />
      </div>

      <div className="flex-1 overflow-y-auto pb-16">

        {/* 検索 / フィルタ / ソート / 新規 / 表編集 */}
        <div className="px-4 pt-3 pb-2 space-y-2 border-b border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="名前 / メーカーで検索"
              className={inputCls + ' flex-1'}
            />
            <button
              onClick={openNew}
              className="shrink-0 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg"
            >
              ＋ 新規
            </button>
            <button
              onClick={() => { setGridMode(m => !m); setGridEdits({}) }}
              className={`shrink-0 px-3 py-2 text-xs font-bold rounded-lg border transition-colors ${gridMode ? 'bg-amber-500 text-white border-transparent' : 'bg-bg text-text border-border hover:bg-surface'}`}
            >
              {gridMode ? '⊞ 編集中' : '⊞ 表編集'}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => setTypeFilter('')}
              className={`px-3 py-1 rounded-full text-xs font-medium border min-h-[32px] ${typeFilter === '' ? 'bg-blue-500 text-white border-blue-500' : 'bg-bg text-text border-border hover:bg-surface'}`}
            >
              全種別
            </button>
            {TYPE_OPTIONS.map(t => (
              <button key={t} onClick={() => setTypeFilter(prev => prev === t ? '' : t)}
                className={`px-3 py-1 rounded-full text-xs font-medium border min-h-[32px] ${typeFilter === t ? 'bg-blue-500 text-white border-blue-500' : 'bg-bg text-text border-border hover:bg-surface'}`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="ml-auto border border-border rounded-lg px-2 py-1 text-xs bg-bg text-text"
            >
              {SORT_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <span className="text-xs text-muted">{filtered.length}件</span>
          </div>
        </div>

        {/* grid save bar */}
        {gridMode && Object.keys(gridEdits).length > 0 && (
          <div className="px-4 py-2 bg-amber-900/20 border-b border-amber-200 flex items-center gap-2">
            <span className="text-xs text-amber-700">{Object.keys(gridEdits).length}件 変更あり</span>
            <button onClick={() => setGridEdits({})} className="ml-auto text-xs text-muted px-3 py-1 rounded border border-border">取消</button>
            <button onClick={saveGridEdits} disabled={gridSaving} className="text-xs text-white bg-blue-500 px-4 py-1 rounded font-bold disabled:opacity-50">
              {gridSaving ? '保存中…' : '一括保存'}
            </button>
          </div>
        )}

        {/* 一覧ヘッダー */}
        <div className="px-4 mt-3 flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold text-muted uppercase tracking-wide">
            登録済み機種 {!loading && `（${models.length}件）`}
          </p>
        </div>

        {/* 一覧 */}
        <div className="px-4 md:max-w-4xl md:mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2">
              <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full" />
              <span className="text-muted text-sm">読み込み中...</span>
            </div>
          ) : models.length === 0 ? (
            <div className="text-center py-10 text-muted text-sm border border-border border-dashed rounded-xl">
              登録された機種がありません
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">検索条件に一致する機種がありません</p>
          ) : gridMode ? (
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted text-left bg-surface text-xs font-bold">
                    <th className="py-1.5 px-2">機種名</th>
                    <th className="py-1.5 px-2">種別</th>
                    <th className="py-1.5 px-2">メーカー</th>
                    <th className="py-1.5 px-2 text-right">単価</th>
                    <th className="py-1.5 px-2 text-right">IN</th>
                    <th className="py-1.5 px-2 text-right">OUT</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const ge = gridEdits[row.model_id]
                    return (
                      <tr key={row.model_id} className={`border-b border-border ${ge ? 'bg-amber-900/20' : 'hover:bg-surface'}`}>
                        <td className="py-0.5 px-1">
                          <input value={ge?.model_name ?? row.model_name ?? ''} onChange={ev => setGCell(row.model_id, 'model_name', ev.target.value)} className={gridCellCls} />
                        </td>
                        <td className="py-0.5 px-1">
                          <select value={ge?.type_id ?? row.type_id ?? ''} onChange={ev => setGCell(row.model_id, 'type_id', ev.target.value)} className="h-8 px-1 bg-bg border border-border text-text text-xs rounded w-full">
                            {TYPE_OPTIONS.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                          </select>
                        </td>
                        <td className="py-0.5 px-1">
                          <input value={ge?.manufacturer ?? row.manufacturer ?? ''} onChange={ev => setGCell(row.model_id, 'manufacturer', ev.target.value)} className={gridCellCls} />
                        </td>
                        <td className="py-0.5 px-1">
                          <input type="number" value={ge?.meter_unit_price ?? row.meter_unit_price ?? ''} onChange={ev => setGCell(row.model_id, 'meter_unit_price', ev.target.value)} className={`${gridCellCls} text-right`} />
                        </td>
                        <td className="py-0.5 px-1">
                          <input type="number" value={ge?.in_meter_count ?? row.in_meter_count ?? ''} onChange={ev => setGCell(row.model_id, 'in_meter_count', ev.target.value)} className={`${gridCellCls} text-right`} />
                        </td>
                        <td className="py-0.5 px-1">
                          <input type="number" value={ge?.out_meter_count ?? row.out_meter_count ?? ''} onChange={ev => setGCell(row.model_id, 'out_meter_count', ev.target.value)} className={`${gridCellCls} text-right`} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
                    {filtered.map(m => (
                      <tr key={m.model_id} className="border-t border-border hover:bg-surface2/50 transition-colors">
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
                            <button onClick={() => openEdit(m)} className="text-[11px] text-accent border border-border rounded px-2 py-1 hover:bg-surface2 transition-colors">編集</button>
                            <button onClick={() => handleDelete(m)} className="text-[11px] text-accent2 border border-border rounded px-2 py-1 hover:bg-surface2 transition-colors">削除</button>
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
      </div>

      {/* モーダル */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-bg rounded-xl w-full max-w-lg md:max-w-2xl max-h-[90vh] flex flex-col shadow-xl">

            <div className="sticky top-0 bg-bg rounded-t-xl px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="text-sm font-bold text-accent">
                {editId ? '✏️ 機種を編集' : '＋ 新規機種登録'}
              </h2>
              <button onClick={closeModal} className="text-muted text-xl leading-none px-1">✕</button>
            </div>

            <form id="model-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-4 py-3 space-y-3">

              {/* 機種名 + 仕様検索 */}
              <div>
                <label className="block text-xs text-muted mb-1">機種名 <span className="text-accent2">*</span></label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.model_name}
                    onChange={e => handleChange('model_name', e.target.value)}
                    placeholder="例: バズクレ4"
                    className={inputCls + ' flex-1'}
                  />
                  <button
                    type="button"
                    onClick={handleSpecSearch}
                    disabled={!form.model_name.trim() || searching}
                    className="shrink-0 px-3 py-2 rounded-lg border border-border text-xs font-bold text-muted bg-surface2 hover:bg-bg disabled:opacity-40 whitespace-nowrap"
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
                    <button type="button" onClick={applySpecCandidate} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded-lg text-xs">全てフォームに反映</button>
                    <button type="button" onClick={() => setSpecCandidate(null)} className="px-3 bg-surface border border-border text-muted font-bold py-1.5 rounded-lg text-xs">閉じる</button>
                  </div>
                </div>
              )}

              {/* カテゴリ */}
              <div>
                <label className="block text-xs text-muted mb-1">カテゴリ <span className="text-accent2">*</span></label>
                <select value={form.type_id} onChange={e => handleChange('type_id', e.target.value)} className={inputCls}>
                  <option value="">カテゴリを選択</option>
                  <option value="crane">クレーン</option>
                  <option value="gacha">ガチャ</option>
                  <option value="other">その他</option>
                </select>
              </div>

              {/* メーカー */}
              <div>
                <label className="block text-xs text-muted mb-1">メーカー</label>
                <input type="text" value={form.manufacturer} onChange={e => handleChange('manufacturer', e.target.value)} placeholder="例: SEGA" className={inputCls} />
              </div>

              {/* ブース数 / IN / OUT / 単価 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">ブース数</label>
                  <input type="number" min="1" value={form.booth_count} onChange={e => handleChange('booth_count', e.target.value)} placeholder="例: 2" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">INメーター数</label>
                  <input type="number" min="1" value={form.in_meter_count} onChange={e => handleChange('in_meter_count', e.target.value)} placeholder={form.booth_count || '例: 7'} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">OUTメーター数</label>
                  <input type="number" min="1" value={form.out_meter_count} onChange={e => handleChange('out_meter_count', e.target.value)} placeholder={form.in_meter_count || '例: 7'} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">単価（円）</label>
                  <input type="number" min="0" value={form.meter_unit_price} onChange={e => handleChange('meter_unit_price', e.target.value)} placeholder="例: 100" className={inputCls} />
                </div>
              </div>

              {/* サイズ text + 個別 int */}
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-muted mb-1">サイズ テキスト（W×D×H mm）</label>
                  <input type="text" value={form.size_info} onChange={e => handleChange('size_info', e.target.value)} placeholder="例: 900×900×1800 mm" className={inputCls} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-muted mb-1">幅 width_mm</label>
                    <input type="number" min="0" value={form.width_mm} onChange={e => handleChange('width_mm', e.target.value)} placeholder="900" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">奥行 depth_mm</label>
                    <input type="number" min="0" value={form.depth_mm} onChange={e => handleChange('depth_mm', e.target.value)} placeholder="900" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">高さ height_mm</label>
                    <input type="number" min="0" value={form.height_mm} onChange={e => handleChange('height_mm', e.target.value)} placeholder="1800" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* 重量 / 消費電力 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">重量（kg）</label>
                  <input type="number" min="0" step="0.1" value={form.weight_kg} onChange={e => handleChange('weight_kg', e.target.value)} placeholder="例: 120" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">消費電力（W）</label>
                  <input type="number" min="0" value={form.power_w} onChange={e => handleChange('power_w', e.target.value)} placeholder="例: 350" className={inputCls} />
                </div>
              </div>

              {/* 画像URL */}
              <div>
                <label className="block text-xs text-muted mb-1">画像URL</label>
                <input type="url" value={form.image_url} onChange={e => handleChange('image_url', e.target.value)} placeholder="https://..." className={inputCls} />
                {form.image_url && (
                  <img src={form.image_url} alt="プレビュー" className="mt-2 rounded-lg max-h-32 object-contain border border-border" />
                )}
              </div>

              {/* 備考 */}
              <div>
                <label className="block text-xs text-muted mb-1">備考</label>
                <textarea
                  value={form.notes}
                  onChange={e => handleChange('notes', e.target.value)}
                  rows={2}
                  placeholder="メモを入力..."
                  className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent resize-none"
                />
              </div>

              {error && <p className="text-accent2 text-xs pb-1">{error}</p>}
            </form>

            <div className="sticky bottom-0 bg-bg rounded-b-xl px-4 py-3 border-t border-border flex gap-2 shrink-0">
              <button type="button" onClick={closeModal} className="px-4 bg-surface2 border border-border text-text font-bold py-2.5 rounded-xl text-sm">キャンセル</button>
              <button
                type="submit"
                form="model-form"
                disabled={saving}
                onClick={handleSubmit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
              >
                {saving ? '保存中...' : editId ? '更新' : '登録'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
