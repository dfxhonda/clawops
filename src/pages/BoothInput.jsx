import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { parseNum } from '../services/sheets'
import { useBoothInput } from '../hooks/useBoothInput'
import LogoutButton from '../components/LogoutButton'

// 設定値の定義（5種類）
const SETTINGS = [
  { key: 'set_a', label: 'A', shortName: 'ｱｼｽﾄ', title: 'アシスト回数' },
  { key: 'set_c', label: 'C', shortName: 'ｷｬｯﾁ', title: 'キャッチ時パワー' },
  { key: 'set_l', label: 'L', shortName: 'ﾕﾙ', title: '緩和時パワー' },
  { key: 'set_r', label: 'R', shortName: 'ﾘﾀｰﾝ', title: '復帰時パワー' },
  { key: 'set_o', label: 'O', shortName: 'ｿﾉ他', title: '固有設定' },
]

export default function BoothInput() {
  const { machineId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()

  const {
    booths, machineName, readingsMap, inputs, vehicleStocks,
    readDate, setReadDate, filter, setFilter, filteredBooths, inputCount,
    loading, showVehiclePanel, setShowVehiclePanel, staffId,
    setInp, handleKeyDown, handleSaveAll, getRef, setStaffId, clearStaff,
  } = useBoothInput(machineId, state)

  async function onSave() {
    const result = await handleSaveAll()
    if (!result.ok) { alert(result.message); return }
    if (result.failedItems?.length > 0) {
      const details = result.failedItems.map(f => `・${f.prizeName}: ${f.error}`).join('\n')
      alert(`メーター入力は保存済みですが、以下の補充処理でエラーが発生しました。棚卸し画面で在庫を確認してください。\n\n${details}`)
    }
    navigate('/drafts', { state: { storeName: state?.storeName, storeId: state?.storeId } })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">前回データを取得しています...</p>
      </div>
    </div>
  )

  return (
    <div className="h-screen flex flex-col max-w-lg mx-auto">
      {/* ヘッダー */}
      <div className="shrink-0 px-3 pt-3">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => navigate(-1)} className="text-xl text-muted hover:text-accent">←</button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold truncate">{machineName || '機械'}</h2>
            <p className="text-[11px] text-muted">{state?.storeName} ・{booths.length}ブース</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={readDate} onChange={e => setReadDate(e.target.value)}
              className="bg-surface2 border border-border text-text text-xs px-1.5 py-1 rounded [color-scheme:dark] w-[120px]" />
            <div className="text-center">
              <div className="text-sm font-bold text-accent">{inputCount}/{booths.length}</div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-24">

      {readDate !== new Date().toISOString().slice(0, 10) &&
        <div className="text-[10px] text-accent2 font-bold text-center mb-1">⚠️ 過去日付で入力中</div>}

      {/* 担当者 & 車在庫パネル */}
      <div className="mb-2">
        <div className="flex items-center gap-2">
          {!staffId ? (
            <div className="flex-1 flex items-center gap-2">
              <input type="text" placeholder="担当者ID（例: テストA）" id="_staffInput"
                className="flex-1 bg-surface2 border border-border rounded-lg px-2 py-1.5 text-xs text-text"
                onKeyDown={e => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) setStaffId(v) } }} />
              <button onClick={() => { const v = document.getElementById('_staffInput')?.value?.trim(); if (v) setStaffId(v) }}
                className="bg-accent/20 text-accent text-xs px-3 py-1.5 rounded-lg font-bold">設定</button>
            </div>
          ) : (
            <button onClick={() => setShowVehiclePanel(p => !p)}
              className={`flex-1 flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${showVehiclePanel ? 'bg-accent4/20 border border-accent4/40' : 'bg-surface2 border border-border'}`}>
              <span className="font-bold text-accent4">🚗 {staffId}</span>
              <span className="text-muted">{vehicleStocks.length}品 / {vehicleStocks.reduce((s, x) => s + x.quantity, 0)}個</span>
              <span className="text-muted">{showVehiclePanel ? '▲' : '▼'}</span>
            </button>
          )}
          {staffId && (
            <button onClick={clearStaff}
              className="text-[10px] text-muted hover:text-accent2">×</button>
          )}
        </div>

        {showVehiclePanel && vehicleStocks.length > 0 && (
          <div className="mt-1.5 bg-surface2 border border-border rounded-lg p-2 max-h-32 overflow-y-auto">
            {vehicleStocks.filter(s => s.quantity > 0).map(s => (
              <div key={s.stock_id} className="flex justify-between text-xs py-0.5">
                <span className="truncate text-text">{s.prize_name || s.prize_id}</span>
                <span className={`font-bold shrink-0 ml-2 ${s.quantity <= 3 ? 'text-accent2' : 'text-accent3'}`}>×{s.quantity}</span>
              </div>
            ))}
            {vehicleStocks.filter(s => s.quantity > 0).length === 0 && (
              <div className="text-xs text-muted text-center py-1">車在庫なし</div>
            )}
          </div>
        )}
        {showVehiclePanel && vehicleStocks.length === 0 && staffId && (
          <div className="mt-1.5 text-xs text-muted text-center bg-surface2 border border-border rounded-lg p-2">
            車在庫データなし（棚卸しアプリで在庫移管してください）
          </div>
        )}
      </div>

      {/* フィルタータブ */}
      <div className="flex bg-surface2 rounded-xl p-1 mb-2">
        {[['all', '全て', booths.length], ['todo', '未入力', booths.length - inputCount], ['done', '入力済', inputCount]].map(([val, label, count]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all
              ${filter === val ? 'bg-surface text-accent shadow-sm' : 'text-muted'}`}>
            {label}({count})
          </button>
        ))}
      </div>

      {/* ブース一覧 */}
      {filteredBooths.length === 0 ? (
        <div className="text-center text-muted text-sm py-8">
          {filter === 'todo' ? '全ブース入力済みです' : '入力済みのブースはありません'}
        </div>
      ) : null}
      <div className="space-y-1.5">
        {filteredBooths.map((booth) => (
          <BoothCard
            key={booth.booth_id}
            booth={booth}
            readingsMap={readingsMap}
            inp={inputs[booth.booth_id] || {}}
            setInp={setInp}
            navigate={navigate}
            getRef={getRef}
            handleKeyDown={handleKeyDown}
          />
        ))}
      </div>
      </div>{/* スクロール領域終了 */}

      {/* 固定フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg/95 backdrop-blur border-t border-border px-3 py-2.5 z-50">
        <div className="max-w-lg mx-auto">
          <button onClick={onSave}
            className={`w-full text-white font-bold py-3.5 rounded-xl transition-all min-h-[48px] active:scale-[0.98]
              ${inputCount > 0 && inputCount >= booths.length
                ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/30 animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700'}`}>
            {inputCount >= booths.length
              ? `全${inputCount}件を下書き保存 → 確認へ`
              : inputCount > 0 ? `${inputCount}件を下書き保存 → 確認へ`
              : '入力してください'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 個別ブースカード（表示のみ）
function BoothCard({ booth, readingsMap, inp, setInp, getRef, handleKeyDown, navigate }) {
  const { latest, last } = readingsMap[booth.booth_id] || {}
  const price = parseNum(booth.play_price || '100')

  const latestIn = latest?.in_meter ? parseNum(latest.in_meter) : null
  const latestOut = latest?.out_meter ? parseNum(latest.out_meter) : null
  const lastIn = last?.in_meter ? parseNum(last.in_meter) : null
  const lastOut = last?.out_meter ? parseNum(last.out_meter) : null

  const inVal = inp.in_meter ? parseNum(inp.in_meter) : null
  const outVal = inp.out_meter ? parseNum(inp.out_meter) : null
  const inDiff = inVal !== null && lastIn !== null ? inVal - lastIn : null
  const outDiff = outVal !== null && lastOut !== null ? outVal - lastOut : null
  const inAbnormal = inDiff !== null && (inDiff < 0 || inDiff > 50000)
  const outAbnormal = outDiff !== null && (outDiff < 0 || outDiff > 50000)

  const payout = outDiff !== null && outDiff >= 0 ? outDiff : null
  const payoutRate = payout !== null && inDiff !== null && inDiff > 0
    ? ((payout / inDiff) * 100).toFixed(1) : null

  const hasInput = inp.in_meter && inp.in_meter !== ''
  const inputCls = "w-full p-2 text-sm text-center rounded border bg-surface2 text-text outline-none focus:border-accent transition-colors"

  return (
    <div className={`bg-surface border rounded-lg overflow-hidden ${hasInput ? 'border-accent/30' : 'border-border'}`}>
      {/* R1: ブース名 + 履歴 + 景品名 + 単価 */}
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
        <span className="text-xs font-bold text-accent shrink-0">{booth.booth_code}</span>
        <button onClick={() => navigate(`/edit/${booth.booth_id}`)}
          className="text-[10px] text-muted/60 hover:text-accent shrink-0">履歴</button>
        <input ref={getRef(booth.booth_id, 'prize_name')}
          className="flex-1 min-w-0 bg-transparent text-sm text-text outline-none placeholder:text-muted/60 truncate"
          type="text" placeholder={latest?.prize_name || '景品名'}
          value={inp.prize_name || ''}
          onChange={e => setInp(booth.booth_id, 'prize_name', e.target.value)}
          onKeyDown={e => handleKeyDown(e, booth.booth_id, 'prize_name')} />
        <span className="text-[11px] text-muted shrink-0">¥{price}</span>
      </div>

      {/* R2: IN / OUT 入力 */}
      <div className="flex gap-1.5 px-2.5 pb-1">
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[10px] text-muted">IN（売上）</span>
            <span className="text-[10px] text-muted/60">{latestIn !== null ? latestIn.toLocaleString() : '-'}</span>
          </div>
          <input ref={getRef(booth.booth_id, 'in_meter')}
            className={`${inputCls} ${inAbnormal ? '!border-accent2 !bg-accent2/10' : inp.in_meter ? 'border-accent/40' : 'border-border'}`}
            type="number" inputMode="numeric"
            placeholder={latestIn !== null ? String(latestIn) : '売上メーター値'}
            value={inp.in_meter || ''}
            onChange={e => setInp(booth.booth_id, 'in_meter', e.target.value)}
            onKeyDown={e => handleKeyDown(e, booth.booth_id, 'in_meter')} />
          {inDiff !== null && (
            <div className={`text-center text-xs font-bold mt-0.5 ${inAbnormal ? 'text-accent2' : 'text-accent'}`}>
              +{inDiff.toLocaleString()} (¥{(inDiff * price).toLocaleString()})
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[10px] text-muted">OUT（払出）</span>
            <span className="text-[10px] text-muted/60">{latestOut !== null ? latestOut.toLocaleString() : '-'}</span>
          </div>
          <input ref={getRef(booth.booth_id, 'out_meter')}
            className={`${inputCls} ${outAbnormal ? '!border-accent2 !bg-accent2/10' : inp.out_meter ? 'border-accent/40' : 'border-border'}`}
            type="number" inputMode="numeric"
            placeholder={latestOut !== null ? String(latestOut) : '払出メーター値'}
            value={inp.out_meter || ''}
            onChange={e => setInp(booth.booth_id, 'out_meter', e.target.value)}
            onKeyDown={e => handleKeyDown(e, booth.booth_id, 'out_meter')} />
          {outDiff !== null && (
            <div className={`text-center text-xs font-bold mt-0.5 ${outAbnormal ? 'text-accent2' : 'text-accent'}`}>
              +{outDiff.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* R3: 残 / 補 / 設定値5種 / 出率 */}
      <div className="flex items-center gap-1 px-2.5 pb-2">
        <div className="w-[48px] md:w-[56px]">
          <div className="text-[9px] text-muted text-center">残</div>
          <input ref={getRef(booth.booth_id, 'prize_stock')}
            className="w-full p-1 text-xs text-center rounded border border-border bg-surface2 text-text outline-none focus:border-accent"
            type="number" inputMode="numeric" placeholder={latest?.prize_stock_count || '0'}
            value={inp.prize_stock || ''}
            onChange={e => setInp(booth.booth_id, 'prize_stock', e.target.value)}
            onKeyDown={e => handleKeyDown(e, booth.booth_id, 'prize_stock')} />
        </div>
        <div className="w-[48px] md:w-[56px]">
          <div className="text-[9px] text-muted text-center">補</div>
          <input ref={getRef(booth.booth_id, 'prize_restock')}
            className="w-full p-1 text-xs text-center rounded border border-border bg-surface2 text-text outline-none focus:border-accent"
            type="number" inputMode="numeric" placeholder="0"
            value={inp.prize_restock || ''}
            onChange={e => setInp(booth.booth_id, 'prize_restock', e.target.value)}
            onKeyDown={e => handleKeyDown(e, booth.booth_id, 'prize_restock')} />
        </div>
        <div className="w-px h-5 bg-border mx-0.5" />
        {SETTINGS.map(s => (
          <div key={s.key} className="w-[36px] md:w-[44px]" title={s.title}>
            <div className="text-[9px] text-accent4 text-center font-bold leading-tight">{s.label}<span className="text-[6px] text-accent4/60 block">{s.shortName}</span></div>
            <input ref={getRef(booth.booth_id, s.key)}
              className="w-full p-1 text-xs text-center rounded border border-border bg-surface2 text-text outline-none focus:border-accent4/60"
              type={s.key === 'set_o' ? 'text' : 'number'}
              inputMode={s.key === 'set_o' ? 'text' : 'numeric'}
              placeholder={latest?.[s.key] || '-'}
              value={inp[s.key] || ''}
              onChange={e => setInp(booth.booth_id, s.key, e.target.value)}
              onKeyDown={e => handleKeyDown(e, booth.booth_id, s.key)}
              title={s.title} />
          </div>
        ))}
        {payoutRate !== null && (
          <div className={`ml-auto text-xs font-bold shrink-0 px-1.5 py-0.5 rounded
            ${Number(payoutRate) > 30 ? 'text-accent2 bg-accent2/10' :
              Number(payoutRate) < 5 ? 'text-blue-400 bg-blue-900/20' :
              'text-accent3 bg-accent3/10'}`}>
            {payoutRate}%
          </div>
        )}
      </div>

      {/* 異常値アラート */}
      {(inAbnormal || outAbnormal) && (
        <div className="bg-accent2/10 px-2.5 py-1 text-[10px] text-accent2 border-t border-accent2/20">
          ⚠️ 異常値の可能性（{inAbnormal && 'IN'}{inAbnormal && outAbnormal && '・'}{outAbnormal && 'OUT'}）
        </div>
      )}
    </div>
  )
}
