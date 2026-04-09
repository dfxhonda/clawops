import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { usePatrolInput, STATUS_OPTIONS } from '../hooks/usePatrolInput'
import LogoutButton from '../components/LogoutButton'
import ErrorDisplay from '../components/ErrorDisplay'
import AnomalyBanner from '../components/AnomalyBanner'
import PatrolConfirmModal from '../components/PatrolConfirmModal'
import MeterOcr from '../components/MeterOcr'

const SETTINGS = [
  { key: 'a', label: 'A', disp: 'アシスト', title: 'アシスト回数', isText: false },
  { key: 'c', label: 'C', disp: 'キャッチ', title: 'キャッチ時パワー', isText: false },
  { key: 'l', label: 'L', disp: '緩和',     title: '緩和時パワー',    isText: false },
  { key: 'r', label: 'R', disp: '復帰',     title: '復帰時パワー',   isText: false },
  { key: 'o', label: 'O', disp: 'その他',   title: '固有設定',       isText: true  },
]

const inputCls = "w-full p-3 text-lg text-center rounded-lg border-2 border-border bg-surface2 text-text outline-none focus:border-accent"
const smallInputCls = "w-full p-2 text-sm text-center rounded-lg border border-border bg-surface2 text-text outline-none focus:border-accent"

function boothLabel(booth) {
  if (!booth) return ''
  return booth.booth_number != null
    ? `B${String(booth.booth_number).padStart(2, '0')}`
    : booth.booth_code.split('-').pop()
}

