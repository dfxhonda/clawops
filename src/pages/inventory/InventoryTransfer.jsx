import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLocations, getPrizeStocksExtended, transferStock, getStockMovements, getStores, getMachines, getBooths, getStaffMap } from '../../services/sheets'
import NumberInput from '../../components/NumberInput'

const TRANSFER_TYPES = [
  { key: 'loc2loc',   label: '拠点間移管',     icon: '🏢→🏢',  desc: '拠点から別の拠点へ' },
  { key: 'loc2staff', label: '拠点→担当車',    icon: '🏢→🚗',  desc: '担当者の車に積み込み' },
  { key: 'staff2loc', label: '担当車→拠点',    icon: '🚗→🏢',  desc: '車から拠点に戻す' },
  { key: 'staff2staff', label: '担当車間',     icon: '🚗→🚗',  desc: '担当者間の受け渡し' },
  { key: 'assort',    label: 'アソート配分',   icon: '📦→🚗🚗', desc: '1つの在庫を複数担当に分配' },
]

export default function InventoryTransfer() {
  const navigate = useNavigate()
  const [locations, setLocations] = useState([])
  const [stocks, setStocks] = useState([])
  const [recentTransfers, setRecentTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const [transferType, setTransferType] = useState('')
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [selectedStock, setSelectedStock] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')

  // 担当者リスト（在庫からユニークに抽出）
  const [staffList, setStaffList] = useState([])
  const [staffMap, setStaffMap] = useState({})

  // アソート配分用
  const [assortAllocations, setAssortAllocations] = useState([])
  // { staffName: '', quantity: '' }

  // 新規スタッフ追加入力
  const [newStaffName, setNewStaffName] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [l, s, mv, sm] = await Promise.all([getLocations(), getPrizeStocksExtended(), getStockMovements(), getStaffMap()])
        setLocations(l.filter(x => x.active_flag === '1'))
        setStocks(s)
        setStaffMap(sm)
        const staffIds = [...new Set(s.filter(x => x.owner_type === 'staff').map(x => x.owner_id))].filter(Boolean)
        setStaffList(staffIds)
        setRecentTransfers(mv.filter(m => m.movement_type === 'transfer').slice(-10).reverse())
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  // 移動元の在庫一覧
  const fromOwnerType = transferType === 'assort' ? 'location'
    : transferType.startsWith('loc') ? 'location'
    : transferType.startsWith('staff') ? 'staff' : ''
  const toOwnerType = transferType === 'assort' ? 'staff'
    : transferType.endsWith('loc') ? 'location'
    : transferType.endsWith('staff') ? 'staff' : ''

  const fromStocks = fromId
    ? stocks.filter(s => s.owner_type === fromOwnerType && s.owner_id === fromId && s.quantity > 0)
    : []

  // --- 通常移管 ---
  async function handleSubmit() {
    if (!selectedStock || !toId || !quantity) {
      setMessage({ type: 'error', text: '景品・移動先・数量を入力してください' })
      return
    }
    const qty = parseInt(quantity)
    if (qty > selectedStock.quantity) {
      setMessage({ type: 'error', text: `在庫不足です（現在 ${selectedStock.quantity} 個）` })
      return
    }
    setSaving(true)
    try {
      await transferStock({
        prizeId: selectedStock.prize_id,
        prizeName: selectedStock.prize_name,
        fromOwnerType, fromOwnerId: fromId,
        toOwnerType, toOwnerId: toId,
        quantity: qty, note: note || '', createdBy: ''
      })
      setMessage({ type: 'success', text: `${selectedStock.prize_name} ×${qty} を移管しました` })
      setSelectedStock(null)
      setQuantity('')
      setNote('')
      await refreshData()
    } catch (e) {
      setMessage({ type: 'error', text: '移管失敗: ' + e.message })
    }
    setSaving(false)
  }

  // --- アソート一括配分 ---
  async function handleAssortSubmit() {
    if (!selectedStock) {
      setMessage({ type: 'error', text: '景品を選択してください' }); return
    }
    const validAllocs = assortAllocations.filter(a => a.staffName && parseInt(a.quantity) > 0)
    if (validAllocs.length === 0) {
      setMessage({ type: 'error', text: '配分先を最低1件入力してください' }); return
    }
    const totalAlloc = validAllocs.reduce((s, a) => s + parseInt(a.quantity), 0)
    if (totalAlloc > selectedStock.quantity) {
      setMessage({ type: 'error', text: `合計 ${totalAlloc}個 > 在庫 ${selectedStock.quantity}個 です` }); return
    }
    setSaving(true)
    try {
      for (const alloc of validAllocs) {
        await transferStock({
          prizeId: selectedStock.prize_id,
          prizeName: selectedStock.prize_name,
          fromOwnerType: 'location', fromOwnerId: fromId,
          toOwnerType: 'staff', toOwnerId: alloc.staffName,
          quantity: parseInt(alloc.quantity),
          note: `アソート配分${note ? ': ' + note : ''}`,
          createdBy: ''
        })
      }
      setMessage({ type: 'success', text: `${selectedStock.prize_name} を ${validAllocs.length}名に配分しました（計${totalAlloc}個）` })
      setSelectedStock(null)
      setAssortAllocations([])
      setNote('')
      await refreshData()
    } catch (e) {
      setMessage({ type: 'error', text: 'アソート配分失敗: ' + e.message })
    }
    setSaving(false)
  }

  async function refreshData() {
    const [s, mv] = await Promise.all([getPrizeStocksExtended(true), getStockMovements(true)])
    setStocks(s)
    const staffIds = [...new Set(s.filter(x => x.owner_type === 'staff').map(x => x.owner_id))].filter(Boolean)
    setStaffList(staffIds)
    setRecentTransfers(mv.filter(m => m.movement_type === 'transfer').slice(-10).reverse())
  }

  function addAssortRow() {
    setAssortAllocations(prev => [...prev, { staffName: '', quantity: '' }])
  }
  function updateAssortRow(idx, field, value) {
    setAssortAllocations(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }
  function removeAssortRow(idx) {
    setAssortAllocations(prev => prev.filter((_, i) => i !== idx))
  }
  // 全スタッフに均等配分
  function distributeEvenly() {
    if (!selectedStock || staffList.length === 0) return
    const perPerson = Math.floor(selectedStock.quantity / staffList.length)
    if (perPerson <= 0) return
    setAssortAllocations(staffList.map(s => ({ staffName: s, quantity: String(perPerson) })))
  }

  // アソート配分の合計
  const assortTotal = assortAllocations.reduce((s, a) => s + (parseInt(a.quantity) || 0), 0)

  if (loading) return <div className="min-h-screen bg-bg text-muted flex items-center justify-center">読み込み中...</div>

  return (
    <div className="h-screen flex flex-col bg-bg text-text max-w-lg mx-auto">
      <div className="shrink-0 p-4 pb-0">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/inventory')} className="text-muted text-2xl">←</button>
          <h1 className="flex-1 text-xl font-bold text-accent">🚚 在庫移管</h1>
          <button onClick={() => { sessionStorage.clear(); window.location.href = '/docs/' }}
            className="text-[10px] text-muted hover:text-accent2">ログアウト</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pt-0 pb-24">

      {message && (
        <div className={`rounded-xl p-3 mb-4 text-sm ${message.type === 'error' ? 'bg-accent2/20 text-accent2' : 'bg-accent3/20 text-accent3'}`}>
          {message.text}
        </div>
      )}

      {/* 移管タイプ選択 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {TRANSFER_TYPES.map(t => (
          <button key={t.key} onClick={() => {
            setTransferType(t.key); setFromId(''); setToId('')
            setSelectedStock(null); setAssortAllocations([])
          }}
            className={`p-3 rounded-xl border text-left text-sm ${transferType === t.key
              ? 'bg-accent/20 border-accent text-accent'
              : 'bg-surface border-border text-text'} ${t.key === 'assort' ? 'col-span-2' : ''}`}>
            <div className="text-lg mb-1">{t.icon}</div>
            <div className="font-bold text-xs">{t.label}</div>
            <div className="text-xs text-muted">{t.desc}</div>
          </button>
        ))}
      </div>

      {transferType && (
        <>
          {/* 移動元 */}
          <div className="bg-surface border border-border rounded-xl p-4 mb-3">
            <label className="text-xs text-muted block mb-2">移動元</label>
            <select value={fromId} onChange={e => { setFromId(e.target.value); setSelectedStock(null); setAssortAllocations([]) }}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text">
              <option value="">選択してください</option>
              {fromOwnerType === 'location'
                ? locations.map(l => <option key={l.location_id} value={l.location_id}>{l.parent_location_id ? '　└ ' : ''}{l.name}</option>)
                : staffList.map(s => <option key={s} value={s}>{staffMap[s] || s}</option>)
              }
            </select>
          </div>

          {/* 移動元の在庫から景品選択 */}
          {fromId && fromStocks.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-4 mb-3">
              <label className="text-xs text-muted block mb-2">景品を選択（{fromStocks.length}件）</label>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {fromStocks.map(s => (
                  <button key={s.stock_id} onClick={() => { setSelectedStock(s); setQuantity(String(s.quantity)) }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between ${selectedStock?.stock_id === s.stock_id ? 'bg-accent/20 text-accent' : 'bg-surface2 text-text'}`}>
                    <span className="truncate">{s.prize_name || s.prize_id}</span>
                    <span className="font-bold shrink-0 ml-2">×{s.quantity}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {fromId && fromStocks.length === 0 && (
            <div className="bg-surface border border-border rounded-xl p-4 mb-3 text-sm text-muted text-center">
              この移動元に在庫がありません
            </div>
          )}

          {/* ===== アソートモード ===== */}
          {transferType === 'assort' && selectedStock && (
            <>
              <div className="bg-surface border border-border rounded-xl p-4 mb-3">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs text-muted">配分先（合計: {assortTotal} / {selectedStock.quantity}）</label>
                  <div className="flex gap-2">
                    <button onClick={distributeEvenly}
                      className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-lg">
                      均等配分
                    </button>
                    <button onClick={addAssortRow}
                      className="text-xs bg-accent3/20 text-accent3 px-2 py-1 rounded-lg">
                      + 追加
                    </button>
                  </div>
                </div>

                {/* 配分残り表示 */}
                {assortTotal > 0 && (
                  <div className={`text-xs mb-3 px-2 py-1 rounded-lg ${
                    assortTotal > selectedStock.quantity ? 'bg-accent2/20 text-accent2' :
                    assortTotal === selectedStock.quantity ? 'bg-accent3/20 text-accent3' :
                    'bg-accent/20 text-accent'
                  }`}>
                    {assortTotal === selectedStock.quantity ? '✓ ちょうど配分済み'
                      : assortTotal > selectedStock.quantity ? `⚠ ${assortTotal - selectedStock.quantity}個 超過`
                      : `残り ${selectedStock.quantity - assortTotal}個 未配分`}
                  </div>
                )}

                <div className="space-y-2">
                  {assortAllocations.map((alloc, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select value={alloc.staffName}
                        onChange={e => updateAssortRow(idx, 'staffName', e.target.value)}
                        className="flex-1 bg-surface2 border border-border rounded-lg px-2 py-2 text-sm text-text">
                        <option value="">担当者</option>
                        {staffList.map(s => <option key={s} value={s}>{staffMap[s] || s}</option>)}
                      </select>
                      <NumberInput value={alloc.quantity}
                        onChange={v => updateAssortRow(idx, 'quantity', v)}
                        min={0} placeholder="数量" style={{ width: 120 }} />
                      <button onClick={() => removeAssortRow(idx)}
                        className="text-accent2 text-lg px-1">×</button>
                    </div>
                  ))}
                </div>

                {/* 新規スタッフ追加 */}
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex gap-2">
                    <input type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)}
                      placeholder="新規担当者名を追加"
                      className="flex-1 bg-surface2 border border-border rounded-lg px-2 py-2 text-sm text-text" />
                    <button onClick={() => {
                      if (newStaffName && !staffList.includes(newStaffName)) {
                        setStaffList(prev => [...prev, newStaffName])
                        setAssortAllocations(prev => [...prev, { staffName: newStaffName, quantity: '' }])
                        setNewStaffName('')
                      }
                    }} className="bg-accent3/20 text-accent3 text-xs px-3 py-2 rounded-lg shrink-0">追加</button>
                  </div>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-xl p-4 mb-3">
                <label className="text-xs text-muted block mb-2">メモ</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)}
                  placeholder="任意" className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text" />
              </div>

              <button onClick={handleAssortSubmit} disabled={saving || assortTotal === 0 || assortTotal > selectedStock.quantity}
                className="w-full bg-accent text-black font-bold rounded-xl py-3 text-sm disabled:opacity-50 mb-6">
                {saving ? '配分中...' : `アソート配分を実行（${assortTotal}個）`}
              </button>
            </>
          )}

          {/* ===== 通常移管モード ===== */}
          {transferType !== 'assort' && (
            <>
              {/* 移動先 */}
              <div className="bg-surface border border-border rounded-xl p-4 mb-3">
                <label className="text-xs text-muted block mb-2">移動先</label>
                {toOwnerType === 'staff' ? (
                  <>
                    <select value={toId} onChange={e => setToId(e.target.value)}
                      className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text mb-2">
                      <option value="">既存の担当者から選択</option>
                      {staffList.filter(s => s !== fromId).map(s => <option key={s} value={s}>{staffMap[s] || s}</option>)}
                    </select>
                    <input type="text" value={staffList.includes(toId) ? '' : toId}
                      onChange={e => setToId(e.target.value)}
                      placeholder="または新しい担当者名を入力"
                      className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text" />
                  </>
                ) : (
                  <select value={toId} onChange={e => setToId(e.target.value)}
                    className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text">
                    <option value="">選択してください</option>
                    {locations.filter(l => l.location_id !== fromId).map(l => (
                      <option key={l.location_id} value={l.location_id}>{l.parent_location_id ? '　└ ' : ''}{l.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* 数量・メモ */}
              {selectedStock && (
                <div className="bg-surface border border-border rounded-xl p-4 mb-4 flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted block mb-2">移管数量（最大{selectedStock.quantity}）</label>
                    <NumberInput value={quantity} onChange={setQuantity}
                      min={1} max={selectedStock.quantity} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted block mb-2">メモ</label>
                    <input type="text" value={note} onChange={e => setNote(e.target.value)}
                      placeholder="任意" className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text" />
                  </div>
                </div>
              )}

              {selectedStock && (
                <button onClick={handleSubmit} disabled={saving}
                  className="w-full bg-accent text-black font-bold rounded-xl py-3 text-sm disabled:opacity-50 mb-6">
                  {saving ? '移管中...' : '移管を実行する'}
                </button>
              )}
            </>
          )}
        </>
      )}

      {/* 直近の移管記録 */}
      {recentTransfers.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 mt-4">
          <h3 className="text-xs text-muted mb-3">直近の移管</h3>
          <div className="space-y-2">
            {recentTransfers.map(m => (
              <div key={m.movement_id} className="text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-text truncate flex-1">{m.note || m.prize_id}</span>
                  <span className="text-accent font-bold shrink-0 ml-2">×{m.quantity}</span>
                </div>
                <div className="text-xs text-muted">{staffMap[m.from_owner_id] || m.from_owner_id} → {staffMap[m.to_owner_id] || m.to_owner_id}
                  {m.created_at && <span className="ml-2">{new Date(m.created_at).toLocaleDateString('ja-JP')}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>{/* スクロール領域終了 */}
    </div>
  )
}
