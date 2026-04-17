import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { usePatrolInput, STATUS_OPTIONS } from '../../hooks/usePatrolInput'
import LogoutButton from '../../components/LogoutButton'
import ErrorDisplay from '../../components/ErrorDisplay'
import AnomalyBanner from '../components/AnomalyBanner'
import PatrolConfirmModal from '../components/PatrolConfirmModal'
import MeterOcr from '../components/MeterOcr'

// 前日付タブ用（set_a〜o キーで直接保存）
const SETTINGS_PREV = [
  { key: 'set_a', label: 'A', shortName: 'ｱｼｽﾄ', title: 'アシスト回数',    isText: false },
  { key: 'set_c', label: 'C', shortName: 'ｷｬｯﾁ', title: 'キャッチ時パワー', isText: false },
  { key: 'set_l', label: 'L', shortName: 'ﾕﾙ',   title: '緩和時パワー',    isText: false },
  { key: 'set_r', label: 'R', shortName: 'ﾘﾀｰﾝ', title: '復帰時パワー',    isText: false },
  { key: 'set_o', label: 'O', shortName: 'ｿﾉ他', title: '固有設定',        isText: true  },
]

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
    todayInDiff, todayOutDiff, todayInAbnormal, todayOutAbnormal,
    todayInZero, todayPayoutRate, todayPayoutHigh, todayPayoutLow,
    setInp, switchBooth, handleSave,
    savedSet, savedCount, draftCount,
  } = usePatrolInput(booth, () => navigate('/patrol'))

  const [activeTab, setActiveTab] = useState('prev')
  const [error, setError] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showOcr, setShowOcr] = useState(false)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  if (!booth) return null

  if (loading) return (
    <div className="h-dvh flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">読み込み中...</p>
      </div>
    </div>
  )

  const label = boothLabel(currentBooth)
  const isSaved = currentBooth ? savedSet.has(currentBooth.booth_code) : false
  const allSaved = booths.length > 0 && savedCount === booths.length
  const hasAnomaly = inAbnormal || outAbnormal || inZero || inTriple || payoutHigh || payoutLow
  const todayHasAnomaly = todayInAbnormal || todayOutAbnormal || todayInZero || todayPayoutHigh || todayPayoutLow
  const monthlyStats = currentBooth ? monthlyStatsMap[currentBooth.booth_code] : null
  const todayHasInput = !!currentInp.today_in_meter

  // スワイプでブース切り替え
  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      switchBooth(dx < 0 ? 'next' : 'prev')
    }
    touchStartX.current = null; touchStartY.current = null
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
    if (!result.ok) { setError({ message: result.message, type: 'validation' }); return }
    const nextIdx = booths.findIndex((b, i) => i > currentIndex && !savedSet.has(b.booth_code))
    if (nextIdx >= 0) {
      for (let i = 0; i < nextIdx - currentIndex; i++) switchBooth('next')
    }
  }

  // 入力フィールドのスタイル（16px保証はCSSで済み、UIにはp-2.5/rounded-lg/border）
  const inp = "w-full px-3 py-2.5 rounded-lg border-2 border-border bg-surface2 text-text text-center outline-none focus:border-accent transition-colors"

  return (
    <div
      className="h-dvh flex flex-col max-w-lg mx-auto select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ━━━ ヘッダー ━━━ */}
      <div className="shrink-0 px-3 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/patrol')}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-muted active:bg-surface2 transition-colors text-xl">
            ←
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-accent">{label}</span>
              {isSaved && <span className="text-[11px] text-accent3 bg-accent3/15 px-1.5 py-0.5 rounded-full">✓保存済</span>}
              {hasAnomaly && !isSaved && <span className="text-[11px] text-accent2 bg-accent2/15 px-1.5 py-0.5 rounded-full">⚠️異常値</span>}
            </div>
            <p className="text-xs text-muted truncate">{storeName && `${storeName} · `}{machineName}</p>
          </div>
          <LogoutButton />
        </div>

        {/* ナビドット */}
        {booths.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-1.5">
            {booths.map((b, i) => {
              const sv = savedSet.has(b.booth_code)
              const hi = !!inputs[b.booth_code]?.in_meter
              return (
                <button key={b.booth_code}
                  onClick={() => { const d = i - currentIndex; if (d !== 0) switchBooth(d > 0 ? 'next' : 'prev') }}
                  className={`rounded-full transition-all ${i === currentIndex ? 'w-5 h-2.5' : 'w-2 h-2'} ${sv ? 'bg-accent3' : hi ? 'bg-accent' : 'bg-border'}`} />
              )
            })}
          </div>
        )}

        {/* タブ */}
        <div className="flex mt-2 bg-surface2 rounded-xl p-0.5 gap-0.5">
          <button
            onClick={() => setActiveTab('prev')}
            className={`flex-1 py-2 rounded-[10px] text-sm font-bold transition-all ${activeTab === 'prev' ? 'bg-accent text-bg' : 'text-muted active:bg-surface3'}`}>
            📋 前日付
          </button>
          <button
            onClick={() => setActiveTab('today')}
            className={`flex-1 py-2 rounded-[10px] text-sm font-bold transition-all relative ${activeTab === 'today' ? 'bg-accent text-bg' : 'text-muted active:bg-surface3'}`}>
            📅 当日付
            {todayHasInput && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent rounded-full" />
            )}
          </button>
        </div>

        {/* 入力日付 + カメラボタン（タブ連動・固定） */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 flex items-center gap-2 px-2.5 py-2 bg-surface rounded-lg border border-border min-w-0">
            <span className="text-xs text-muted shrink-0">入力日付</span>
            {activeTab === 'prev' ? (
              <>
                <input type="date" value={prevDayDate}
                  onChange={e => setPrevDayDate(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-text text-xs outline-none [color-scheme:dark]" />
                {prevDayDate !== new Date(Date.now() - 86400000).toISOString().slice(0, 10) &&
                  <span className="text-[10px] text-accent2 font-bold shrink-0">前日以外</span>}
              </>
            ) : (
              <span className="text-xs text-text font-medium">{todayDate} <span className="text-accent3 text-[10px]">当日</span></span>
            )}
          </div>
          <button
            onClick={() => setShowOcr(true)}
            className="shrink-0 h-10 px-3 flex items-center gap-1.5 bg-surface border border-border rounded-lg text-accent active:bg-accent/10 transition-colors">
            <span className="text-base">📷</span>
            {(activeTab === 'prev' ? currentInp.inputMethod : currentInp.today_inputMethod) === 'ocr'
              ? <span className="text-[10px] bg-accent/20 px-1.5 py-0.5 rounded text-accent">OCR済</span>
              : <span className="text-xs text-muted">読取</span>}
          </button>
        </div>
      </div>

      {/* ━━━ エラー ━━━ */}
      {error && (
        <div className="shrink-0 px-3">
          <ErrorDisplay error={error.message} type={error.type} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* ━━━ コンテンツ ━━━ */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-2">

        {/* ===== 前日付タブ ===== */}
        {activeTab === 'prev' && (
          <div className="space-y-2 py-2">

            {/* 機械状態 */}
            <div className="flex gap-1 flex-wrap">
              {STATUS_OPTIONS.map(s => (
                <button key={s.key}
                  onClick={() => setInp('machineStatus', s.key)}
                  className={`flex-1 min-w-[60px] py-2 rounded-lg text-xs font-bold border-2 transition-all active:scale-95
                    ${(currentInp.machineStatus || 'ok') === s.key
                      ? `${s.color} bg-surface3`
                      : 'border-border text-muted bg-surface'}`}>
                  {s.icon}<br/><span className="text-[10px]">{s.label}</span>
                </button>
              ))}
            </div>

            {/* 前回値 + 日付 コンパクト1行 */}
            <div className="flex items-center gap-2 px-2.5 py-2 bg-surface rounded-lg border border-border text-xs">
              <span className="text-muted shrink-0">前回</span>
              {latest ? (
                <>
                  <span>IN <strong>{latestIn?.toLocaleString() ?? '-'}</strong></span>
                  <span>OUT <strong>{latestOut?.toLocaleString() ?? '-'}</strong></span>
                  {latest.prize_name && <span className="text-muted truncate">{latest.prize_name}</span>}
                  <span className="text-muted ml-auto shrink-0">{latest.read_time?.slice(5, 10)}</span>
                </>
              ) : <span className="text-muted">データなし</span>}
            </div>

            {/* 差分基準（last ≠ latest のとき） */}
            {last && last !== latest && (
              <div className="px-2.5 py-1.5 bg-surface3 rounded-lg text-xs text-accent">
                差分基準: IN {lastIn?.toLocaleString() ?? '-'} ({last.read_time?.slice(5, 10)})
              </div>
            )}

            {/* IN / OUT 2カラム */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted mb-1 px-0.5">IN（売上）<span className="text-accent2">*</span></div>
                <input className={`${inp} ${inAbnormal ? '!border-accent2 !bg-accent2/10' : ''}`}
                  type="number" inputMode="numeric"
                  placeholder={latestIn !== null ? String(latestIn) : '---'}
                  value={currentInp.in_meter || ''}
                  onChange={e => setInp('in_meter', e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-muted mb-1 px-0.5">OUT（払出）</div>
                <input className={`${inp} ${outAbnormal ? '!border-accent2 !bg-accent2/10' : ''}`}
                  type="number" inputMode="numeric"
                  placeholder={latestOut !== null ? String(latestOut) : '---'}
                  value={currentInp.out_meter || ''}
                  onChange={e => setInp('out_meter', e.target.value)} />
              </div>
            </div>

            {/* 差分 + 出率 コンパクト表示 */}
            {(inDiff !== null || outDiff !== null || payoutRate !== null) && (
              <div className="grid grid-cols-3 gap-1.5">
                {inDiff !== null && (
                  <div className={`py-1.5 rounded-lg text-center text-xs font-bold ${inAbnormal || inZero || inTriple ? 'text-accent2 bg-accent2/10' : 'text-accent bg-accent/10'}`}>
                    IN {inDiff >= 0 ? '+' : ''}{inDiff.toLocaleString()}
                    <div className="text-[10px] opacity-80">¥{(inDiff * price).toLocaleString()}</div>
                  </div>
                )}
                {outDiff !== null && (
                  <div className={`py-1.5 rounded-lg text-center text-xs font-bold ${outAbnormal ? 'text-accent2 bg-accent2/10' : 'text-accent bg-accent/10'}`}>
                    OUT {outDiff >= 0 ? '+' : ''}{outDiff.toLocaleString()}
                  </div>
                )}
                {payoutRate !== null && (
                  <div className={`py-1.5 rounded-lg text-center text-xs font-bold ${payoutHigh || payoutLow ? 'text-accent2 bg-accent2/10' : 'text-accent3 bg-accent3/10'}`}>
                    出率 {payoutRate.toFixed(1)}%
                    {payoutHigh && <div className="text-[10px]">⚠️高</div>}
                    {payoutLow && <div className="text-[10px]">⚠️低</div>}
                  </div>
                )}
              </div>
            )}

            <AnomalyBanner
              inAbnormal={inAbnormal} outAbnormal={outAbnormal}
              inZero={inZero} inTriple={inTriple}
              payoutHigh={payoutHigh} payoutLow={payoutLow}
            />

            {/* 月次統計（データあり時のみ） */}
            {monthlyStats && (monthlyStats.curr.revenue > 0 || monthlyStats.prev.revenue > 0) && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-surface rounded-lg border border-border text-xs flex-wrap">
                <span className="text-muted">今月</span>
                <span className="font-semibold text-accent3">¥{monthlyStats.curr.revenue.toLocaleString()}</span>
                {monthlyStats.curr.payoutRate != null && <span className="text-muted">出率{monthlyStats.curr.payoutRate}%</span>}
                <span className="text-border">|</span>
                <span className="text-muted">前月</span>
                <span className="text-muted">¥{monthlyStats.prev.revenue.toLocaleString()}</span>
                {monthlyStats.prev.payoutRate != null && <span className="text-muted">出率{monthlyStats.prev.payoutRate}%</span>}
              </div>
            )}

            {/* 景品名 */}
            <div>
              <div className="text-xs text-muted mb-1 px-0.5">
                景品名
                {!currentInp.prize_name && latest?.prize_name && <span className="text-[10px] text-amber-500 ml-1">空欄=前回引継</span>}
              </div>
              <input className={inp + ' !text-left'} type="text"
                placeholder={latest?.prize_name || '景品名を入力'}
                value={currentInp.prize_name || ''}
                onChange={e => setInp('prize_name', e.target.value)} />
            </div>

            {/* 投入残 / 補充数（左右入れ替え済） */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted mb-1 px-0.5">景品投入残</div>
                <input className={inp} type="number" inputMode="numeric" placeholder="0"
                  value={currentInp.prize_stock || ''}
                  onChange={e => setInp('prize_stock', e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-muted mb-1 px-0.5">景品補充数</div>
                <input className={inp} type="number" inputMode="numeric" placeholder="0"
                  value={currentInp.prize_restock || ''}
                  onChange={e => setInp('prize_restock', e.target.value)} />
              </div>
            </div>

            {/* ACLRO設定値 */}
            <div>
              <div className="text-xs text-muted mb-1.5 px-0.5">⚙️ 設定値 (A/C/L/R/O)</div>
              <div className="flex gap-1.5">
                {SETTINGS_PREV.map(s => (
                  <div key={s.key} className="w-[36px] shrink-0" title={s.title}>
                    <div className="text-[9px] text-accent4 text-center font-bold leading-tight mb-0.5">
                      {s.label}<span className="block text-[6px] text-accent4/60 font-normal">{s.shortName}</span>
                    </div>
                    <input
                      className="w-full p-1 text-center rounded border border-border bg-surface2 text-text outline-none focus:border-accent4/60"
                      type={s.isText ? 'text' : 'number'}
                      inputMode={s.isText ? 'text' : 'numeric'}
                      placeholder={latest?.[s.key] || '-'}
                      value={currentInp[s.key] || ''}
                      onChange={e => setInp(s.key, e.target.value)}
                      title={s.title}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* メモ */}
            <div>
              <div className="text-xs text-muted mb-1 px-0.5">メモ</div>
              <textarea className={inp + ' !text-left resize-none'} rows={2}
                placeholder="特記事項があれば入力"
                value={currentInp.note || ''}
                onChange={e => setInp('note', e.target.value)} />
            </div>
          </div>
        )}

        {/* ===== 当日付タブ（前日付と同構成・today_プレフィックス） ===== */}
        {activeTab === 'today' && (
          <div className="space-y-2 py-2">

            {/* 機械状態 */}
            <div className="flex gap-1 flex-wrap">
              {STATUS_OPTIONS.map(s => (
                <button key={s.key}
                  onClick={() => setInp('today_machineStatus', s.key)}
                  className={`flex-1 min-w-[60px] py-2 rounded-lg text-xs font-bold border-2 transition-all active:scale-95
                    ${(currentInp.today_machineStatus || 'ok') === s.key
                      ? `${s.color} bg-surface3`
                      : 'border-border text-muted bg-surface'}`}>
                  {s.icon}<br/><span className="text-[10px]">{s.label}</span>
                </button>
              ))}
            </div>

            {/* 前回値（前日付入力値 or latestIn/Out） */}
            <div className="flex items-center gap-2 px-2.5 py-2 bg-surface rounded-lg border border-border text-xs">
              <span className="text-muted shrink-0">基準</span>
              <span>IN <strong>{(currentInp.in_meter ? parseFloat(currentInp.in_meter) : latestIn)?.toLocaleString() ?? '-'}</strong></span>
              <span>OUT <strong>{(currentInp.out_meter ? parseFloat(currentInp.out_meter) : latestOut)?.toLocaleString() ?? '-'}</strong></span>
              <span className="text-muted ml-auto text-[10px]">前日付入力値</span>
            </div>

            {/* IN / OUT */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted mb-1 px-0.5">IN（売上）<span className="text-accent2">*</span></div>
                <input className={`${inp} ${todayInAbnormal ? '!border-accent2 !bg-accent2/10' : ''}`}
                  type="number" inputMode="numeric" placeholder="---"
                  value={currentInp.today_in_meter || ''}
                  onChange={e => setInp('today_in_meter', e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-muted mb-1 px-0.5">OUT（払出）</div>
                <input className={`${inp} ${todayOutAbnormal ? '!border-accent2 !bg-accent2/10' : ''}`}
                  type="number" inputMode="numeric" placeholder="---"
                  value={currentInp.today_out_meter || ''}
                  onChange={e => setInp('today_out_meter', e.target.value)} />
              </div>
            </div>

            {/* 差分 + 出率 */}
            {(todayInDiff !== null || todayOutDiff !== null || todayPayoutRate !== null) && (
              <div className="grid grid-cols-3 gap-1.5">
                {todayInDiff !== null && (
                  <div className={`py-1.5 rounded-lg text-center text-xs font-bold ${todayInAbnormal || todayInZero ? 'text-accent2 bg-accent2/10' : 'text-accent bg-accent/10'}`}>
                    IN {todayInDiff >= 0 ? '+' : ''}{todayInDiff.toLocaleString()}
                    <div className="text-[10px] opacity-80">¥{(todayInDiff * price).toLocaleString()}</div>
                  </div>
                )}
                {todayOutDiff !== null && (
                  <div className={`py-1.5 rounded-lg text-center text-xs font-bold ${todayOutAbnormal ? 'text-accent2 bg-accent2/10' : 'text-accent bg-accent/10'}`}>
                    OUT {todayOutDiff >= 0 ? '+' : ''}{todayOutDiff.toLocaleString()}
                  </div>
                )}
                {todayPayoutRate !== null && (
                  <div className={`py-1.5 rounded-lg text-center text-xs font-bold ${todayPayoutHigh || todayPayoutLow ? 'text-accent2 bg-accent2/10' : 'text-accent3 bg-accent3/10'}`}>
                    出率 {todayPayoutRate.toFixed(1)}%
                    {todayPayoutHigh && <div className="text-[10px]">⚠️高</div>}
                    {todayPayoutLow  && <div className="text-[10px]">⚠️低</div>}
                  </div>
                )}
              </div>
            )}

            <AnomalyBanner
              inAbnormal={todayInAbnormal} outAbnormal={todayOutAbnormal}
              inZero={todayInZero} inTriple={false}
              payoutHigh={todayPayoutHigh} payoutLow={todayPayoutLow}
            />

            {/* 月次統計 */}
            {monthlyStats && (monthlyStats.curr.revenue > 0 || monthlyStats.prev.revenue > 0) && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-surface rounded-lg border border-border text-xs flex-wrap">
                <span className="text-muted">今月</span>
                <span className="font-semibold text-accent3">¥{monthlyStats.curr.revenue.toLocaleString()}</span>
                {monthlyStats.curr.payoutRate != null && <span className="text-muted">出率{monthlyStats.curr.payoutRate}%</span>}
                <span className="text-border">|</span>
                <span className="text-muted">前月</span>
                <span className="text-muted">¥{monthlyStats.prev.revenue.toLocaleString()}</span>
                {monthlyStats.prev.payoutRate != null && <span className="text-muted">出率{monthlyStats.prev.payoutRate}%</span>}
              </div>
            )}

            {/* 景品名 */}
            <div>
              <div className="text-xs text-muted mb-1 px-0.5">
                景品名
                {!currentInp.today_prize_name && (currentInp.prize_name || latest?.prize_name) &&
                  <span className="text-[10px] text-amber-500 ml-1">空欄=前日付引継</span>}
              </div>
              <input className={inp + ' !text-left'} type="text"
                placeholder={currentInp.prize_name || latest?.prize_name || '景品名を入力'}
                value={currentInp.today_prize_name || ''}
                onChange={e => setInp('today_prize_name', e.target.value)} />
            </div>

            {/* 投入残 / 補充数 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted mb-1 px-0.5">景品投入残</div>
                <input className={inp} type="number" inputMode="numeric" placeholder="0"
                  value={currentInp.today_prize_stock || ''}
                  onChange={e => setInp('today_prize_stock', e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-muted mb-1 px-0.5">景品補充数</div>
                <input className={inp} type="number" inputMode="numeric" placeholder="0"
                  value={currentInp.today_prize_restock || ''}
                  onChange={e => setInp('today_prize_restock', e.target.value)} />
              </div>
            </div>

            {/* ACLRO設定値 */}
            <div>
              <div className="text-xs text-muted mb-1.5 px-0.5">⚙️ 設定値 (A/C/L/R/O)</div>
              <div className="flex gap-1.5">
                {SETTINGS_PREV.map(s => (
                  <div key={s.key} className="w-[36px] shrink-0" title={s.title}>
                    <div className="text-[9px] text-accent4 text-center font-bold leading-tight mb-0.5">
                      {s.label}<span className="block text-[6px] text-accent4/60 font-normal">{s.shortName}</span>
                    </div>
                    <input
                      className="w-full p-1 text-center rounded border border-border bg-surface2 text-text outline-none focus:border-accent4/60"
                      type={s.isText ? 'text' : 'number'}
                      inputMode={s.isText ? 'text' : 'numeric'}
                      placeholder={currentInp[s.key] || latest?.[s.key] || '-'}
                      value={currentInp[`today_${s.key}`] || ''}
                      onChange={e => setInp(`today_${s.key}`, e.target.value)}
                      title={s.title}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* メモ */}
            <div>
              <div className="text-xs text-muted mb-1 px-0.5">メモ</div>
              <textarea className={inp + ' !text-left resize-none'} rows={2}
                placeholder="特記事項があれば入力"
                value={currentInp.today_note || ''}
                onChange={e => setInp('today_note', e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* ━━━ フッター ━━━ */}
      <div className="shrink-0 px-3 pt-2 pb-4 border-t border-border bg-bg space-y-2">

        {/* 保存/送信ボタン（単独行 - 押し間違い防止） */}
        {allSaved ? (
          <button
            onClick={() => navigate('/drafts')}
            className="w-full py-3.5 rounded-xl bg-accent3 text-bg font-bold text-base active:scale-[0.98] transition-all">
            まとめて送信 ({savedCount}件) →
          </button>
        ) : isSaved ? (
          <button
            onClick={() => switchBooth('next')}
            className="w-full py-3.5 rounded-xl bg-surface2 border border-border text-accent3 font-bold active:scale-[0.98]">
            ✅ 保存済み — 次へ →
          </button>
        ) : (
          <button
            onClick={onSave}
            className="w-full py-3.5 rounded-xl bg-blue-600 active:bg-blue-700 text-white font-bold text-base active:scale-[0.98] transition-all">
            {label} を保存
          </button>
        )}

        {/* ブース切り替え（保存ボタンと別行） */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => switchBooth('prev')}
            disabled={currentIndex === 0}
            className="w-12 h-10 flex items-center justify-center rounded-xl border border-border text-muted text-xl disabled:opacity-25 active:bg-surface2 transition-all">
            ‹
          </button>
          <div className="flex-1 text-center text-xs text-muted">
            {currentIndex + 1} / {booths.length}
            {booths.length > 1 && <span className="ml-2 text-accent3">✓{savedCount}</span>}
            {draftCount > 0 && (
              <button onClick={() => navigate('/drafts')} className="ml-3 text-accent underline">
                下書き{draftCount}件
              </button>
            )}
          </div>
          <button
            onClick={() => switchBooth('next')}
            disabled={currentIndex === booths.length - 1}
            className="w-12 h-10 flex items-center justify-center rounded-xl border border-border text-muted text-xl disabled:opacity-25 active:bg-surface2 transition-all">
            ›
          </button>
        </div>
      </div>

      {/* OCRモーダル */}
      {showOcr && currentBooth && (
        <MeterOcr
          boothCode={currentBooth.booth_code}
          lastIn={lastIn} lastOut={lastOut}
          onApply={({ inMeter, outMeter, confidence }) => {
            const p = activeTab === 'today' ? 'today_' : ''
            setInp(p + 'in_meter', inMeter); setInp(p + 'out_meter', outMeter)
            setInp(p + 'inputMethod', 'ocr'); setInp(p + 'ocrConfidence', confidence)
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