export default function PatrolInput() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const booth = state?.booth

  const {
    loading, machineName, storeName,
    booths, currentIndex, currentBooth,
    readingsMap, inputs, monthlyStatsMap,
    prevDayDate, setPrevDayDate, todayDate,
    currentInp, price, latest, last,
    latestIn, latestOut, lastIn, lastOut,
    inDiff, outDiff, inAbnormal, outAbnormal,
    inZero, inTriple, payoutRate, payoutHigh, payoutLow,
    setInp, setInpChange, toggleChange, switchBooth, handleSave,
    savedSet, savedCount, draftCount,
  } = usePatrolInput(booth, () => navigate('/patrol'))

  const [error, setError] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showOcr, setShowOcr] = useState(false)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  if (!booth) return null

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">前回データを取得しています...</p>
      </div>
    </div>
  )

  const label = boothLabel(currentBooth)
  const monthlyStats = currentBooth ? monthlyStatsMap[currentBooth.booth_code] : null
  const isSaved = currentBooth ? savedSet.has(currentBooth.booth_code) : false
  const allSaved = booths.length > 0 && savedCount === booths.length
  const hasAnomaly = inAbnormal || outAbnormal || inZero || inTriple || payoutHigh || payoutLow

  // スワイプ検出
  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      switchBooth(dx < 0 ? 'next' : 'prev')
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  function onSave() {
    setError(null)
    if (!currentInp.in_meter && latestIn === null) {
      setError({ message: 'INメーターを入力してください', type: 'validation' })
      return
    }
    setShowConfirm(true)
  }

  async function doSave() {
    setShowConfirm(false)
    const result = await handleSave()
    if (!result.ok) {
      setError({ message: result.message, type: 'validation' })
      return
    }
    // 次の未保存ブースへ自動移動
    const nextIdx = booths.findIndex((b, i) => i > currentIndex && !savedSet.has(b.booth_code))
    if (nextIdx >= 0) {
      // setCurrentIndex is not directly returned but switchBooth handles nav
      const steps = nextIdx - currentIndex
      for (let i = 0; i < steps; i++) switchBooth('next')
    }
  }

  // 当日付変更セクション
  const mr = currentInp._meterReplace || {}
  const pc = currentInp._prizeChange || {}
  const sc = currentInp._settingsChange || {}

  return (
    <div className="h-screen flex flex-col max-w-lg mx-auto">
      {/* ヘッダー */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/patrol')} className="text-2xl text-muted hover:text-accent transition-colors">←</button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-accent leading-tight">
              {label}
              {isSaved && <span className="ml-2 text-xs text-accent3 font-normal">✅ 保存済み</span>}
            </h2>
            <p className="text-xs text-muted truncate">{storeName && `${storeName} · `}{machineName}</p>
          </div>
          <LogoutButton />
        </div>
        {/* ナビドット */}
        {booths.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-2">
            {booths.map((b, i) => {
              const saved = savedSet.has(b.booth_code)
              const hasInput = !!inputs[b.booth_code]?.in_meter
              return (
                <button
                  key={b.booth_code}
                  onClick={() => {
                    const diff = i - currentIndex
                    if (diff !== 0) switchBooth(diff > 0 ? 'next' : 'prev')
                  }}
                  className={`rounded-full transition-all ${
                    i === currentIndex ? 'w-4 h-2' : 'w-2 h-2'
                  } ${
                    saved ? 'bg-accent3' : hasInput ? 'bg-accent' : 'bg-border'
                  }`}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* スクロール本体 */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-4 space-y-3"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {error && <ErrorDisplay error={error.message} type={error.type} onDismiss={() => setError(null)} />}

        {/* ━━━ 前日付セクション ━━━ */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {/* セクションヘッダー */}
          <div className="flex items-center gap-2 px-3 py-2 bg-surface2 border-b border-border">
            <span className="text-xs font-bold text-accent">📋 前日付メーター読み</span>
            <input type="date" value={prevDayDate} onChange={e => setPrevDayDate(e.target.value)}
              className="ml-auto bg-surface3 border border-border text-text text-xs px-2 py-1 rounded-md [color-scheme:dark]" />
            {prevDayDate !== new Date(Date.now() - 86400000).toISOString().slice(0, 10) &&
              <span className="text-[10px] text-accent2 font-bold">前日以外</span>}
          </div>

          <div className="p-3.5 space-y-3">
            {/* 機械状態 */}
            <div>
              <div className="text-xs text-muted mb-1.5">機械状態</div>
              <div className="flex gap-1.5 flex-wrap">
                {STATUS_OPTIONS.map(s => (
                  <button key={s.key} onClick={() => setInp('machineStatus', s.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all
                      ${(currentInp.machineStatus || 'ok') === s.key
                        ? `${s.color} bg-surface3`
                        : 'border-border text-muted bg-surface'}`}>
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 前回値 */}
            {latest && (
              <div className="bg-surface2 rounded-lg p-2.5 text-sm">
                <div className="text-muted text-xs mb-1">前回値（最新）</div>
                <div>IN: <strong>{latestIn !== null ? latestIn.toLocaleString() : '-'}</strong>　OUT: <strong>{latestOut !== null ? latestOut.toLocaleString() : '-'}</strong></div>
                {latest.prize_name && <div className="mt-0.5 text-xs">景品: {latest.prize_name}</div>}
                <div className="text-muted text-[11px] mt-0.5">{latest.read_time?.slice(0, 10)}</div>
              </div>
            )}
            {last && last !== latest && (
              <div className="bg-surface3 rounded-lg px-3 py-1.5 text-xs text-accent">
                差分基準: IN {lastIn !== null ? lastIn.toLocaleString() : '-'} ({last.read_time?.slice(0, 10)})
              </div>
            )}
            {!last && (
              <div className="bg-accent/10 rounded-lg px-3 py-1.5 text-xs text-accent">
                ⚠️ 差分計算できる過去データがありません
              </div>
            )}

            {/* OCR */}
            <button onClick={() => setShowOcr(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-accent/50 text-accent hover:bg-accent/10 transition-colors text-sm font-medium">
              📷 カメラで読取
              {currentInp.inputMethod === 'ocr' && <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">OCR適用済み</span>}
            </button>

            {/* IN / OUT */}
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="text-xs text-muted mb-1">
                  IN（売上）*
                  {!currentInp.in_meter && latestIn !== null && <span className="text-[10px] text-amber-500 block leading-tight">空欄 = 前回値を引き継ぐ</span>}
                </div>
                <input className={`${inputCls} ${inAbnormal ? '!border-accent2 !bg-accent2/10' : ''}`}
                  type="number" inputMode="numeric"
                  placeholder={latestIn !== null ? String(latestIn) : '0000000'}
                  value={currentInp.in_meter || ''}
                  onChange={e => setInp('in_meter', e.target.value)} />
                <div className="min-h-[38px] mt-1">
                  {inDiff !== null && (
                    <div className={`text-center text-sm font-bold py-1.5 rounded-lg ${inAbnormal || inZero || inTriple ? 'text-accent2 bg-accent2/10' : 'text-accent bg-accent/10'}`}>
                      {inDiff >= 0 ? '+' : ''}{inDiff.toLocaleString()}<br/>
                      <span className="text-xs">¥{(inDiff * price).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted mb-1">
                  OUT（払出）
                  {!currentInp.out_meter && latestOut !== null && <span className="text-[10px] text-amber-500 block leading-tight">空欄 = 前回値を引き継ぐ</span>}
                </div>
                <input className={`${inputCls} ${outAbnormal ? '!border-accent2 !bg-accent2/10' : ''}`}
                  type="number" inputMode="numeric"
                  placeholder={latestOut !== null ? String(latestOut) : '0000000'}
                  value={currentInp.out_meter || ''}
                  onChange={e => setInp('out_meter', e.target.value)} />
                <div className="min-h-[38px] mt-1">
                  {outDiff !== null && (
                    <div className={`text-center text-sm font-bold py-1.5 rounded-lg ${outAbnormal ? 'text-accent2 bg-accent2/10' : 'text-accent bg-accent/10'}`}>
                      {outDiff >= 0 ? '+' : ''}{outDiff.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 出率 */}
            {payoutRate !== null && (
              <div className={`text-center text-sm font-bold py-2 px-3 rounded-lg
                ${payoutHigh ? 'text-accent2 bg-accent2/10' : payoutLow ? 'text-blue-400 bg-blue-900/20' : 'text-accent3 bg-accent3/10'}`}>
                出率: {payoutRate.toFixed(1)}%
                {payoutHigh && ' ⚠️ 高'}
                {payoutLow  && ' ⚠️ 低'}
              </div>
            )}

            <AnomalyBanner
              inAbnormal={inAbnormal} outAbnormal={outAbnormal}
              inZero={inZero} inTriple={inTriple}
              payoutHigh={payoutHigh} payoutLow={payoutLow}
            />

            {/* 月次統計 */}
            {monthlyStats && (monthlyStats.curr.revenue > 0 || monthlyStats.prev.revenue > 0) && (
              <div className="flex items-center gap-2 px-3 py-2 bg-surface2 rounded-lg text-xs flex-wrap">
                <span className="text-muted shrink-0">今月</span>
                <span className="font-semibold text-accent3">¥{monthlyStats.curr.revenue.toLocaleString()}</span>
                {monthlyStats.curr.payoutRate != null &&
                  <span className="text-muted">出率 {monthlyStats.curr.payoutRate}%</span>}
                <span className="text-border">|</span>
                <span className="text-muted shrink-0">前月</span>
                <span className="text-muted">¥{monthlyStats.prev.revenue.toLocaleString()}</span>
                {monthlyStats.prev.payoutRate != null &&
                  <span className="text-muted">出率 {monthlyStats.prev.payoutRate}%</span>}
              </div>
            )}

            {/* 景品情報 */}
            <div>
              <div className="text-xs text-muted mb-1.5 font-semibold">🎁 景品情報</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <div className="text-xs text-muted mb-1">景品補充数</div>
                  <input className={inputCls} type="number" inputMode="numeric" placeholder="0"
                    value={currentInp.prize_restock || ''}
                    onChange={e => setInp('prize_restock', e.target.value)} />
                </div>
                <div>
                  <div className="text-xs text-muted mb-1">景品投入残</div>
                  <input className={inputCls} type="number" inputMode="numeric" placeholder="0"
                    value={currentInp.prize_stock || ''}
                    onChange={e => setInp('prize_stock', e.target.value)} />
                </div>
              </div>
              <div>
                <div className="text-xs text-muted mb-1">
                  景品名
                  {!currentInp.prize_name && latest?.prize_name && <span className="text-[10px] text-amber-500 block leading-tight">空欄 = 前回値を引き継ぐ</span>}
                </div>
                <input className={inputCls + ' !text-left !text-base'} type="text"
                  placeholder={latest?.prize_name || '景品名を入力'}
                  value={currentInp.prize_name || ''}
                  onChange={e => setInp('prize_name', e.target.value)} />
              </div>
            </div>

            {/* メモ */}
            <div>
              <div className="text-xs text-muted mb-1 font-semibold">📝 メモ・備考</div>
              <textarea className={inputCls + ' !text-left !text-sm resize-y min-h-12'} rows={2}
                placeholder="特記事項があれば入力"
                value={currentInp.note || ''}
                onChange={e => setInp('note', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ━━━ 当日付変更セクション ━━━ */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-bold text-muted">📅 当日付変更記録</span>
            <span className="text-[10px] text-muted bg-surface2 px-2 py-0.5 rounded-full border border-border">{todayDate}</span>
          </div>

          {/* メーター取り替え */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleChange('_meterReplace')}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${mr.enabled ? 'bg-accent/10' : ''}`}>
              <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] shrink-0 ${mr.enabled ? 'border-accent bg-accent text-white' : 'border-border'}`}>
                {mr.enabled ? '✓' : ''}
              </span>
              <span className="text-sm font-bold">🔄 メーター取り替え</span>
              <span className="text-xs text-muted ml-auto">取り替え後の値を入力</span>
            </button>
            {mr.enabled && (
              <div className="px-3 pb-3 pt-1 border-t border-border grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted mb-1">新IN値</div>
                  <input className={smallInputCls} type="number" inputMode="numeric" placeholder="0"
                    value={mr.in_meter || ''}
                    onChange={e => setInpChange('_meterReplace', 'in_meter', e.target.value)} />
                </div>
                <div>
                  <div className="text-xs text-muted mb-1">新OUT値</div>
                  <input className={smallInputCls} type="number" inputMode="numeric" placeholder="0"
                    value={mr.out_meter || ''}
                    onChange={e => setInpChange('_meterReplace', 'out_meter', e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* 景品変更 */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleChange('_prizeChange')}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${pc.enabled ? 'bg-accent/10' : ''}`}>
              <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] shrink-0 ${pc.enabled ? 'border-accent bg-accent text-white' : 'border-border'}`}>
                {pc.enabled ? '✓' : ''}
              </span>
              <span className="text-sm font-bold">🎁 景品変更</span>
              <span className="text-xs text-muted ml-auto">景品を入れ替えた場合</span>
            </button>
            {pc.enabled && (
              <div className="px-3 pb-3 pt-1 border-t border-border space-y-2">
                <div>
                  <div className="text-xs text-muted mb-1">新景品名 *</div>
                  <input className={smallInputCls + ' !text-left'} type="text" placeholder="景品名を入力"
                    value={pc.prize_name || ''}
                    onChange={e => setInpChange('_prizeChange', 'prize_name', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-muted mb-1">投入数</div>
                    <input className={smallInputCls} type="number" inputMode="numeric" placeholder="0"
                      value={pc.prize_stock || ''}
                      onChange={e => setInpChange('_prizeChange', 'prize_stock', e.target.value)} />
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1">補充数</div>
                    <input className={smallInputCls} type="number" inputMode="numeric" placeholder="0"
                      value={pc.prize_restock || ''}
                      onChange={e => setInpChange('_prizeChange', 'prize_restock', e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 設定変更 */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleChange('_settingsChange')}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${sc.enabled ? 'bg-accent/10' : ''}`}>
              <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] shrink-0 ${sc.enabled ? 'border-accent bg-accent text-white' : 'border-border'}`}>
                {sc.enabled ? '✓' : ''}
              </span>
              <span className="text-sm font-bold">⚙️ 設定変更</span>
              <span className="text-xs text-muted ml-auto">クレーン設定を変更した場合</span>
            </button>
            {sc.enabled && (
              <div className="px-3 pb-3 pt-1 border-t border-border">
                <div className="flex gap-1.5">
                  {SETTINGS.map(s => (
                    <div key={s.key} className="flex-1" title={s.title}>
                      <div className="text-[10px] text-accent4 text-center font-bold leading-tight mb-0.5">
                        {s.label}<span className="text-[9px] text-accent4/70 block font-normal">{s.disp}</span>
                      </div>
                      <input
                        className="w-full p-1.5 text-xs text-center rounded-lg border border-border bg-surface2 text-text outline-none focus:border-accent4/60"
                        type={s.isText ? 'text' : 'number'}
                        inputMode={s.isText ? 'text' : 'numeric'}
                        placeholder={latest?.[`set_${s.key}`] || '-'}
                        value={sc[`set_${s.key}`] || ''}
                        onChange={e => setInpChange('_settingsChange', `set_${s.key}`, e.target.value)}
                        title={s.title}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* フッター */}
      <div className="shrink-0 px-4 pt-2 pb-4 border-t border-border bg-bg space-y-2">
        {/* ブース切り替え + 保存 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => switchBooth('prev')}
            disabled={currentIndex === 0}
            className="px-4 py-3 rounded-xl border border-border text-muted disabled:opacity-30 active:scale-95 transition-all text-lg">
            ‹
          </button>

          {allSaved ? (
            <button
              onClick={() => navigate('/drafts')}
              className="flex-1 py-3 rounded-xl bg-accent3 text-white font-bold text-sm active:scale-[0.98] transition-all">
              まとめて送信 ({savedCount}件) →
            </button>
          ) : isSaved ? (
            <button
              onClick={() => switchBooth('next')}
              className="flex-1 py-3 rounded-xl bg-surface2 border border-border text-accent3 font-bold text-sm active:scale-[0.98]">
              ✅ 保存済み — 次へ →
            </button>
          ) : (
            <button
              onClick={onSave}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm active:scale-[0.98] transition-all">
              {label} を保存
            </button>
          )}

          <button
            onClick={() => switchBooth('next')}
            disabled={currentIndex === booths.length - 1}
            className="px-4 py-3 rounded-xl border border-border text-muted disabled:opacity-30 active:scale-95 transition-all text-lg">
            ›
          </button>
        </div>

        {/* 進捗 + DraftList */}
        {booths.length > 1 && (
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{currentIndex + 1} / {booths.length} ブース　保存済 {savedCount}</span>
            {draftCount > 0 && (
              <button onClick={() => navigate('/drafts')}
                className="text-accent underline">
                下書き {draftCount}件
              </button>
            )}
          </div>
        )}
      </div>

      {/* OCRモーダル */}
      {showOcr && currentBooth && (
        <MeterOcr
          boothCode={currentBooth.booth_code}
          lastIn={lastIn}
          lastOut={lastOut}
          onApply={({ inMeter, outMeter, confidence }) => {
            setInp('in_meter', inMeter)
            setInp('out_meter', outMeter)
            setInp('inputMethod', 'ocr')
            setInp('ocrConfidence', confidence)
            setShowOcr(false)
          }}
          onClose={() => setShowOcr(false)}
        />
      )}

      {/* 保存確認モーダル */}
      {showConfirm && (
        <PatrolConfirmModal
          boothCode={label}
          inDiff={inDiff} outDiff={outDiff} payoutRate={payoutRate} price={price}
          inAbnormal={inAbnormal} inZero={inZero} inTriple={inTriple}
          outAbnormal={outAbnormal} payoutHigh={payoutHigh} payoutLow={payoutLow}
          hasAnomaly={hasAnomaly}
          onSave={doSave} onClose={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
