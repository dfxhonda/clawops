import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPrizes, getLocations, transferStock, getStockMovements, getPrizeOrders } from '../../services/sheets'

export default function InventoryReceive() {
  const navigate = useNavigate()
  const [prizes, setPrizes] = useState([])
  const [locations, setLocations] = useState([])
  const [recentArrivals, setRecentArrivals] = useState([])
  const [pendingOrders, setPendingOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [tab, setTab] = useState('orders') // 'orders' | 'manual'

  // 手動入力フォーム
  const [selectedPrize, setSelectedPrize] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [p, l, mv, orders] = await Promise.all([
          getPrizes(), getLocations(), getStockMovements(), getPrizeOrders()
        ])
        setPrizes(p.filter(x => x.is_active !== 'FALSE'))
        setLocations(l.filter(x => x.active_flag === '1'))
        setRecentArrivals(mv.filter(m => m.movement_type === 'arrival').slice(-10).reverse())
        // 未入荷 = arrived_atが空 or arrival_quantityが空
        const pending = orders.filter(o => !o.arrived_at || o.arrived_at === '')
        setPendingOrders(pending)
      } catch (e) {
        console.error('load error:', e)
      }
      setLoading(false)
    }
    load()
  }, [])

  const filteredPrizes = searchText
    ? prizes.filter(p =>
        p.prize_name.toLowerCase().includes(searchText.toLowerCase()) ||
        p.short_name?.toLowerCase().includes(searchText.toLowerCase()) ||
        p.jan_code?.includes(searchText)
      )
    : prizes

  async function handleSubmit() {
    if (!selectedPrize || !selectedLocation || !quantity) {
      setMessage({ type: 'error', text: '景品・入庫先・数量を入力してください' })
      return
    }
    setSaving(true)
    try {
      const prize = prizes.find(p => p.prize_id === selectedPrize)
      await transferStock({
        prizeId: selectedPrize,
        prizeName: prize?.prize_name || '',
        fromOwnerType: '', fromOwnerId: '',
        toOwnerType: 'location', toOwnerId: selectedLocation,
        quantity: parseInt(quantity),
        note: note || '入庫チェック',
        createdBy: ''
      })
      setMessage({ type: 'success', text: `${prize?.prize_name} ×${quantity} を入庫しました` })
      setSelectedPrize('')
      setQuantity('')
      setNote('')
      setSearchText('')
      const mv = await getStockMovements(true)
      setRecentArrivals(mv.filter(m => m.movement_type === 'arrival').slice(-10).reverse())
    } catch (e) {
      setMessage({ type: 'error', text: '入庫に失敗: ' + e.message })
    }
    setSaving(false)
  }

  // 発注データからの入庫確認
  async function handleOrderArrival(order, locationId) {
    if (!locationId) { setMessage({ type: 'error', text: '入庫先を選択してください' }); return }
    setSaving(true)
    try {
      const qty = parseInt(order.order_quantity) || 1
      await transferStock({
        prizeId: order.prize_id || '',
        prizeName: order.prize_name || '',
        fromOwnerType: '', fromOwnerId: '',
        toOwnerType: 'location', toOwnerId: locationId,
        quantity: qty,
        note: `発注入荷: 発注ID ${order.order_id}`,
        createdBy: ''
      })
      setMessage({ type: 'success', text: `${order.prize_name} ×${qty} を入庫しました` })
      setPendingOrders(prev => prev.filter(o => o.order_id !== order.order_id))
      const mv = await getStockMovements(true)
      setRecentArrivals(mv.filter(m => m.movement_type === 'arrival').slice(-10).reverse())
    } catch (e) {
      setMessage({ type: 'error', text: '入庫失敗: ' + e.message })
    }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-bg text-muted flex items-center justify-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-bg text-text p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/inventory')} className="text-muted text-2xl">←</button>
        <h1 className="text-xl font-bold text-accent">📦 入庫チェック</h1>
      </div>

      {message && (
        <div className={`rounded-xl p-3 mb-4 text-sm ${message.type === 'error' ? 'bg-accent2/20 text-accent2' : 'bg-accent3/20 text-accent3'}`}>
          {message.text}
        </div>
      )}

      {/* タブ切り替え */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('orders')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold ${tab === 'orders' ? 'bg-accent/20 text-accent' : 'bg-surface2 text-muted'}`}>
          発注リスト ({pendingOrders.length})
        </button>
        <button onClick={() => setTab('manual')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold ${tab === 'manual' ? 'bg-accent3/20 text-accent3' : 'bg-surface2 text-muted'}`}>
          手動入庫
        </button>
      </div>

      {/* 入庫先（共通） */}
      <div className="bg-surface border border-border rounded-xl p-3 mb-4">
        <label className="text-xs text-muted block mb-1">入庫先（拠点）</label>
        <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text">
          <option value="">選択してください</option>
          {locations.map(l => (
            <option key={l.location_id} value={l.location_id}>
              {l.parent_location_id ? '　└ ' : ''}{l.name}
            </option>
          ))}
        </select>
      </div>

      {/* 発注リストタブ */}
      {tab === 'orders' && (
        <>
          {pendingOrders.length > 0 ? (
            <div className="space-y-2 mb-4">
              {pendingOrders.map(order => (
                <div key={order.order_id} className="bg-surface border border-border rounded-xl p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{order.prize_name}</div>
                      <div className="text-xs text-muted">発注: {order.ordered_at || '不明'} / {order.order_quantity}個</div>
                      {order.note && <div className="text-xs text-muted/70 mt-0.5">{order.note}</div>}
                    </div>
                    <button onClick={() => handleOrderArrival(order, selectedLocation)} disabled={saving || !selectedLocation}
                      className="bg-accent3 text-black text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40 shrink-0 ml-2">
                      入荷確認
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl p-6 text-center text-sm text-muted mb-4">
              <div className="text-2xl mb-2">✅</div>
              未入荷の発注はありません
            </div>
          )}
        </>
      )}

      {/* 手動入庫タブ */}
      {tab === 'manual' && (
        <>
          <div className="bg-surface border border-border rounded-xl p-4 mb-4">
            <label className="text-xs text-muted block mb-2">景品を選択</label>
            <input type="text" placeholder="景品名・JANコードで検索..."
              value={searchText} onChange={e => setSearchText(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text mb-2" />
            {searchText && filteredPrizes.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredPrizes.slice(0, 20).map(p => (
                  <button key={p.prize_id}
                    onClick={() => { setSelectedPrize(p.prize_id); setSearchText(p.prize_name) }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selectedPrize === p.prize_id ? 'bg-accent/20 text-accent' : 'bg-surface2 text-text'}`}>
                    <div className="font-medium">{p.prize_name}</div>
                    {p.short_name && <div className="text-xs text-muted">{p.short_name}</div>}
                  </button>
                ))}
              </div>
            )}
            {selectedPrize && (
              <div className="mt-2 text-xs text-accent3">選択中: {prizes.find(p => p.prize_id === selectedPrize)?.prize_name}</div>
            )}
          </div>

          <div className="bg-surface border border-border rounded-xl p-4 mb-4 flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted block mb-2">数量</label>
              <input type="number" inputMode="numeric" value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text text-center text-lg font-bold" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted block mb-2">メモ</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)}
                placeholder="任意" className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text" />
            </div>
          </div>

          <button onClick={handleSubmit} disabled={saving}
            className="w-full bg-accent3 text-black font-bold rounded-xl py-3 text-sm disabled:opacity-50 mb-4">
            {saving ? '登録中...' : '入庫を記録する'}
          </button>
        </>
      )}

      {/* 直近の入庫記録 */}
      {recentArrivals.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-xs text-muted mb-3">直近の入庫</h3>
          <div className="space-y-2">
            {recentArrivals.map(m => (
              <div key={m.movement_id} className="flex justify-between items-center text-sm">
                <div className="flex-1 min-w-0">
                  <span className="text-text truncate">{m.note || m.prize_id}</span>
                  <span className="text-muted text-xs ml-2">→ {m.to_owner_id}</span>
                </div>
                <div className="text-accent font-bold shrink-0">×{m.quantity}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
