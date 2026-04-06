import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { usePatrolInput, STATUS_OPTIONS } from '../hooks/usePatrolInput'
import LogoutButton from '../components/LogoutButton'
import ErrorDisplay from '../components/ErrorDisplay'
import AnomalyBanner from '../components/AnomalyBanner'
import PatrolConfirmModal from '../components/PatrolConfirmModal'

const SETTINGS = [
  { key: 'a', label: 'A', shortName: 'ｱｼｽﾄ', title: 'アシスト回数', isText: false },
  { key: 'c', label: 'C', shortName: 'ｷｬｯﾁ', title: 'キャッチ時パワー', isText: false },
  { key: 'l', label: 'L', shortName: 'ﾕﾙ',   title: '緩和時パワー',    isText: false },
  { key: 'r', label: 'R', shortName: 'ﾘﾀｰﾝ', title: '復帰時パワー',   isText: false },
  { key: 'o', label: 'O', shortName: 'ｿﾉ他', title: '固有設定',       isText: true  },
]

export default function PatrolInput() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const booth = state?.booth

  const {
    loading, saved, machineName, storeName,
    readDate, setReadDate,
    inMeter, setInMeter, outMeter, setOutMeter,
    latestIn, latestOut, inDiff, outDiff, inAbnormal, outAbnormal, price,
    inZero, inTriple, payoutRate, payoutHigh, payoutLow,
    latest, last,
    prizeRestock, setPrizeRestock, prizeStock, setPrizeStock, prizeName, setPrizeName,
    note, setNote, machineStatus, setMachineStatus,
    setA, setSetA, setC, setSetC, setL, setSetL, setR, setSetR, setO, setSetO,
    monthlyStats,
    handleSave,
  } = usePatrolInput(booth, () => navigate('/patrol'))

  const [error, setError] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  if (!booth) return null

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">前回データを取得しています...</p>
      </div>
    </div>
  )

  const hasAnomaly = inAbnormal || outAbnormal || inZero || inTriple || payoutHigh || payoutLow

  function onSave() {
    setError(null)
    if (!inMeter && latestIn === null) {
      setError({ message: 'INメーターを入力してください', type: 'validation' })
      return
    }
    setShowConfirmModal(true)
  }

  function doSave() {
    setShowConfirmModal(false)
    const result = handleSave()
    if (!result.ok) setError({ message: result.message, type: 'validation' })
  }

  const lastIn = last?.in_meter ? Number(last.in_meter) : null
  const inputCls = "w-full p-3 text-lg text-center rounded-lg border-2 border-border bg-surface2 text-text outline-none focus:border-accent"

  return (
    <div className="h-screen flex flex-col max-w-lg mx-auto">
      {/* ヘッダー */}
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/patrol')} className="text-2xl text-muted hover:text-accent transition-colors">←</button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-accent">{booth.booth_code}</h2>
            <p className="text-xs text-muted">{storeName && `${storeName} · `}{machineName}</p>
          </div>
          <LogoutButton />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-10">
      {error && <ErrorDisplay error={error.message} type={error.type} onDismiss={() => setError(null)} />}

      {/* 保存完了 */}
      {saved ? (
        <div className="bg-surface border border-border rounded-xl text-center p-8">
          <div className="text-5xl mb-3">✅</div>
          <h3 className="text-accent3 font-bold text-lg mb-2">下書き保存完了</h3>
          <p className="text-muted text-sm mb-6">{booth.full_booth_code} のデータを保存しました</p>
          <button onClick={() => navigate('/patrol')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors mb-2">
            次のブースをスキャン
          </button>
          <button onClick={() => navigate('/')}
            className="w-full bg-surface2 border border-border text-text font-medium py-3 rounded-xl">
            ホームに戻る
          </button>
        </div>
      ) : (
        <>
          {/* 入力日付 */}
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-surface rounded-lg border border-border">
            <span className="text-xs text-muted">入力日付</span>
            <input type="date" value={readDate} onChange={e => setReadDate(e.target.value)}
              className="flex-1 bg-surface2 border border-border text-text text-sm px-2 py-1 rounded-md [color-scheme:dark]" />
            {readDate !== new Date().toISOString().slice(0, 10) &&
              <span className="text-[10px] text-accent2 font-bold">過去日付</span>}
          </div>

          {/* 月次統計 */}
          {monthlyStats && (monthlyStats.curr.revenue > 0 || monthlyStats.prev.revenue > 0) && (
            <div className="flex items-center gap-3 px-3 py-2 mb-3 bg-surface rounded-lg border border-border text-xs">
              <span className="text-muted shrink-0">今月</span>
              <span className="font-semibold text-accent3">¥{monthlyStats.curr.revenue.toLocaleString()}</span>
              {monthlyStats.curr.payoutRate !== null &&
                <span className="text-muted">出率 {monthlyStats.curr.payoutRate}%</span>}
              <span className="text-border">|</span>
              <span className="text-muted shrink-0">前月</span>
              <span className="text-muted">¥{monthlyStats.prev.revenue.toLocaleString()}</span>
              {monthlyStats.prev.payoutRate !== null &&
                <span className="text-muted">出率 {monthlyStats.prev.payoutRate}%</span>}
            </div>
          )}

          {/* 機械状態 */}
          <div className="bg-surface border border-border rounded-xl p-3.5 mb-3">
            <div className="text-xs text-muted mb-2">機械状態</div>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_OPTIONS.map(s => (
                <button key={s.key} onClick={() => setMachineStatus(s.key)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold border-2 transition-all
                    ${machineStatus === s.key ? `${s.color} bg-surface3` : 'border-border text-muted bg-surface'}`}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4">
            {/* 前回値 */}
            {latest && (
              <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm">
                <div className="text-muted text-xs mb-1">前回値（最新）</div>
                <div>IN: <strong>{latestIn !== null ? latestIn.toLocaleString() : '-'}</strong>　OUT: <strong>{latestOut !== null ? latestOut.toLocaleString() : '-'}</strong></div>
                {latest.prize_name && <div className="mt-1">景品: {latest.prize_name}</div>}
                <div className="text-muted text-[11px] mt-1">{latest.read_time?.slice(0, 10)}</div>
              </div>
            )}
            {last && last !== latest && (
              <div className="bg-surface3 rounded-lg px-3 py-2 mb-4 text-xs text-accent">
                差分基準: IN {lastIn !== null ? lastIn.toLocaleString() : '-'} ({last.read_time?.slice(0, 10)})
              </div>
            )}
            {!last && (
              <div className="bg-accent/10 rounded-lg px-3 py-2 mb-4 text-xs text-accent">
                ⚠️ 差分計算できる過去データがありません
              </div>
            )}

            {/* IN / OUT 2カラム */}
            <div className="flex gap-2 mb-4">
              {/* IN */}
              <div className="flex-1">
                <div className="text-xs text-muted mb-1">
                  IN（売上）*
                  {!inMeter && latestIn !== null && <span className="text-[10px] text-amber-500 block leading-tight">前回値で保存</span>}
                </div>
                <input className={`${inputCls} ${inAbnormal ? '!border-accent2 !bg-accent2/10' : ''}`} type="number" inputMode="numeric"
                  placeholder={latestIn !== null ? String(latestIn) : '0000000'} value={inMeter} onChange={e => setInMeter(e.target.value)} />
                <div className="min-h-[40px] mt-1">
                  {inDiff !== null && (
                    <div className={`text-center text-sm font-bold py-1.5 rounded-lg ${inAbnormal || inZero || inTriple ? 'text-accent2 bg-accent2/10' : 'text-accent bg-accent/10'}`}>
                      {inDiff >= 0 ? '+' : ''}{inDiff.toLocaleString()}<br/>
                      <span className="text-xs">¥{(inDiff * price).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
              {/* OUT */}
              <div className="flex-1">
                <div className="text-xs text-muted mb-1">
                  OUT（払出）
                  {!outMeter && latestOut !== null && <span className="text-[10px] text-amber-500 block leading-tight">前回値で保存</span>}
                </div>
                <input className={`${inputCls} ${outAbnormal ? '!border-accent2 !bg-accent2/10' : ''}`} type="number" inputMode="numeric"
                  placeholder={latestOut !== null ? String(latestOut) : '0000000'} value={outMeter} onChange={e => setOutMeter(e.target.value)} />
                <div className="min-h-[40px] mt-1">
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
              <div className={`mb-4 text-center text-sm font-bold py-2 px-3 rounded-lg
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

            {/* 設定値 ACLRO */}
            <div className="mb-4">
              <div className="text-xs text-muted mb-2">設定値</div>
              <div className="flex gap-1.5">
                {SETTINGS.map(s => {
                  const vals = { a: setA, c: setC, l: setL, r: setR, o: setO }
                  const setters = { a: setSetA, c: setSetC, l: setSetL, r: setSetR, o: setSetO }
                  return (
                    <div key={s.key} className="flex-1" title={s.title}>
                      <div className="text-[9px] text-accent4 text-center font-bold leading-tight mb-0.5">
                        {s.label}<span className="text-[6px] text-accent4/60 block">{s.shortName}</span>
                      </div>
                      <input
                        className="w-full p-1.5 text-xs text-center rounded-lg border border-border bg-surface2 text-text outline-none focus:border-accent4/60"
                        type={s.isText ? 'text' : 'number'}
                        inputMode={s.isText ? 'text' : 'numeric'}
                        placeholder={latest?.[`set_${s.key}`] || '-'}
                        value={vals[s.key]}
                        onChange={e => setters[s.key](e.target.value)}
                        title={s.title}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 景品 */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <div className="text-xs text-muted mb-1">景品補充数</div>
                <input className={inputCls} type="number" inputMode="numeric" placeholder="0" value={prizeRestock} onChange={e => setPrizeRestock(e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-muted mb-1">景品投入残</div>
                <input className={inputCls} type="number" inputMode="numeric" placeholder="0" value={prizeStock} onChange={e => setPrizeStock(e.target.value)} />
              </div>
            </div>
            <div className="mb-4">
              <div className="text-xs text-muted mb-1">
                景品名
                {!prizeName && latest?.prize_name && <span className="text-[11px] text-amber-500 ml-1.5">※未入力時は前回値で保存</span>}
              </div>
              <input className={inputCls + ' !text-left !text-base'} type="text"
                placeholder={latest?.prize_name || '景品名を入力'} value={prizeName} onChange={e => setPrizeName(e.target.value)} />
            </div>

            {/* メモ */}
            <div className="mb-4">
              <div className="text-xs text-muted mb-1">メモ・備考</div>
              <textarea className={inputCls + ' !text-left !text-sm resize-y min-h-12'} rows={2}
                placeholder="特記事項があれば入力" value={note} onChange={e => setNote(e.target.value)} />
            </div>

            <button onClick={onSave}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors">
              下書き保存 → 次のスキャンへ
            </button>
          </div>
        </>
      )}
      </div>{/* スクロール領域終了 */}

      {showConfirmModal && (
        <PatrolConfirmModal
          boothCode={booth.full_booth_code}
          inDiff={inDiff} outDiff={outDiff} payoutRate={payoutRate} price={price}
          inAbnormal={inAbnormal} inZero={inZero} inTriple={inTriple}
          outAbnormal={outAbnormal} payoutHigh={payoutHigh} payoutLow={payoutLow}
          hasAnomaly={hasAnomaly}
          onSave={doSave} onClose={() => setShowConfirmModal(false)}
        />
      )}
    </div>
  )
}
