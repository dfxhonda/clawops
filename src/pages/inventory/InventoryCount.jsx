import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLocations, getPrizeStocksExtended, countStock, getStockMovements, transferStock, getStaffMap } from '../../services/sheets'
import NumberInput from '../../components/NumberInput'

export default function InventoryCount() {
  const navigate = useNavigate()
  const [locations, setLocations] = useState([])
  const [stocks, setStocks] = useState([])
  const [staffMap, setStaffMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const [ownerType, setOwnerType] = useState('location')
  const [ownerId, setOwnerId] = useState('')
  const [staffList, setStaffList] = useState([])

  // 棚卸し入力: stock_id → 実数
  const [countInputs, setCountInputs] = useState({})
  const [results, setResults] = useState([])

  // フィルタ・表示
  const [searchText, setSearchText] = useState('')
  const [showOnlyDiff, setShowOnlyDiff] = useState(false)

  // 最近の棚卸し履歴
  const [recentCounts, setRecentCounts] = useState([])

  // 在庫移動モーダル
  const [moveTarget, setMoveTarget] = useState(null) // 選択した在庫アイテム
  const [moveType, setMoveType] = useState('loc2loc')
  const [moveToId, setMoveToId] = useState('')
  const [moveQty, setMoveQty] = useState('')
  const [moveNote, setMoveNote] = useState('')
  const [moveSaving, setMoveSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [l, s, mv, sm] = await Promise.all([getLocations(), getPrizeStocksExtended(), getStockMovements(), getStaffMap()])
        setLocations(l.filter(x => x.active_flag === '1'))
        setStocks(s)
        setStaffMap(sm)
        const staffIds = [...new Set(s.filter(x => x.owner_type === 'staff').map(x => x.owner_id))].filter(Boolean)
        setStaffList(staffIds)
        setRecentCounts(mv.filter(m => m.movement_type === 'count' || m.movement_type === 'adjust').slice(-8).reverse())
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const targetStocks = ownerId
    ? stocks.filter(s => s.owner_type === ownerType && s.owner_id === ownerId)
    : []

  // 検索＋フィルタ
  const filteredStocks = useMemo(() => {
    let list = targetStocks
    if (searchText) {
      const q = searchText.toLowerCase()
      list = list.filter(s =>
        (s.prize_name || '').toLowerCase().includes(q) ||
        (s.prize_id || '').toLowerCase().includes(q)
      )
    }
    if (showOnlyDiff) {
      list = list.filter(s => {
        const v = countInputs[s.stock_id]
        return v !== undefined && v !== '' && parseInt(v) !== s.quantity
      })
    }
    return list
  }, [targetStocks, searchText, showOnlyDiff, countInputs])

  // サマリー計算
  const summary = useMemo(() => {
    const filled = targetStocks.filter(s => countInputs[s.stock_id] !== undefined && countInputs[s.stock_id] !== '')
    const withDiff = filled.filter(s => (parseInt(countInputs[s.stock_id]) || 0) !== s.quantity)
    const totalTheory = targetStocks.reduce((sum, s) => sum + s.quantity, 0)
    const totalActual = filled.reduce((sum, s) => sum + (parseInt(countInputs[s.stock_id]) || 0), 0)
    return { total: targetStocks.length, filled: filled.length, withDiff: withDiff.length, totalTheory, totalActual }
  }, [targetStocks, countInputs])

  function handleCountChange(stockId, value) {
    setCountInputs(prev => ({ ...prev, [stockId]: value }))
  }

  // 全部「理論値と同じ」で埋める
  function fillAllSame() {
    const inputs = {}
    targetStocks.forEach(s => { inputs[s.stock_id] = String(s.quantity) })
    setCountInputs(inputs)
  }

  // クリア
  function clearAll() {
    setCountInputs({})
    setResults([])
  }

  async function handleSubmitAll() {
    const entries = targetStocks
      .filter(s => countInputs[s.stock_id] !== undefined && countInputs[s.stock_id] !== '')
      .map(s => ({
        stock: s,
        actualQuantity: parseInt(countInputs[s.stock_id]) || 0
      }))

    if (entries.length === 0) {
      setMessage({ type: 'error', text: '実数を入力してください' })
      return
    }

    setSaving(true)
    const res = []
    try {
      for (const entry of entries) {
        const r = await countStock({
          prizeId: entry.stock.prize_id,
          prizeName: entry.stock.prize_name,
          ownerType, ownerId,
          actualQuantity: entry.actualQuantity,
          note: '', createdBy: ''
        })
        res.push({ ...r, prizeName: entry.stock.prize_name })
      }
      setResults(res)
      const diffCount = res.filter(r => r.diff !== 0).length
      setMessage({
        type: diffCount > 0 ? 'warn' : 'success',
        text: `${entries.length}件の棚卸し完了（差異: ${diffCount}件）`
      })
      // リフレッシュ
      const [s, mv] = await Promise.all([getPrizeStocksExtended(true), getStockMovements(true)])
      setStocks(s)
      setCountInputs({})
      setRecentCounts(mv.filter(m => m.movement_type === 'count' || m.movement_type === 'adjust').slice(-8).reverse())
    } catch (e) {
      setMessage({ type: 'error', text: '棚卸し保存失敗: ' + e.message })
    }
    setSaving(false)
  }

  function openMoveModal(stock) {
    setMoveTarget(stock)
    setMoveType(ownerType === 'location' ? 'loc2loc' : 'staff2loc')
    setMoveToId('')
    setMoveQty(String(stock.quantity))
    setMoveNote('')
  }

  async function handleMove() {
    if (!moveTarget || !moveToId || !moveQty) {
      setMessage({ type: 'error', text: '移動先と数量を入力してください' }); return
    }
    const qty = parseInt(moveQty)
    if (qty <= 0 || qty > moveTarget.quantity) {
      setMessage({ type: 'error', text: `数量は1〜${moveTarget.quantity}の範囲で入力` }); return
    }
    const toOwner = moveType.endsWith('staff') ? 'staff' : 'location'
    setMoveSaving(true)
    try {
      await transferStock({
        prizeId: moveTarget.prize_id,
        prizeName: moveTarget.prize_name,
        fromOwnerType: ownerType, fromOwnerId: ownerId,
        toOwnerType: toOwner, toOwnerId: moveToId,
        quantity: qty, note: moveNote || '', createdBy: ''
      })
      setMessage({ type: 'success', text: `${moveTarget.prize_name} x${qty} を移動しました` })
      setMoveTarget(null)
      const [s, mv] = await Promise.all([getPrizeStocksExtended(true), getStockMovements(true)])
      setStocks(s)
      const sIds = [...new Set(s.filter(x => x.owner_type === 'staff').map(x => x.owner_id))].filter(Boolean)
      setStaffList(sIds)
      setRecentCounts(mv.filter(m => m.movement_type === 'count' || m.movement_type === 'adjust').slice(-8).reverse())
    } catch (e) {
      setMessage({ type: 'error', text: '移動失敗: ' + e.message })
    }
    setMoveSaving(false)
  }

  const moveToOptions = useMemo(() => {
    if (!moveType) return []
    const toOwner = moveType.endsWith('staff') ? 'staff' : 'location'
    if (toOwner === 'location') return locations.filter(l => l.location_id !== ownerId)
    return staffList.filter(s => s !== ownerId)
  }, [moveType, locations, staffList, ownerId])

  if (loading) return <div className="min-h-screen bg-bg text-muted flex items-center justify-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-bg text-text p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/inventory')} className="text-muted text-2xl">←</button>
        <h1 className="text-xl font-bold text-accent">📋 実在庫カウント</h1>
      </div>

      {message && (
        <div className={`rounded-xl p-3 mb-4 text-sm ${
          message.type === 'error' ? 'bg-accent2/20 text-accent2' :
          message.type === 'warn' ? 'bg-accent/20 text-accent' :
          'bg-accent3/20 text-accent3'
        }`}>
          {message.text}
        </div>
      )}

      {/* 対象選択 */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-4">
        <div className="flex gap-2 mb-3">
          <button onClick={() => { setOwnerType('location'); setOwnerId(''); clearAll() }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold ${ownerType === 'location' ? 'bg-accent3/20 text-accent3' : 'bg-surface2 text-muted'}`}>
            🏢 拠点
          </button>
          <button onClick={() => { setOwnerType('staff'); setOwnerId(''); clearAll() }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold ${ownerType === 'staff' ? 'bg-accent/20 text-accent' : 'bg-surface2 text-muted'}`}>
            🚗 担当車
          </button>
        </div>

        {ownerType === 'location' ? (
          <select value={ownerId} onChange={e => { setOwnerId(e.target.value); clearAll() }}
            className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text">
            <option value="">拠点を選択</option>
            {locations.map(l => (
              <option key={l.location_id} value={l.location_id}>
                {l.parent_location_id ? '　└ ' : ''}{l.name}
              </option>
            ))}
          </select>
        ) : (
          <select value={ownerId} onChange={e => { setOwnerId(e.target.value); clearAll() }}
            className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text">
            <option value="">担当者を選択</option>
            {staffList.map(s => <option key={s} value={s}>{staffMap[s] || s}</option>)}
          </select>
        )}
      </div>

      {/* ツールバー */}
      {ownerId && targetStocks.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <button onClick={fillAllSame}
            className="text-xs bg-surface border border-border text-muted px-3 py-1.5 rounded-lg">
            全て理論値で埋める
          </button>
          <button onClick={clearAll}
            className="text-xs bg-surface border border-border text-muted px-3 py-1.5 rounded-lg">
            クリア
          </button>
          <button onClick={() => setShowOnlyDiff(!showOnlyDiff)}
            className={`text-xs px-3 py-1.5 rounded-lg ${showOnlyDiff ? 'bg-accent2/20 text-accent2' : 'bg-surface border border-border text-muted'}`}>
            差異のみ
          </button>
        </div>
      )}

      {/* サマリーバー */}
      {ownerId && targetStocks.length > 0 && summary.filled > 0 && (
        <div className="bg-surface border border-border rounded-xl p-3 mb-3 flex justify-between items-center text-xs">
          <span className="text-muted">入力: {summary.filled}/{summary.total}</span>
          <span className={summary.withDiff > 0 ? 'text-accent2 font-bold' : 'text-accent3 font-bold'}>
            差異: {summary.withDiff}件
          </span>
          {summary.filled > 0 && (
            <span className="text-muted">理論{summary.totalTheory} → 実{summary.totalActual}</span>
          )}
        </div>
      )}

      {/* 検索 */}
      {ownerId && targetStocks.length > 5 && (
        <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
          placeholder="景品名で絞り込み..."
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text mb-3" />
      )}

      {/* 在庫リスト + 実数入力 */}
      {ownerId && filteredStocks.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-muted">{filteredStocks.length}アイテム</span>
            <span className="text-xs text-muted">理論値 → 実数</span>
          </div>
          <div className="space-y-3">
            {filteredStocks.map(s => {
              const inputVal = countInputs[s.stock_id]
              const hasInput = inputVal !== undefined && inputVal !== ''
              const diff = hasInput ? (parseInt(inputVal) || 0) - s.quantity : null
              return (
                <div key={s.stock_id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0" onClick={() => openMoveModal(s)} role="button">
                    <div className="text-sm font-medium truncate text-accent underline decoration-dotted">{s.prize_name || s.prize_id}</div>
                    <div className="text-xs text-muted">理論: {s.quantity}個</div>
                  </div>
                  {/* クイック同値ボタン */}
                  <button onClick={() => handleCountChange(s.stock_id, String(s.quantity))}
                    className={`text-xs px-2 py-1 rounded shrink-0 ${hasInput && diff === 0 ? 'bg-accent3/30 text-accent3' : 'bg-surface2 text-muted'}`}>
                    ={s.quantity}
                  </button>
                  <NumberInput
                    value={countInputs[s.stock_id] ?? ''}
                    onChange={v => handleCountChange(s.stock_id, v)}
                    min={0} placeholder={String(s.quantity)}
                    style={{ width: 140 }} />
                  {diff !== null && (
                    <span className={`text-xs font-bold w-10 text-right shrink-0 ${diff === 0 ? 'text-accent3' : diff > 0 ? 'text-accent' : 'text-accent2'}`}>
                      {diff === 0 ? '✓' : (diff > 0 ? `+${diff}` : diff)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {ownerId && targetStocks.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 mb-4 text-center text-sm text-muted">
          この場所に在庫データがありません
        </div>
      )}

      {ownerId && targetStocks.length > 0 && (
        <button onClick={handleSubmitAll} disabled={saving || summary.filled === 0}
          className="w-full bg-accent text-black font-bold rounded-xl py-3 text-sm disabled:opacity-50 mb-6">
          {saving ? '保存中...' : `棚卸し結果を保存する（${summary.filled}件）`}
        </button>
      )}

      {/* 棚卸し結果 */}
      {results.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 mb-4">
          <h3 className="text-xs text-muted mb-3">棚卸し結果</h3>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="truncate flex-1">{r.prizeName}</span>
                <span className={`font-bold shrink-0 ${r.diff === 0 ? 'text-accent3' : r.diff > 0 ? 'text-accent' : 'text-accent2'}`}>
                  {r.previousQuantity} → {r.actualQuantity}
                  {r.diff !== 0 && <span className="ml-1">({r.diff > 0 ? '+' : ''}{r.diff})</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 直近の棚卸し記録 */}
      {recentCounts.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-xs text-muted mb-3">直近の棚卸し・調整</h3>
          <div className="space-y-2">
            {recentCounts.map(m => (
              <div key={m.movement_id} className="text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-text truncate flex-1">{m.note || m.prize_id}</span>
                  <span className="text-accent font-bold shrink-0 ml-2">×{m.quantity}</span>
                </div>
                <div className="text-xs text-muted">
                  {staffMap[m.to_owner_id] || staffMap[m.from_owner_id] || m.to_owner_id || m.from_owner_id}
                  {m.created_at && <span className="ml-2">{new Date(m.created_at).toLocaleDateString('ja-JP')}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 在庫移動モーダル */}
      {moveTarget && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-end justify-center"
          onClick={e => e.target === e.currentTarget && setMoveTarget(null)}>
          <div className="bg-surface w-full max-w-lg rounded-t-2xl p-5 pb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold">在庫を動かす</h2>
              <button onClick={() => setMoveTarget(null)} className="text-muted text-xl">×</button>
            </div>

            {/* 景品名（固定表示） */}
            <div className="mb-3">
              <label className="text-xs text-muted block mb-1">景品</label>
              <div className="bg-surface2 border border-border rounded-lg px-3 py-2.5 text-sm font-bold text-accent">
                {moveTarget.prize_name || moveTarget.prize_id}
                <span className="text-xs text-muted font-normal ml-2">（在庫: {moveTarget.quantity}個）</span>
              </div>
            </div>

            {/* 動きの種類 */}
            <div className="mb-3">
              <label className="text-xs text-muted block mb-1">動きの種類</label>
              <div className="grid grid-cols-2 gap-2">
                {ownerType === 'location' ? (
                  <>
                    <button onClick={() => { setMoveType('loc2loc'); setMoveToId('') }}
                      className={`py-2 rounded-lg text-xs font-bold ${moveType === 'loc2loc' ? 'bg-accent/20 text-accent border border-accent' : 'bg-surface2 text-muted border border-border'}`}>
                      🏢→🏢 拠点間
                    </button>
                    <button onClick={() => { setMoveType('loc2staff'); setMoveToId('') }}
                      className={`py-2 rounded-lg text-xs font-bold ${moveType === 'loc2staff' ? 'bg-accent/20 text-accent border border-accent' : 'bg-surface2 text-muted border border-border'}`}>
                      🏢→🚗 担当車へ
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setMoveType('staff2loc'); setMoveToId('') }}
                      className={`py-2 rounded-lg text-xs font-bold ${moveType === 'staff2loc' ? 'bg-accent/20 text-accent border border-accent' : 'bg-surface2 text-muted border border-border'}`}>
                      🚗→🏢 拠点へ
                    </button>
                    <button onClick={() => { setMoveType('staff2staff'); setMoveToId('') }}
                      className={`py-2 rounded-lg text-xs font-bold ${moveType === 'staff2staff' ? 'bg-accent/20 text-accent border border-accent' : 'bg-surface2 text-muted border border-border'}`}>
                      🚗→🚗 担当車間
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 移動先 */}
            <div className="mb-3">
              <label className="text-xs text-muted block mb-1">移動先</label>
              <select value={moveToId} onChange={e => setMoveToId(e.target.value)}
                className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text">
                <option value="">選択してください</option>
                {moveType.endsWith('staff')
                  ? moveToOptions.map(s => <option key={s} value={s}>{s}</option>)
                  : moveToOptions.map(l => <option key={l.location_id} value={l.location_id}>{l.parent_location_id ? '└ ' : ''}{l.name}</option>)
                }
              </select>
            </div>

            {/* 数量 */}
            <div className="mb-3">
              <label className="text-xs text-muted block mb-1">数量（最大 {moveTarget.quantity}）</label>
              <NumberInput value={moveQty} onChange={setMoveQty}
                min={1} max={moveTarget.quantity} />
            </div>

            {/* メモ */}
            <div className="mb-4">
              <label className="text-xs text-muted block mb-1">理由メモ</label>
              <input type="text" value={moveNote} onChange={e => setMoveNote(e.target.value)}
                placeholder="任意"
                className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setMoveTarget(null)}
                className="flex-1 bg-surface2 text-muted rounded-xl py-3 text-sm font-bold">
                キャンセル
              </button>
              <button onClick={handleMove} disabled={moveSaving || !moveToId || !moveQty}
                className="flex-1 bg-accent text-black rounded-xl py-3 text-sm font-bold disabled:opacity-50">
                {moveSaving ? '移動中...' : '移動する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
