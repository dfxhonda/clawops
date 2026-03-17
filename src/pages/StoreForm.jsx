import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllStoresRaw, addStore, updateStore } from '../services/sheets'

const FIELDS = [
  { key: 'store_code', label: '店舗コード', placeholder: 'KIK01', required: true },
  { key: 'store_name', label: '店舗名', placeholder: '菊陽店', required: true },
  { key: 'store_address', label: '住所', placeholder: '熊本県...' },
  { key: 'store_tel', label: '電話番号', placeholder: '096-xxx-xxxx' },
  { key: 'accounting_contact_name', label: '経理担当者' },
  { key: 'accounting_contact_tel', label: '経理連絡先' },
  { key: 'settlement_cycle', label: '精算サイクル', placeholder: '月次' },
  { key: 'contract_rate_store', label: '店舗取り分(%)', placeholder: '70' },
  { key: 'contract_rate_fc', label: 'FC取り分(%)', placeholder: '20' },
  { key: 'note', label: '備考' },
]

export default function StoreForm() {
  const navigate = useNavigate()
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null=一覧, 'new'=新規, {store}=編集
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const s = await getAllStoresRaw()
      setStores(s)
    } catch (e) { setMsg('読み込みエラー: ' + e.message) }
    setLoading(false)
  }

  function startNew() {
    setForm({ settlement_cycle: '月次', contract_rate_store: '70', contract_rate_fc: '20' })
    setEditing('new')
    setMsg('')
  }

  function startEdit(s) {
    setForm({ ...s })
    setEditing(s)
    setMsg('')
  }

  async function handleSave() {
    if (!form.store_code || !form.store_name) { setMsg('店舗コードと店舗名は必須です'); return }
    // コード形式チェック
    if (!/^[A-Z]{3}\d{2}$/.test(form.store_code)) { setMsg('店舗コード形式: 英字3文字+数字2桁 (例: KIK01)'); return }

    setSaving(true)
    try {
      if (editing === 'new') {
        await addStore(form)
        setMsg('✅ 店舗を登録しました')
      } else {
        await updateStore(editing._row, form)
        setMsg('✅ 店舗を更新しました')
      }
      setEditing(null)
      await load()
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
          <h1 className="text-xl font-bold text-accent">{editing === 'new' ? '新規店舗登録' : '店舗編集'}</h1>
        </div>

        {msg && <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm text-accent">{msg}</div>}

        <div className="space-y-4">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-muted text-sm mb-1">
                {f.label}{f.required && <span className="text-accent2 ml-1">*</span>}
              </label>
              <input
                type="text"
                value={form[f.key] || ''}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder || ''}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent"
              />
            </div>
          ))}

          {editing !== 'new' && (
            <div>
              <label className="block text-muted text-sm mb-1">ステータス</label>
              <select
                value={form.active_flag || '1'}
                onChange={e => setForm(prev => ({ ...prev, active_flag: e.target.value }))}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text"
              >
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
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-muted text-2xl">←</button>
        <h1 className="text-xl font-bold text-accent">店舗管理</h1>
        <button onClick={startNew} className="ml-auto bg-accent text-black font-bold rounded-lg px-4 py-2 text-sm">
          + 新規登録
        </button>
      </div>

      {msg && <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm text-accent">{msg}</div>}

      <div className="space-y-3">
        {stores.map(s => (
          <div key={s.store_id} onClick={() => startEdit(s)}
            className="bg-surface border border-border rounded-xl p-4 active:bg-surface2 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-accent font-mono font-bold mr-2">{s.store_code}</span>
                <span className="text-text">{s.store_name}</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${s.active_flag == 1 ? 'bg-accent3/20 text-accent3' : 'bg-accent2/20 text-accent2'}`}>
                {s.active_flag == 1 ? '有効' : '無効'}
              </span>
            </div>
            <div className="text-muted text-xs mt-1">
              {s.store_address && <span>{s.store_address}</span>}
              {s.contract_rate_store && <span className="ml-2">店舗{s.contract_rate_store}%</span>}
            </div>
          </div>
        ))}
        {stores.length === 0 && <div className="text-center text-muted py-8">店舗が登録されていません</div>}
      </div>
    </div>
  )
}
