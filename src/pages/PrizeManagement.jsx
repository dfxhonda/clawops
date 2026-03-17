import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPrizes, addPrize, updatePrize, getPrizeOrders, addPrizeOrder } from '../services/sheets'

const TABS = [
  { key: 'master', label: '景品マスタ' },
  { key: 'orders', label: '発注履歴' },
]

export default function PrizeManagement() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('master')
  const [prizes, setPrizes] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [p, o] = await Promise.all([getPrizes(), getPrizeOrders()])
      setPrizes(p)
      setOrders(o)
    } catch (e) { setMsg('読み込みエラー: ' + e.message) }
    setLoading(false)
  }

  // --- 景品マスタ ---
  function startNewPrize() {
    setForm({ unit_cost: '0', is_active: 'TRUE' })
    setEditing({ type: 'prize', mode: 'new' })
    setMsg('')
  }

  function startEditPrize(p) {
    setForm({ ...p })
    setEditing({ type: 'prize', mode: 'edit', data: p })
    setMsg('')
  }

  async function savePrize() {
    if (!form.prize_name) { setMsg('景品名は必須です'); return }
    setSaving(true)
    try {
      if (editing.mode === 'new') {
        await addPrize(form)
        setMsg('✅ 景品を登録しました')
      } else {
        await updatePrize(editing.data._row, form)
        setMsg('✅ 景品を更新しました')
      }
      setEditing(null)
      await loadData()
    } catch (e) { setMsg('保存エラー: ' + e.message) }
    setSaving(false)
  }

  // --- 発注 ---
  function startNewOrder() {
    setForm({ ordered_at: new Date().toISOString().slice(0,10) })
    setEditing({ type: 'order', mode: 'new' })
    setMsg('')
  }

  async function saveOrder() {
    if (!form.prize_id || !form.order_quantity) { setMsg('景品と数量は必須です'); return }
    const p = prizes.find(x => String(x.prize_id) === String(form.prize_id))
    setSaving(true)
    try {
      await addPrizeOrder({
        ...form,
        prize_name: p?.prize_name || '',
        unit_cost_at_order: form.unit_cost_at_order || p?.unit_cost || '0',
      })
      setMsg('✅ 発注を登録しました')
      setEditing(null)
      await loadData()
    } catch (e) { setMsg('保存エラー: ' + e.message) }
    setSaving(false)
  }

  const filteredPrizes = prizes.filter(p =>
    !search || p.prize_name?.includes(search) || p.supplier_name?.includes(search)
  )

  if (loading) return <div className="min-h-screen bg-bg text-text flex items-center justify-center">読み込み中...</div>

  // --- 編集フォーム ---
  if (editing) {
    if (editing.type === 'prize') return (
      <div className="min-h-screen bg-bg text-text p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setEditing(null)} className="text-muted text-2xl">←</button>
          <h1 className="text-xl font-bold text-accent">{editing.mode === 'new' ? '景品登録' : '景品編集'}</h1>
        </div>
        {msg && <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm text-accent">{msg}</div>}
        <div className="space-y-4">
          <Field label="景品名" k="prize_name" required />
          <Field label="JANコード" k="jan_code" placeholder="空欄可" />
          <Field label="仕入単価(円)" k="unit_cost" type="number" />
          <Field label="サプライヤー" k="supplier_name" />
          <Field label="サプライヤー連絡先" k="supplier_contact" />
          {editing.mode === 'edit' && (
            <div>
              <label className="block text-muted text-sm mb-1">ステータス</label>
              <select value={form.is_active||'TRUE'} onChange={e => setForm(p=>({...p, is_active:e.target.value}))}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text">
                <option value="TRUE">有効</option>
                <option value="FALSE">無効</option>
              </select>
            </div>
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={() => setEditing(null)} className="flex-1 bg-surface2 text-muted rounded-lg py-3">キャンセル</button>
          <button onClick={savePrize} disabled={saving}
            className="flex-1 bg-accent text-black font-bold rounded-lg py-3 disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    )

    if (editing.type === 'order') return (
      <div className="min-h-screen bg-bg text-text p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setEditing(null)} className="text-muted text-2xl">←</button>
          <h1 className="text-xl font-bold text-accent">新規発注</h1>
        </div>
        {msg && <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm text-accent">{msg}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-muted text-sm mb-1">景品 <span className="text-accent2">*</span></label>
            <select value={form.prize_id||''} onChange={e => {
              const p = prizes.find(x => String(x.prize_id) === e.target.value)
              setForm(prev => ({...prev, prize_id: e.target.value, unit_cost_at_order: p?.unit_cost||'0'}))
            }} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text">
              <option value="">選択してください</option>
              {prizes.filter(p=>p.is_active==='TRUE').map(p => (
                <option key={p.prize_id} value={p.prize_id}>{p.prize_name} (¥{p.unit_cost})</option>
              ))}
            </select>
          </div>
          <Field label="発注日" k="ordered_at" type="date" />
          <Field label="発注数" k="order_quantity" type="number" required />
          <Field label="発注時単価" k="unit_cost_at_order" type="number" />
          {form.order_quantity && form.unit_cost_at_order && (
            <div className="bg-surface2 rounded-lg p-3 text-center">
              <span className="text-muted text-sm">合計: </span>
              <span className="text-accent font-bold text-lg">
                ¥{((parseInt(form.order_quantity)||0) * (parseInt(form.unit_cost_at_order)||0)).toLocaleString()}
              </span>
            </div>
          )}
          <Field label="備考" k="note" />
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={() => setEditing(null)} className="flex-1 bg-surface2 text-muted rounded-lg py-3">キャンセル</button>
          <button onClick={saveOrder} disabled={saving}
            className="flex-1 bg-accent text-black font-bold rounded-lg py-3 disabled:opacity-50">
            {saving ? '保存中...' : '発注登録'}
          </button>
        </div>
      </div>
    )
  }

  function Field({ label, k, type='text', placeholder='', required }) {
    return (
      <div>
        <label className="block text-muted text-sm mb-1">{label}{required && <span className="text-accent2 ml-1">*</span>}</label>
        <input type={type} value={form[k]||''} onChange={e => setForm(p=>({...p, [k]:e.target.value}))}
          placeholder={placeholder}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent" />
      </div>
    )
  }

  // --- メイン一覧 ---
  return (
    <div className="min-h-screen bg-bg text-text p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/')} className="text-muted text-2xl">←</button>
        <h1 className="text-xl font-bold text-accent">景品管理</h1>
      </div>

      {msg && <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm text-accent">{msg}</div>}

      {/* タブ */}
      <div className="flex bg-surface rounded-xl p-1 mb-4">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === t.key ? 'bg-accent text-black' : 'text-muted'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* 景品マスタ */}
      {tab === 'master' && (
        <>
          <div className="flex gap-2 mb-4">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="景品名・サプライヤー検索" className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
            <button onClick={startNewPrize} className="bg-accent text-black font-bold rounded-lg px-3 py-2 text-sm whitespace-nowrap">
              + 新規
            </button>
          </div>
          <div className="space-y-2">
            {filteredPrizes.map(p => (
              <div key={p.prize_id} onClick={() => startEditPrize(p)}
                className="bg-surface border border-border rounded-xl p-3 active:bg-surface2 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="text-text font-bold truncate block">{p.prize_name}</span>
                    <div className="text-muted text-xs mt-0.5 flex gap-2">
                      <span>¥{parseInt(p.unit_cost||0).toLocaleString()}</span>
                      <span>{p.supplier_name}</span>
                      {p.jan_code && <span className="font-mono">{p.jan_code}</span>}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ml-2 ${
                    p.is_active === 'TRUE' ? 'bg-accent3/20 text-accent3' : 'bg-accent2/20 text-accent2'
                  }`}>{p.is_active === 'TRUE' ? '有効' : '無効'}</span>
                </div>
              </div>
            ))}
            {filteredPrizes.length === 0 && <div className="text-center text-muted py-8">景品が登録されていません</div>}
          </div>
        </>
      )}

      {/* 発注履歴 */}
      {tab === 'orders' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={startNewOrder} className="bg-accent text-black font-bold rounded-lg px-4 py-2 text-sm">
              + 新規発注
            </button>
          </div>
          <div className="space-y-2">
            {orders.map(o => {
              const status = !o.arrived_at ? '未入荷' : (parseInt(o.arrival_quantity||0) < parseInt(o.order_quantity||0) ? '一部入荷' : '入荷済')
              const statusColor = status === '未入荷' ? 'bg-accent2/20 text-accent2' : status === '入荷済' ? 'bg-accent3/20 text-accent3' : 'bg-accent/20 text-accent'
              return (
                <div key={o.order_id} className="bg-surface border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-text font-bold">{o.prize_name}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColor}`}>{status}</span>
                  </div>
                  <div className="text-muted text-xs mt-1 flex gap-3">
                    <span>{o.ordered_at}</span>
                    <span>×{o.order_quantity}</span>
                    <span>¥{parseInt(o.total_cost||0).toLocaleString()}</span>
                  </div>
                </div>
              )
            })}
            {orders.length === 0 && <div className="text-center text-muted py-8">発注履歴がありません</div>}
          </div>
        </>
      )}
    </div>
  )
}
