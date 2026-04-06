import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLocations } from '../../services/masters'
import { transferStock, getStockMovements } from '../../services/movements'
import { getPrizes, getPrizeOrders, markOrderArrived, updateOrder, updatePrizeMaster } from '../../services/prizes'
import { useAsync } from '../../hooks/useAsync'
import NumberInput from '../../components/NumberInput'
import { useAuth } from '../../lib/auth/AuthProvider'
import LogoutButton from '../../components/LogoutButton'
import ErrorDisplay from '../../components/ErrorDisplay'
import ReasonSelect from '../../components/ReasonSelect'
import { formatReason } from '../../services/audit'

export default function InventoryReceive() {
  const navigate = useNavigate()
  const { staffId } = useAuth()
  const [prizes, setPrizes] = useState([])
  const [locations, setLocations] = useState([])
  const [recentArrivals, setRecentArrivals] = useState([])
  const [pendingOrders, setPendingOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [successMsg, setSuccessMsg] = useState('')
  const { loading: saving, execute, errorProps, clearError } = useAsync()
  const [tab, setTab] = useState('orders') // 'orders' | 'manual'

  // 手動入力フォーム
  const [selectedPrize, setSelectedPrize] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [searchText, setSearchText] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reason, setReason] = useState({ code: '', note: '' })

  // 発注詳細モーダル
  const [detailOrder, setDetailOrder] = useState(null)
  const [detailForm, setDetailForm] = useState({})
  const { loading: detailSaving, execute: detailExecute, errorProps: detailErrorProps, clearError: detailClearError } = useAsync()

  function openDetail(order) {
    const prize = prizes.find(p => p.prize_id === order.prize_id)
    setDetailForm({
      short_name: prize?.short_name || '',
      pieces_per_case: order.pieces_per_case || '',
      case_quantity: order.order_quantity || '',
      unit_cost: order.unit_cost_at_order || '0',
      case_cost: order.case_cost || '',
      shipping_cost: order.shipping_cost || '0',
      total_tax_included: order.total_tax_included || '0',
    })
    setDetailOrder(order)
    detailClearError()
  }

  async function handleDetailSave() {
    if (!detailOrder) return
    const result = await detailExecute(async () => {
      await updateOrder(detailOrder.order_id, {
        pieces_per_case: detailForm.pieces_per_case ? parseInt(detailForm.pieces_per_case) : null,
        case_quantity: detailForm.case_quantity ? parseFloat(detailForm.case_quantity) : null,
        unit_cost: detailForm.unit_cost ? parseInt(detailForm.unit_cost) : null,
        case_cost: detailForm.case_cost ? parseInt(detailForm.case_cost) : null,
        shipping_cost: detailForm.shipping_cost ? parseInt(detailForm.shipping_cost) : null,
      }, staffId)

      const prize = prizes.find(p => p.prize_id === detailOrder.prize_id)
      if (prize && detailForm.short_name !== (prize.short_name || '')) {
        await updatePrizeMaster(detailOrder.prize_id, { short_name: detailForm.short_name || null }, staffId)
      }
      return true
    })
    if (result) {
      setSuccessMsg('発注詳細を保存しました')
      setDetailOrder(null)
      // 再取得
      const [p, orders] = await Promise.all([getPrizes(), getPrizeOrders()])
      setPrizes(p.filter(x => x.is_active !== 'FALSE'))
      setPendingOrders(orders.filter(o => !o.arrived_at || o.arrived_at === ''))
    }
  }

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
      } catch {}
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
      clearError(); execute(() => { throw new Error('景品・入庫先・数量を入力してください') })
      return
    }
    const prize = prizes.find(p => p.prize_id === selectedPrize)
    const result = await execute(async () => {
      await transferStock({
        prizeId: selectedPrize,
        prizeName: prize?.prize_name || '',
        fromOwnerType: '', fromOwnerId: '',
        toOwnerType: 'location', toOwnerId: selectedLocation,
        quantity: parseInt(quantity),
        note: note || '入庫チェック',
        createdBy: staffId || '',
        reason: reason.code ? formatReason(reason.code, reason.note) : undefined,
        reason_code: reason.code || undefined,
        reason_note: reason.note || undefined,
      })
      return true
    })
    if (result) {
      setSuccessMsg(`${prize?.prize_name} ×${quantity} を入庫しました`)
      setSelectedPrize('')
      setQuantity('')
      setNote('')
      setSearchText('')
      setReason({ code: '', note: '' })
      const mv = await getStockMovements(true)
      setRecentArrivals(mv.filter(m => m.movement_type === 'arrival').slice(-10).reverse())
    }
  }

  // 発注データからの入庫確認
  async function handleOrderArrival(order, locationId) {
    if (!locationId) {
      clearError(); execute(() => { throw new Error('入庫先を選択してください') }); return
    }
    const result = await execute(async () => {
      const qty = parseInt(order.order_quantity) || 1
      const staff = staffId || ''
      // 先にステータス更新（失敗しても在庫は変わらない。逆順だと在庫二重加算リスク）
      await markOrderArrived(order.order_id, qty, staff)
      try {
        await transferStock({
          prizeId: order.prize_id || '',
          prizeName: order.prize_name || '',
          fromOwnerType: '', fromOwnerId: '',
          toOwnerType: 'location', toOwnerId: locationId,
          quantity: qty,
          note: `発注入荷: 発注ID ${order.order_id}`,
          createdBy: staff
        })
        return { ok: true, qty, orderId: order.order_id, prizeName: order.prize_name }
      } catch (stockErr) {
        // 在庫追加失敗: ステータスは入荷済みだが在庫未反映
        throw new Error(`入荷ステータス更新済みですが在庫追加に失敗しました。手動で在庫を追加してください: ${stockErr.message}`)
      }
    })
    if (result) {
      setSuccessMsg(`${result.prizeName} ×${result.qty} を入庫しました`)
      setPendingOrders(prev => prev.filter(o => o.order_id !== result.orderId))
    }
    const mv = await getStockMovements(true)
    setRecentArrivals(mv.filter(m => m.movement_type === 'arrival').slice(-10).reverse())
  }

  if (loading) return <div className="min-h-screen bg-bg text-muted flex items-center justify-center">読み込み中...</div>

  return (
    <div className="h-screen bg-bg text-text flex flex-col max-w-lg mx-auto">
      {/* 固定ヘッダー部分 */}
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/inventory')} className="text-muted text-2xl">←</button>
          <h1 className="flex-1 text-xl font-bold text-accent">📦 入庫チェック</h1>
          <LogoutButton />
        </div>

        {errorProps && <ErrorDisplay {...errorProps} />}
        {successMsg && <div className="bg-accent3/20 text-accent3 rounded-xl p-3 mb-3 text-sm">{successMsg}</div>}

        {/* タブ切り替え */}
        <div className="flex gap-2 mb-3">
          <button onClick={() => setTab('orders')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold ${tab === 'orders' ? 'bg-accent/20 text-accent' : 'bg-surface2 text-muted'}`}>
            発注リスト ({pendingOrders.length})
          </button>
          <button onClick={() => setTab('manual')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold ${tab === 'manual' ? 'bg-accent3/20 text-accent3' : 'bg-surface2 text-muted'}`}>
            手動入庫
          </button>
        </div>

        {/* 入庫先 + 入荷予定日フィルター */}
        <div className="bg-surface border border-border rounded-xl p-3 mb-3 space-y-2">
          <div>
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
          <div>
            <label className="text-xs text-muted block mb-1">入荷予定日で絞り込み</label>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="flex-1 bg-surface2 border border-border rounded-lg px-2 py-1.5 text-xs text-text [color-scheme:dark]" />
              <span className="text-muted text-xs">〜</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="flex-1 bg-surface2 border border-border rounded-lg px-2 py-1.5 text-xs text-text [color-scheme:dark]" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo('') }}
                  className="text-xs text-muted hover:text-accent2 shrink-0">×</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* スクロール可能な景品リスト部分 */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">

      {/* 発注リストタブ */}
      {tab === 'orders' && (() => {
        const filtered = pendingOrders.filter(o => {
          const ed = (o.expected_date || o.order_date || '').slice(0, 10)
          if (dateFrom && ed < dateFrom) return false
          if (dateTo && ed > dateTo) return false
          return true
        })
        return (
        <>
          {filtered.length > 0 ? (
            <div className="space-y-2 mb-4">
              {filtered.map(order => (
                <div key={order.order_id} className="bg-surface border border-border rounded-xl p-3 cursor-pointer active:bg-surface2"
                  onClick={() => openDetail(order)}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{order.prize_name}</div>
                      <div className="text-xs text-muted">
                        発注: {order.ordered_at || '不明'} / {order.order_quantity}個
                        {order.expected_date && <span> / 納期: {order.expected_date}</span>}
                      </div>
                      {order.supplier_name && <div className="text-xs text-muted/70">{order.supplier_name}</div>}
                      {order.note && <div className="text-xs text-muted/70 mt-0.5">{order.note}</div>}
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleOrderArrival(order, selectedLocation) }} disabled={saving || !selectedLocation}
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
        )
      })()}

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
              <NumberInput value={quantity} onChange={setQuantity} min={1} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted block mb-2">メモ</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)}
                placeholder="任意" className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text" />
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4 mb-4">
            <ReasonSelect value={reason} onChange={setReason} reasons={['ARRIVAL', 'REPLENISH', 'OTHER']} />
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
      </div>{/* スクロール領域終了 */}

      {/* 発注詳細モーダル */}
      {detailOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setDetailOrder(null)}>
          <div className="bg-bg w-full max-w-lg rounded-t-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-4 pb-2 border-b border-border flex justify-between items-center shrink-0">
              <h2 className="text-base font-bold text-accent">発注詳細</h2>
              <button onClick={() => setDetailOrder(null)} className="text-muted text-xl">×</button>
            </div>
            <div className="overflow-y-auto px-4 py-3 space-y-3 flex-1">
              {detailErrorProps && <ErrorDisplay {...detailErrorProps} />}

              {/* 景品名（表示のみ） */}
              <div>
                <label className="text-xs text-muted block mb-1">景品名</label>
                <div className="text-sm text-text bg-surface2 rounded-lg px-3 py-2">{detailOrder.prize_name}</div>
              </div>

              {/* 短縮名（編集可 → マスタ反映） */}
              <div>
                <label className="text-xs text-muted block mb-1">短縮名 <span className="text-accent2">→マスタ反映</span></label>
                <input type="text" value={detailForm.short_name}
                  onChange={e => setDetailForm(f => ({ ...f, short_name: e.target.value }))}
                  className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 入り数 */}
                <div>
                  <label className="text-xs text-muted block mb-1">入り数</label>
                  <input type="number" inputMode="numeric" value={detailForm.pieces_per_case}
                    onChange={e => setDetailForm(f => ({ ...f, pieces_per_case: e.target.value }))}
                    className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                {/* ケース数 */}
                <div>
                  <label className="text-xs text-muted block mb-1">ケース数</label>
                  <input type="number" inputMode="decimal" step="0.1" value={detailForm.case_quantity}
                    onChange={e => setDetailForm(f => ({ ...f, case_quantity: e.target.value }))}
                    className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                {/* 単価 */}
                <div>
                  <label className="text-xs text-muted block mb-1">単価</label>
                  <input type="number" inputMode="numeric" value={detailForm.unit_cost}
                    onChange={e => setDetailForm(f => ({ ...f, unit_cost: e.target.value }))}
                    className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                {/* ケース金額 */}
                <div>
                  <label className="text-xs text-muted block mb-1">ケース金額</label>
                  <input type="number" inputMode="numeric" value={detailForm.case_cost}
                    onChange={e => setDetailForm(f => ({ ...f, case_cost: e.target.value }))}
                    className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                {/* 送料 */}
                <div>
                  <label className="text-xs text-muted block mb-1">送料</label>
                  <input type="number" inputMode="numeric" value={detailForm.shipping_cost}
                    onChange={e => setDetailForm(f => ({ ...f, shipping_cost: e.target.value }))}
                    className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text" />
                </div>
              </div>

              {/* 合計金額(税込) — 変更不可 */}
              <div>
                <label className="text-xs text-muted block mb-1">合計金額(税込) <span className="text-accent2">変更不可</span></label>
                <div className="text-sm text-accent font-bold bg-surface2 rounded-lg px-3 py-2">
                  ¥{Number(detailForm.total_tax_included || 0).toLocaleString()}
                </div>
              </div>

              {/* 発注情報（表示のみ） */}
              <div className="grid grid-cols-2 gap-3 text-xs text-muted">
                <div>
                  <span className="block mb-0.5">発注日</span>
                  <span className="text-text text-sm">{detailOrder.ordered_at || '—'}</span>
                </div>
                <div>
                  <span className="block mb-0.5">納期</span>
                  <span className="text-text text-sm">{detailOrder.expected_date || '—'}</span>
                </div>
                <div>
                  <span className="block mb-0.5">仕入先</span>
                  <span className="text-text text-sm">{detailOrder.supplier_name || '—'}</span>
                </div>
                <div>
                  <span className="block mb-0.5">送り先</span>
                  <span className="text-text text-sm">{detailOrder.destination || '—'}</span>
                </div>
              </div>
            </div>

            {/* ボタン */}
            <div className="px-4 py-3 border-t border-border flex gap-2 shrink-0">
              <button onClick={handleDetailSave} disabled={detailSaving}
                className="flex-1 bg-accent text-black font-bold rounded-xl py-3 text-sm disabled:opacity-50">
                {detailSaving ? '保存中...' : '保存'}
              </button>
              <button onClick={() => { setDetailOrder(null); handleOrderArrival(detailOrder, selectedLocation) }}
                disabled={saving || !selectedLocation}
                className="flex-1 bg-accent3 text-black font-bold rounded-xl py-3 text-sm disabled:opacity-40">
                入荷確認
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
