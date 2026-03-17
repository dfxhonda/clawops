import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAllMachinesRaw, addMachine, updateMachine, getAllStoresRaw } from '../services/sheets'

const MACHINE_TYPES = [
  'BUZZ_CRANE_4', 'BUZZ_CRANE_SLIM', 'BUZZ_CRANE_MINI',
  'SESAME_W', 'HIGH_GACHA', '500_GACHA', 'OTHER'
]

export default function MachineForm() {
  const navigate = useNavigate()
  const { storeId } = useParams()
  const [machines, setMachines] = useState([])
  const [stores, setStores] = useState([])
  const [selStore, setSelStore] = useState(storeId || '')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadAll() }, [])
  useEffect(() => { if (selStore) loadMachines() }, [selStore])

  async function loadAll() {
    setLoading(true)
    try {
      const s = await getAllStoresRaw()
      setStores(s.filter(x => x.active_flag == 1))
      if (!selStore && s.length > 0) setSelStore(s[0].store_id)
    } catch (e) { setMsg('読み込みエラー: ' + e.message) }
    setLoading(false)
  }

  async function loadMachines() {
    try {
      const m = await getAllMachinesRaw(selStore)
      setMachines(m)
    } catch (e) { setMsg('機械読み込みエラー: ' + e.message) }
  }

  function getStoreCode() {
    const st = stores.find(s => String(s.store_id) === String(selStore))
    return st?.store_code || ''
  }

  function getNextMachineCode() {
    const existing = machines.map(m => parseInt(m.machine_code?.replace('M',''))||0)
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 1
    return `M${String(next).padStart(2,'0')}`
  }

  function startNew() {
    setForm({
      store_id: selStore,
      machine_code: getNextMachineCode(),
      machine_type: 'BUZZ_CRANE_4',
      booth_count: '4',
      default_price: '100',
      store_code: getStoreCode(),
    })
    setEditing('new')
    setMsg('')
  }

  function startEdit(m) {
    setForm({ ...m, store_code: getStoreCode() })
    setEditing(m)
    setMsg('')
  }

  async function handleSave() {
    if (!form.machine_code) { setMsg('機械コードは必須です'); return }
    if (!/^M\d{2}$/.test(form.machine_code)) { setMsg('機械コード形式: M+2桁 (例: M01)'); return }

    setSaving(true)
    try {
      if (editing === 'new') {
        await addMachine({ ...form, store_code: getStoreCode() })
        setMsg('✅ 機械を登録しました（ブースも自動生成済み）')
      } else {
        await updateMachine(editing._row, form)
        setMsg('✅ 機械を更新しました')
      }
      setEditing(null)
      await loadMachines()
    } catch (e) { setMsg('保存エラー: ' + e.message) }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-bg text-text flex items-center justify-center">読み込み中...</div>

  // 編集/新規フォーム
  if (editing !== null) {
    return (
      <div className="min-h-screen bg-bg text-text p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setEditing(null)} className="text-muted text-2xl">←</button>
          <h1 className="text-xl font-bold text-accent">{editing === 'new' ? '新規機械登録' : '機械編集'}</h1>
        </div>

        {msg && <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm text-accent">{msg}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-muted text-sm mb-1">機械コード <span className="text-accent2">*</span></label>
            <input type="text" value={form.machine_code||''} onChange={e => setForm(p=>({...p, machine_code:e.target.value}))}
              placeholder="M01" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">機械名</label>
            <input type="text" value={form.machine_name||''} onChange={e => setForm(p=>({...p, machine_name:e.target.value}))}
              placeholder="BUZZ CRANE 4P" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">機械モデル</label>
            <input type="text" value={form.machine_model||''} onChange={e => setForm(p=>({...p, machine_model:e.target.value}))}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">機械タイプ</label>
            <select value={form.machine_type||''} onChange={e => setForm(p=>({...p, machine_type:e.target.value}))}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text">
              {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-muted text-sm mb-1">ブース数</label>
              <input type="number" value={form.booth_count||''} onChange={e => setForm(p=>({...p, booth_count:e.target.value}))}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent" />
              {editing === 'new' && <p className="text-muted text-xs mt-1">※ ブースが自動生成されます</p>}
            </div>
            <div>
              <label className="block text-muted text-sm mb-1">プレイ単価</label>
              <input type="number" value={form.default_price||''} onChange={e => setForm(p=>({...p, default_price:e.target.value}))}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">レンタルコード</label>
            <input type="text" value={form.rental_code||''} onChange={e => setForm(p=>({...p, rental_code:e.target.value}))}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">設置場所メモ</label>
            <input type="text" value={form.location_note||''} onChange={e => setForm(p=>({...p, location_note:e.target.value}))}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent" />
          </div>

          {editing !== 'new' && (
            <div>
              <label className="block text-muted text-sm mb-1">ステータス</label>
              <select value={form.active_flag||'1'} onChange={e => setForm(p=>({...p, active_flag:e.target.value}))}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text">
                <option value="1">有効</option>
                <option value="0">無効</option>
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={() => setEditing(null)} className="flex-1 bg-surface2 text-muted rounded-lg py-3">キャンセル</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-accent text-black font-bold rounded-lg py-3 disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    )
  }

  // 一覧
  return (
    <div className="min-h-screen bg-bg text-text p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/')} className="text-muted text-2xl">←</button>
        <h1 className="text-xl font-bold text-accent">機械管理</h1>
        <button onClick={startNew} className="ml-auto bg-accent text-black font-bold rounded-lg px-4 py-2 text-sm">
          + 新規登録
        </button>
      </div>

      {/* 店舗セレクタ */}
      <select value={selStore} onChange={e => setSelStore(e.target.value)}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text mb-4">
        {stores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_code} - {s.store_name}</option>)}
      </select>

      {msg && <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm text-accent">{msg}</div>}

      <div className="space-y-3">
        {machines.map(m => (
          <div key={m.machine_id} onClick={() => startEdit(m)}
            className="bg-surface border border-border rounded-xl p-4 active:bg-surface2 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-accent font-mono font-bold mr-2">{m.machine_code}</span>
                <span className="text-text">{m.machine_name || m.machine_type}</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${m.active_flag == 1 ? 'bg-accent3/20 text-accent3' : 'bg-accent2/20 text-accent2'}`}>
                {m.active_flag == 1 ? '有効' : '無効'}
              </span>
            </div>
            <div className="text-muted text-xs mt-1 flex gap-3">
              <span>ブース×{m.booth_count}</span>
              <span>¥{m.default_price}</span>
              {m.rental_code && <span>RC:{m.rental_code}</span>}
            </div>
          </div>
        ))}
        {machines.length === 0 && <div className="text-center text-muted py-8">この店舗に機械が登録されていません</div>}
      </div>
    </div>
  )
}
