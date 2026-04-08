import { useState, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { parseNum } from '../services/utils'
import { useBoothInput } from '../hooks/useBoothInput'
import LogoutButton from '../components/LogoutButton'
import ErrorDisplay from '../components/ErrorDisplay'
import PrizeSearchModal from '../components/PrizeSearchModal'
import { getPrizes } from '../services/prizes'

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
    booths, machineName, readingsMap, inputs, vehicleStocks, monthlyStatsMap,
    readDate, setReadDate, filter, setFilter, filteredBooths, inputCount, anomalyCount,
    loading, showVehiclePanel, setShowVehiclePanel, staffId,
    setInp, handleKeyDown, handleSaveAll, getRef, setStaffId, clearStaff, scrollToBooth,
  } = useBoothInput(machineId, state)

  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [searchModalBooth, setSearchModalBooth] = useState(null)
  const [prizes, setPrizes] = useState(null)

  async function openSearchModal(boothId) {
    if (!prizes) {
      const data = await getPrizes()
      setPrizes(data)
    }
    setSearchModalBooth(boothId)
  }

  // 保存確認モーダルを開く
  function onSave() {
    setError(null)
    if (inputCount === 0) {
      setError({ message: 'まだINメーターが入力されていません。\nブースのIN欄に売上メーター値を入力してください。', type: 'validation' })
      return
    }
    setShowConfirmModal(true)
  }

  // 確認後に実際に保存
  async function doSave() {
    setShowConfirmModal(false)
    setSaving(true)
    setError(null)
    const result = await handleSaveAll()
    setSaving(false)
    if (!result.ok) { setError({ message: result.message, type: 'validation' }); return }
    if (result.failedItems?.length > 0) {
      const details = result.failedItems.map(f => `・${f.prizeName}: ${f.error}`).join('\n')
      setError({ message: `補充処理でエラーが発生しました。棚卸し画面で在庫を確認してください。\n${details}`, type: 'stock_insufficient' })
    }
    navigate('/drafts', { state: { storeName: state?.storeName, storeId: state?.storeId } })
  }

  // スワイプによるブース切り替え
  function handleSwipe(boothId, direction) {
    const idx = filteredBooths.findIndex(b => b.booth_code === boothId)
    const targetIdx = direction === 'next' ? idx + 1 : idx - 1
    if (targetIdx < 0 || targetIdx >= filteredBooths.length) return
    scrollToBooth(filteredBooths[targetIdx].booth_code)
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

      {error && <ErrorDisplay error={error.message} type={error.type} onDismiss={() => setError(null)} />}

      {/* ブース一覧 */}
      {filteredBooths.length === 0 ? (
        <div className="text-center text-muted text-sm py-8">
          {filter === 'todo' ? '全ブース入力済みです' : '入力済みのブースはありません'}
        </div>
      ) : null}
      <div className="space-y-1.5">
        {filteredBooths.map((booth) => (
          <BoothCard
            key={booth.booth_code}
            booth={booth}
            readingsMap={readingsMap}
            inp={inputs[booth.booth_code] || {}}
            setInp={setInp}
            navigate={navigate}
            getRef={getRef}
            handleKeyDown={handleKeyDown}
            onOpenSearch={openSearchModal}
            onSwipe={handleSwipe}
            monthlyStats={monthlyStatsMap[booth.booth_code] || monthlyStatsMap[booth.booth_code] || null}
          />
        ))}
      </div>
      </div>{/* スクロール領域終了 */}

      {searchModalBooth && (
        <PrizeSearchModal
          prizes={prizes}
          vehicleStocks={vehicleStocks}
          onSelect={name => setInp(searchModalBooth, 'prize_name', name)}
          onClose={() => setSearchModalBooth(null)}
        />
      )}

      {/* 保存確認モーダル */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowConfirmModal(false)}>
          <div className="w-full max-w-lg bg-bg border-t border-border rounded-t-2xl p-5 pb-8 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="text-sm font-bold text-center">保存確認</div>
            <div className="bg-surface2 rounded-xl p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">入力済みブース</span>
                <span className="font-bold text-accent">{inputCount} / {booths.length} 件</span>
              </div>
              {booths.length - inputCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">未入力</span>
                  <span className="text-accent2">{booths.length - inputCount} 件</span>
                </div>
              )}
              {anomalyCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">異常値あり</span>
                  <span className="font-bold text-accent2">⚠️ {anomalyCount} 台</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 rounded-xl border border-border text-sm text-muted active:scale-[0.98]">
                戻る
              </button>
              <button onClick={doSave}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm active:scale-[0.98]">
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 固定フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg/95 backdrop-blur border-t border-border px-3 py-2.5 z-50">
        <div className="max-w-lg mx-auto">
          <button onClick={onSave} disabled={saving}
            className={`w-full text-white font-bold py-3.5 rounded-xl transition-all min-h-[48px] active:scale-[0.98] disabled:opacity-50
              ${inputCount > 0 && inputCount >= booths.length
                ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/30 animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700'}`}>
            {saving ? '保存中...'
              : inputCount >= booths.length
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
function BoothCard({ booth, readingsMap, inp, setInp, getRef, handleKeyDown, navigate, onOpenSearch, onSwipe, monthlyStats }) {
  const { latest, last } = readingsMap[booth.booth_code] || {}
  const price = parseNum(booth.play_price || '100')

  const latestIn  = latest?.in_meter  ? parseNum(latest.in_meter)  : null
  const latestOut = latest?.out_meter ? parseNum(latest.out_meter) : null
  const lastIn    = last?.in_meter    ? parseNum(last.in_meter)    : null
  const lastOut   = last?.out_meter   ? parseNum(last.out_meter)   : null

  const inVal  = inp.in_meter  ? parseNum(inp.in_meter)  : null
  const outVal = inp.out_meter ? parseNum(inp.out_meter) : null
  const inDiff  = inVal  !== null && lastIn  !== null ? inVal  - lastIn  : null
  const outDiff = outVal !== null && lastOut !== null ? outVal - lastOut : null

  // 現行の異常値（範囲外）
  const inAbnormal  = inDiff  !== null && (inDiff  < 0 || inDiff  > 50000)
  const outAbnormal = outDiff !== null && (outDiff < 0 || outDiff > 50000)

  // 追加異常値
  const prevInDiff = latestIn !== null && lastIn !== null ? latestIn - lastIn : null
  const inZero   = inDiff !== null && inVal !== null && inDiff === 0
  const inTriple = prevInDiff !== null && prevInDiff > 50 && inDiff !== null && inDiff > prevInDiff * 3

  const payout = outDiff !== null && outDiff >= 0 ? outDiff : null
  const payoutRate = payout !== null && inDiff !== null && inDiff > 0
    ? ((payout / inDiff) * 100).toFixed(1) : null

  // 出率アラート
  const payoutHigh = payoutRate !== null && Number(payoutRate) >= 30
  const payoutLow  = payoutRate !== null && Number(payoutRate) < 5

  const hasInput = inp.in_meter && inp.in_meter !== ''
  const inputCls = "w-full p-2 text-sm text-center rounded border bg-surface2 text-text outline-none focus:border-accent transition-colors"

  // スワイプ検知
  const txRef = useRef(null)
  const tyRef = useRef(null)

  return (
    <div
      className={`bg-surface border rounded-lg overflow-hidden ${hasInput ? 'border-accent/30' : 'border-border'}`}
      onTouchStart={e => { txRef.current = e.touches[0].clientX; tyRef.current = e.touches[0].clientY }}
      onTouchEnd={e => {
        if (txRef.current === null) return
        const dx = e.changedTouches[0].clientX - txRef.current
        const dy = e.changedTouches[0].clientY - tyRef.current
        txRef.current = null
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          onSwipe(booth.booth_code, dx > 0 ? 'prev' : 'next')
        }
      }}
    >
      {/* R1: ブース名 + 履歴 + 景品名 + 単価 */}
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
        <span className="text-xs font-bold text-accent shrink-0">
          {booth.booth_number != null ? `B${String(booth.booth_number).padStart(2,'0')}` : booth.booth_code}
        </span>
        <button onClick={() => navigate(`/edit/${booth.booth_code}`)}
          className="text-[10px] text-muted/60 hover:text-accent shrink-0">履歴</button>
        <input ref={getRef(booth.booth_code, 'prize_name')}
          className="flex-1 min-w-0 bg-transparent text-sm text-text outline-none placeholder:text-muted/60 truncate"
          type="text" placeholder={latest?.prize_name || '景品名'}
          value={inp.prize_name || ''}
          onChange={e => setInp(booth.booth_code, 'prize_name', e.target.value)}
          onKeyDown={e => handleKeyDown(e, booth.booth_code, 'prize_name')} />
        <button onClick={() => onOpenSearch(booth.booth_code)}
          className="text-base shrink-0 text-muted/60 hover:text-accent active:scale-90 transition-all px-0.5"
          title="景品を画像検索">🔍</button>
        <span className="text-[11px] text-muted shrink-0">¥{price}</span>
      </div>

      {/* R2: IN / OUT 入力 */}
      <div className="flex gap-1.5 px-2.5 pb-1">
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[10px] text-muted">IN（売上）</span>
            <span className="text-[10px] text-muted/60">{latestIn !== null ? latestIn.toLocaleString() : '-'}</span>
          </div>
          <input ref={getRef(booth.booth_code, 'in_meter')}
            className={`${inputCls} ${inAbnormal ? '!border-accent2 !bg-accent2/10' : inp.in_meter ? 'border-accent/40' : 'border-border'}`}
            type="number" inputMode="numeric"
            placeholder={latestIn !== null ? String(latestIn) : '売上メーター値'}
            value={inp.in_meter || ''}
            onChange={e => setInp(booth.booth_code, 'in_meter', e.target.value)}
            onKeyDown={e => handleKeyDown(e, booth.booth_code, 'in_meter')} />
          {inDiff !== null && (
            <div className={`text-center text-xs font-bold mt-0.5 ${inAbnormal || inZero || inTriple ? 'text-accent2' : 'text-accent'}`}>
              {inDiff === 0 ? '±0' : `+${inDiff.toLocaleString()}`} (¥{(inDiff * price).toLocaleString()})
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[10px] text-muted">OUT（払出）</span>
            <span className="text-[10px] text-muted/60">{latestOut !== null ? latestOut.toLocaleString() : '-'}</span>
          </div>
          <input ref={getRef(booth.booth_code, 'out_meter')}
            className={`${inputCls} ${outAbnormal ? '!border-accent2 !bg-accent2/10' : inp.out_meter ? 'border-accent/40' : 'border-border'}`}
            type="number" inputMode="numeric"
            placeholder={latestOut !== null ? String(latestOut) : '払出メーター値'}
            value={inp.out_meter || ''}
            onChange={e => setInp(booth.booth_code, 'out_meter', e.target.value)}
            onKeyDown={e => handleKeyDown(e, booth.booth_code, 'out_meter')} />
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
          <input ref={getRef(booth.booth_code, 'prize_stock')}
            className="w-full p-1 text-xs text-center rounded border border-border bg-surface2 text-text outline-none focus:border-accent"
            type="number" inputMode="numeric" placeholder={latest?.prize_stock_count || '0'}
            value={inp.prize_stock || ''}
            onChange={e => setInp(booth.booth_code, 'prize_stock', e.target.value)}
            onKeyDown={e => handleKeyDown(e, booth.booth_code, 'prize_stock')} />
        </div>
        <div className="w-[48px] md:w-[56px]">
          <div className="text-[9px] text-muted text-center">補</div>
          <input ref={getRef(booth.booth_code, 'prize_restock')}
            className="w-full p-1 text-xs text-center rounded border border-border bg-surface2 text-text outline-none focus:border-accent"
            type="number" inputMode="numeric" placeholder="0"
            value={inp.prize_restock || ''}
            onChange={e => setInp(booth.booth_code, 'prize_restock', e.target.value)}
            onKeyDown={e => handleKeyDown(e, booth.booth_code, 'prize_restock')} />
        </div>
        <div className="w-px h-5 bg-border mx-0.5" />
        {SETTINGS.map(s => (
          <div key={s.key} className="w-[36px] md:w-[44px]" title={s.title}>
            <div className="text-[9px] text-accent4 text-center font-bold leading-tight">{s.label}<span className="text-[6px] text-accent4/60 block">{s.shortName}</span></div>
            <input ref={getRef(booth.booth_code, s.key)}
              className="w-full p-1 text-xs text-center rounded border border-border bg-surface2 text-text outline-none focus:border-accent4/60"
              type={s.key === 'set_o' ? 'text' : 'number'}
              inputMode={s.key === 'set_o' ? 'text' : 'numeric'}
              placeholder={latest?.[s.key] || '-'}
              value={inp[s.key] || ''}
              onChange={e => setInp(booth.booth_code, s.key, e.target.value)}
              onKeyDown={e => handleKeyDown(e, booth.booth_code, s.key)}
              title={s.title} />
          </div>
        ))}
        {payoutRate !== null && (
          <div className={`ml-auto text-xs font-bold shrink-0 px-1.5 py-0.5 rounded
            ${payoutHigh ? 'text-accent2 bg-accent2/10' :
              payoutLow  ? 'text-blue-400 bg-blue-900/20' :
              'text-accent3 bg-accent3/10'}`}>
            {payoutRate}%
          </div>
        )}
      </div>

      {/* 月次統計行（daily_booth_stats からのデータ） */}
      {monthlyStats && (monthlyStats.curr.revenue > 0 || monthlyStats.prev.revenue > 0) && (
        <div className="flex items-center gap-2 px-2.5 py-1 border-t border-border/30 bg-surface2/30">
          <span className="text-[9px] text-muted">今月</span>
          <span className="text-[10px] font-semibold text-accent3">
            ¥{monthlyStats.curr.revenue.toLocaleString()}
          </span>
          <span className="text-[9px] text-muted ml-1">前月</span>
          <span className="text-[10px] text-muted">
            ¥{monthlyStats.prev.revenue.toLocaleString()}
          </span>
        </div>
      )}

      {/* 異常値アラートバナー */}
      {(inAbnormal || outAbnormal || inZero || inTriple || payoutHigh || payoutLow) && (
        <div className="bg-accent2/10 px-2.5 py-1 text-[10px] text-accent2 border-t border-accent2/20">
          ⚠️
          {inAbnormal && ' IN異常値'}
          {inZero     && ' INゼロ'}
          {inTriple   && ' IN差分3倍'}
          {outAbnormal && ' OUT異常値'}
          {payoutHigh && ' 出率高(≥30%)'}
          {payoutLow  && ' 出率低(<5%)'}
        </div>
      )}
    </div>
  )
}
