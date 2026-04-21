import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { detectAlerts } from '../../utils/patrolAlerts'
import { usePatrolForm } from '../../hooks/usePatrolForm'
import { useLockerState } from '../../hooks/useLockerState'
import { getMachineLockers } from '../../services/patrol'
import { getYesterdayPatrol, updatePatrolReading, saveReplaceReadingV2 } from '../../services/patrolV2'

import MeterOcr        from '../components/MeterOcr'
import PatrolHeader    from '../components/PatrolHeader'
import PrevRow         from '../components/PrevRow'
import MeterInputRow   from '../components/MeterInputRow'
import CalcBar         from '../components/CalcBar'
import AlertBar        from '../components/AlertBar'
import PrizeRow        from '../components/PrizeRow'
import SettingRow      from '../components/SettingRow'
import OutGroupRow     from '../components/OutGroupRow'
import LockerButton    from '../components/LockerButton'
import MonthlySummary  from '../components/MonthlySummary'
import LockerCheckPage from '../components/locker/LockerCheckPage'
import LockerEditPage  from '../components/locker/LockerEditPage'

// OUT ラベル設定
const OUT_LABELS_B  = ['A', 'B', 'C']
const OUT_LABELS_D2 = ['A(上段)', 'B(下段)']

// 入力スタイル (共通)
const INP_BASE = {
  fontSize: 16, background: '#222238', border: '1px solid #2a2a44',
  borderRadius: 4, padding: '0.4em 0.35em',
  fontFamily: "'Courier New', Courier, monospace", fontWeight: 'bold',
  outline: 'none', WebkitAppearance: 'none', textAlign: 'right', minWidth: 0,
}
const inp = (touched) => ({ ...INP_BASE, color: touched ? '#e8e8f0' : '#d0d0e0', flex: 1 })

// ゾーンカード
const ZONE = { background: '#12121e', border: '1px solid #2a2a44', borderRadius: 6, padding: 10, marginBottom: 8 }

export default function PatrolPage() {
  const { state } = useLocation()
  const navigate  = useNavigate()
  const { staffId } = useAuth()
  const booth = state?.booth

  const [lockers, setLockers] = useState([])
  const [lockerView, setLockerView] = useState(null) // null | 'check' | 'edit'
  const [showOcr, setShowOcr] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)

  // モード管理
  const [mode, setMode] = useState('loading') // 'loading' | 'new_patrol' | 'correction' | 'replace'
  const [dialogOpen, setDialogOpen] = useState(false)
  const [existingRecord, setExistingRecord] = useState(null)

  // スワイプナビゲーション
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const allBooths = useMemo(() => {
    const machines = state?.machines ?? []
    return machines.flatMap(m => m.booths.map(b => ({ machine: m, booth: b })))
  }, [state?.machines])
  const currentIdx = allBooths.findIndex(x => x.booth.booth_code === booth?.booth_code)

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function handleTouchEnd(e) {
    if (showOcr || lockerView) return
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    if (Math.abs(dx) < 60 || Math.abs(dx) <= Math.abs(dy)) return
    const nextIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1
    if (nextIdx < 0 || nextIdx >= allBooths.length) return
    const { machine, booth: nextBooth } = allBooths[nextIdx]
    navigate('/patrol/input', {
      replace: true,
      state: { ...state, machine, booth: nextBooth },
    })
  }

  // ロッカー読み込み
  useEffect(() => {
    if (!booth?.machine_code) return
    getMachineLockers(booth.machine_code).then(list => {
      setLockers(list.map((l, i) => ({
        ...l,
        posLabel: list.length >= 2 ? (i === 0 ? '上段' : '下段') : null,
      })))
    })
  }, [booth?.machine_code])

  const form = usePatrolForm(booth)
  const lockerState = useLockerState(lockers)

  // フォームロード完了後、前日patrolレコードを確認してモード決定
  useEffect(() => {
    if (form.loading) {
      // ブース変更時にモードをリセット
      setMode('loading')
      setDialogOpen(false)
      setExistingRecord(null)
      return
    }
    if (!booth?.booth_code) return
    getYesterdayPatrol(booth.booth_code).then(record => {
      if (record) {
        setExistingRecord(record)
        setDialogOpen(true)
        setMode('choosing')
      } else {
        setMode('new_patrol')
      }
    })
  }, [form.loading, booth?.booth_code]) // eslint-disable-line react-hooks/exhaustive-deps

  // ダイアログハンドラ
  function handleSelectCorrection() {
    form.loadCorrectionData(existingRecord)
    setMode('correction')
    setDialogOpen(false)
  }
  function handleSelectReplace() {
    form.loadReplaceData(existingRecord)
    setMode('replace')
    setDialogOpen(false)
  }
  function handleCancelDialog() {
    setDialogOpen(false)
    navigate(-1)
  }

  // Hooks must be before any early returns
  const { currRevenue, currRate } = useMemo(() => {
    const hist = form.hist
    if (!hist || hist.length === 0) return { currRevenue: null, currRate: null }
    const totalIn = hist.reduce((s, r) => s + (r.in_diff ?? 0), 0)
    const totalOut = hist.reduce((s, r) => s + (r.out_diff_1 ?? 0), 0)
    return {
      currRevenue: hist.reduce((s, r) => s + (r.revenue ?? (r.in_diff ?? 0) * (r.play_price || 100)), 0),
      currRate: totalIn > 0 ? (totalOut / totalIn * 100) : null,
    }
  }, [form.hist])

  const alerts = useMemo(() => detectAlerts(form.calc, form.outCount), [form.calc, form.outCount])

  // guard
  if (!booth) {
    navigate('/patrol', { replace: true })
    return null
  }

  if (form.loading || mode === 'loading') {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a12', color: '#8888a8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '2px solid #f0c040', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 13 }}>読み込み中...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const { pattern, outCount, prev, hist, readDate, setReadDate,
    patrol,
    setPatrolIn, setPatrolOut, setPatrolZan, setPatrolSet,
    resetPatrol,
    calc, machineInfo,
    save,
  } = form

  const outLabels = pattern === 'B' ? OUT_LABELS_B : OUT_LABELS_D2
  const boothLabel = `B${String(booth.booth_number || '').padStart(2, '0')}`
  const hasLocker = lockers.length > 0
  const dateLocked = mode === 'correction' || mode === 'replace'
  const isReplace = mode === 'replace'

  // ロッカービュー
  if (lockerView === 'check') {
    return (
      <LockerCheckPage
        machineName={`${machineInfo?.machineName || ''} / B${String(booth.booth_number || '').padStart(2,'0')}`}
        lockers={lockers}
        slotsByLocker={lockerState.slotsByLocker}
        onBack={() => { lockerState.refresh(); setLockerView(null) }}
        onWon={(id) => lockerState.wonSlot(id, staffId)}
      />
    )
  }
  if (lockerView === 'edit') {
    return (
      <LockerEditPage
        machineName={`${machineInfo?.machineName || ''} / B${String(booth.booth_number || '').padStart(2,'0')}`}
        lockers={lockers}
        slotsByLocker={lockerState.slotsByLocker}
        onBack={() => { lockerState.refresh(); setLockerView(null) }}
        onWon={(id) => lockerState.wonSlot(id, staffId)}
        onFill={(id, data) => lockerState.fillSlot(id, data, staffId)}
        onRemove={(id) => lockerState.removeSlot(id, staffId)}
        onSwap={(id, data) => lockerState.swapSlot(id, data, staffId)}
      />
    )
  }

  function handleOcrApply({ inMeter, outMeter }) {
    if (inMeter) setPatrolIn(inMeter)
    if (outMeter) setPatrolOut(0, 'meter', outMeter)
    setShowOcr(false)
  }

  async function handleSave() {
    setSaveError(null)
    setSaving(true)
    try {
      if (mode === 'correction') {
        await updatePatrolReading({
          readingId: existingRecord.reading_id,
          formData: patrol,
          outCount,
          staffId,
          existingRecord,
        })
      } else if (mode === 'replace') {
        await saveReplaceReadingV2({
          boothCode: booth.booth_code,
          formData: patrol,
          outCount,
          staffId,
          relatedRecord: existingRecord,
        })
      } else {
        // new_patrol
        const result = await save(staffId)
        if (!result.ok) {
          setSaveError(result.message)
          setSaving(false)
          return
        }
      }
      setSaved(true)
      setTimeout(() => navigate('/'), 800)
    } catch (e) {
      setSaveError(e.message)
      setSaving(false)
    }
  }

  // ─── パターン別レンダリング ──────────────────────────────────
  function renderPatrolContent() {
    if (!patrol) return null
    const p = patrol
    const c = calc

    switch (pattern) {

      // ── パターンA: クレーン基本形 ──────────────────────────────
      case 'A':
      case 'A0': {
        if (outCount >= 2) {
          const displayCount = Math.min(outCount, 3)
          const prevOuts = [prev?.outMeter, prev?.outMeter2, prev?.outMeter3]
          return (
            <>
              <MeterInputRow
                inMeter={p.inMeter} inTouched={p.inTouched}
                inDiff={c?.inDiff} showDiff={mode === 'new_patrol'}
                onChange={setPatrolIn} onCamera={mode !== 'correction' ? () => setShowOcr(true) : undefined} />
              {p.outs.slice(0, displayCount).map((o, i) => (
                <OutGroupRow key={i} idx={i} label={OUT_LABELS_B[i]}
                  out={o} touched={p.touchedOuts[i]}
                  prevOut={prevOuts[i]}
                  outDiff={c?.outs[i]?.diff}
                  readonly={!isReplace}
                  onMeter={v => setPatrolOut(i, 'meter', v)}
                  onZan={v => setPatrolZan(i, v)}
                  onHo={v => setPatrolOut(i, 'ho', v)}
                  onPrize={isReplace ? v => setPatrolOut(i, 'prize', v) : undefined}
                  onCost={isReplace ? v => setPatrolOut(i, 'cost', v) : undefined} />
              ))}
              <SettingRow
                setA={p.setA} setC={p.setC} setL={p.setL} setR={p.setR} setO={p.setO}
                readonly={!isReplace}
                onSetA={isReplace ? v => setPatrolSet('A', v) : undefined}
                onSetC={isReplace ? v => setPatrolSet('C', v) : undefined}
                onSetL={isReplace ? v => setPatrolSet('L', v) : undefined}
                onSetR={isReplace ? v => setPatrolSet('R', v) : undefined}
                onSetO={v => setPatrolSet('O', v)} />
            </>
          )
        }
        const o0 = p.outs[0] || { meter:'', zan:'', ho:'ー', prize:'', cost:'' }
        const t0 = p.touchedOuts[0] || {}
        return (
          <>
            {/* IN + OUT + 残 + 補 */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
              {mode !== 'correction' && (
                <button onClick={() => setShowOcr(true)} style={{ width: 38, height: 38, borderRadius: 6, background: '#5dade2', color: '#000', border: 'none', fontSize: 17, flexShrink: 0, cursor: 'pointer' }}>📷</button>
              )}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: '#8888a8', width: 18, textAlign: 'center', flexShrink: 0 }}>IN</span>
                <input type="text" inputMode="numeric"
                  style={inp(p.inTouched)}
                  value={p.inMeter}
                  onFocus={e => { if (!p.inTouched) e.target.select() }}
                  onChange={e => setPatrolIn(e.target.value)} />
              </div>
              {pattern !== 'A0' && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: '#8888a8', width: 20, textAlign: 'center', flexShrink: 0 }}>OUT</span>
                  <input type="text" inputMode="numeric"
                    style={inp(t0.meter)}
                    value={o0.meter}
                    onFocus={e => { if (!t0.meter) e.target.select() }}
                    onChange={e => setPatrolOut(0, 'meter', e.target.value)} />
                </div>
              )}
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 10, color: '#f0c040', fontWeight: 700 }}>残</span>
                <input type="text" inputMode="numeric" maxLength={4}
                  style={{ ...INP_BASE, width: 48, color: '#d0d0e0' }}
                  value={o0.zan}
                  onFocus={e => e.target.select()}
                  onChange={e => setPatrolZan(0, e.target.value)} />
              </div>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 10, color: '#f0c040', fontWeight: 700 }}>補</span>
                <input type="text" inputMode="numeric" maxLength={4}
                  style={{ ...INP_BASE, width: 48, color: '#d0d0e0' }}
                  value={o0.ho}
                  onFocus={e => e.target.select()}
                  onChange={e => setPatrolOut(0, 'ho', e.target.value)} />
              </div>
            </div>

            {/* 差分バー（新規巡回のみ） */}
            {mode === 'new_patrol' && (
              <CalcBar
                inDiff={c?.inDiff} outDiff={c?.outs[0]?.diff}
                theoryZan={c?.outs[0]?.theory} rate={c?.inRate}
                onReset={resetPatrol} />
            )}

            {/* 景品 + @単価 */}
            <PrizeRow
              prize={o0.prize} cost={o0.cost}
              prizeRO={!isReplace} costRO={!isReplace}
              onPrize={isReplace ? v => setPatrolOut(0, 'prize', v) : undefined}
              onCost={isReplace ? v => setPatrolOut(0, 'cost', v) : undefined} />

            {/* 設定 A/C/L/R (入替時のみ編集可) + O (常時編集可) */}
            <SettingRow
              setA={p.setA} setC={p.setC} setL={p.setL} setR={p.setR} setO={p.setO}
              readonly={!isReplace}
              onSetA={isReplace ? v => setPatrolSet('A', v) : undefined}
              onSetC={isReplace ? v => setPatrolSet('C', v) : undefined}
              onSetL={isReplace ? v => setPatrolSet('L', v) : undefined}
              onSetR={isReplace ? v => setPatrolSet('R', v) : undefined}
              onSetO={v => setPatrolSet('O', v)} />
          </>
        )
      }

      // ── パターンB: バーバーカットOUT×3 ───────────────────────
      case 'B': {
        return (
          <>
            <MeterInputRow
              inMeter={p.inMeter} inTouched={p.inTouched}
              inDiff={calc?.inDiff} showDiff={mode === 'new_patrol'}
              onChange={setPatrolIn} onCamera={mode !== 'correction' ? () => setShowOcr(true) : undefined} />

            {p.outs.map((o, i) => (
              <OutGroupRow key={i} idx={i} label={outLabels[i]}
                out={o} touched={p.touchedOuts[i]}
                prevOut={i === 0 ? prev?.outMeter : i === 1 ? prev?.outMeter2 : prev?.outMeter3}
                outDiff={c?.outs[i]?.diff}
                readonly={!isReplace}
                onMeter={v => setPatrolOut(i, 'meter', v)}
                onZan={v => setPatrolZan(i, v)}
                onHo={v => setPatrolOut(i, 'ho', v)}
                onPrize={isReplace ? v => setPatrolOut(i, 'prize', v) : undefined}
                onCost={isReplace ? v => setPatrolOut(i, 'cost', v) : undefined} />
            ))}

            <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#f0c040', fontWeight: 700, flexShrink: 0 }}>O</span>
              <input type="text"
                style={{ ...INP_BASE, flex: 1, textAlign: 'left', color: '#d0d0e0' }}
                value={p.setO} placeholder="設定メモ"
                onFocus={e => e.target.select()}
                onChange={e => setPatrolSet('O', e.target.value)} />
            </div>
          </>
        )
      }

      // ── パターンD1: ガチャ (単OUT + ロッカー) ─────────────────
      case 'D1': {
        const o0 = p.outs[0] || {}
        const t0 = p.touchedOuts[0] || {}
        return (
          <>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
              {mode !== 'correction' && (
                <button onClick={() => setShowOcr(true)} style={{ width: 36, height: 36, borderRadius: 6, background: '#5dade2', color: '#000', border: 'none', fontSize: 16, flexShrink: 0, cursor: 'pointer' }}>📷</button>
              )}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: '#8888a8', width: 18, textAlign: 'center', flexShrink: 0 }}>IN</span>
                <input type="text" inputMode="numeric"
                  style={inp(p.inTouched)} value={p.inMeter}
                  onFocus={e => { if (!p.inTouched) e.target.select() }}
                  onChange={e => setPatrolIn(e.target.value)} />
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: '#8888a8', width: 20, textAlign: 'center', flexShrink: 0 }}>OUT</span>
                <input type="text" inputMode="numeric"
                  style={inp(t0.meter)} value={o0.meter}
                  onFocus={e => { if (!t0.meter) e.target.select() }}
                  onChange={e => setPatrolOut(0, 'meter', e.target.value)} />
              </div>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 10, color: '#f0c040', fontWeight: 700 }}>残</span>
                <input type="text" inputMode="numeric" maxLength={4}
                  style={{ ...INP_BASE, width: 48, color: '#d0d0e0' }}
                  value={o0.zan}
                  onFocus={e => e.target.select()}
                  onChange={e => setPatrolZan(0, e.target.value)} />
              </div>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 10, color: '#f0c040', fontWeight: 700 }}>補</span>
                <input type="text" inputMode="numeric" maxLength={4}
                  style={{ ...INP_BASE, width: 48, color: '#d0d0e0' }}
                  value={o0.ho}
                  onFocus={e => e.target.select()}
                  onChange={e => setPatrolOut(0, 'ho', e.target.value)} />
              </div>
            </div>

            {mode === 'new_patrol' && (
              <CalcBar inDiff={c?.inDiff} outDiff={c?.outs[0]?.diff}
                theoryZan={c?.outs[0]?.theory} rate={c?.inRate}
                onReset={resetPatrol} />
            )}

            <PrizeRow
              prize={o0.prize} cost={o0.cost} setO={p.setO}
              showO
              prizeRO={!isReplace} costRO={!isReplace}
              onPrize={isReplace ? v => setPatrolOut(0, 'prize', v) : undefined}
              onCost={isReplace ? v => setPatrolOut(0, 'cost', v) : undefined}
              onSetO={v => setPatrolSet('O', v)} />

            {hasLocker && (
              <LockerButton variant="check"
                total={lockerState.summary.total}
                emptyCount={lockerState.summary.empty}
                onClick={() => { lockerState.refresh(); setLockerView('check') }} />
            )}
          </>
        )
      }

      // ── パターンD2: ガチャ (2OUT + 上下ロッカー) ──────────────
      case 'D2': {
        return (
          <>
            <MeterInputRow
              inMeter={p.inMeter} inTouched={p.inTouched}
              inDiff={c?.inDiff} showDiff={mode === 'new_patrol'}
              onChange={setPatrolIn} onCamera={mode !== 'correction' ? () => setShowOcr(true) : undefined} />

            {p.outs.map((o, i) => (
              <OutGroupRow key={i} idx={i} label={outLabels[i]}
                out={o} touched={p.touchedOuts[i]}
                prevOut={i === 0 ? prev?.outMeter : prev?.outMeter2}
                outDiff={c?.outs[i]?.diff}
                onMeter={v => setPatrolOut(i, 'meter', v)}
                onZan={v => setPatrolZan(i, v)}
                onHo={v => setPatrolOut(i, 'ho', v)}
                onPrize={v => setPatrolOut(i, 'prize', v)}
                onCost={v => setPatrolOut(i, 'cost', v)} />
            ))}

            <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#f0c040', fontWeight: 700, flexShrink: 0 }}>O</span>
              <input type="text" maxLength={6}
                style={{ ...INP_BASE, flex: 1, textAlign: 'left', color: '#d0d0e0' }}
                value={p.setO} placeholder="設定"
                onFocus={e => e.target.select()}
                onChange={e => setPatrolSet('O', e.target.value)} />
            </div>

            {hasLocker && (
              <LockerButton variant="check"
                total={lockerState.summary.total}
                emptyCount={lockerState.summary.empty}
                onClick={() => { lockerState.refresh(); setLockerView('check') }} />
            )}
          </>
        )
      }

      default: return null
    }
  }

  // 保存ボタンラベル
  const saveLabel = mode === 'correction' ? '修正を保存'
    : mode === 'replace' ? '入替として保存'
    : `${boothLabel} を保存`

  // ── メイン描画 ─────────────────────────────────────────────────
  return (
    <div
      style={{ height: '100dvh', overflowY: 'auto', background: '#0a0a12', color: '#e8e8f0', padding: 10, fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif", maxWidth: 640, margin: '0 auto' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      {/* ヘッダー */}
      <PatrolHeader
        readDate={readDate} onDateChange={setReadDate}
        machineName={machineInfo?.machineName || ''}
        boothLabel={boothLabel}
        badge={machineInfo?.category === 'gacha' ? 'ガチャ' : machineInfo?.category === 'other' ? 'その他' : undefined}
        playPrice={machineInfo?.playPrice}
        onBack={() => navigate('/')}
        dateLocked={dateLocked}
      />

      {/* モードバッジ（修正・入替時のみ） */}
      {dateLocked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 8, borderRadius: 6, background: '#1a1a2e', border: '1px solid #2a2a44' }}>
          {mode === 'correction' && <span style={{ fontWeight: 700, fontSize: 13, color: '#f0a040' }}>✏️ 修正モード</span>}
          {mode === 'replace' && <span style={{ fontWeight: 700, fontSize: 13, color: '#5dade2' }}>🔄 入替変更モード</span>}
          <span style={{ fontSize: 11, color: '#8888a8' }}>日付: {readDate} 🔒</span>
        </div>
      )}

      {/* 新規巡回バッジ */}
      {mode === 'new_patrol' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', marginBottom: 8, borderRadius: 6, background: '#0d1f0d', border: '1px solid rgba(46,204,113,.25)' }}>
          <span style={{ fontWeight: 700, fontSize: 12, color: '#2ecc71' }}>🆕 新規巡回入力</span>
        </div>
      )}

      {/* 巡回ゾーン */}
      <div style={ZONE}>
        {/* 前回値（新規巡回のみ） */}
        {mode === 'new_patrol' && (
          <PrevRow prev={prev}
            outCount={outCount}
            outLabels={pattern === 'B' ? OUT_LABELS_B : pattern === 'D2' ? OUT_LABELS_D2 : null} />
        )}

        {/* パターン別入力 */}
        {renderPatrolContent()}

        {/* 異常値アラート（新規巡回のみ） */}
        {mode === 'new_patrol' && <AlertBar alerts={alerts} />}

        {/* 月次サマリー（新規巡回のみ） */}
        {mode === 'new_patrol' && (
          <MonthlySummary
            currRevenue={currRevenue}
            currRate={currRate}
            histRows={hist} />
        )}
      </div>

      {/* エラー */}
      {saveError && (
        <div style={{ margin: '0 0 8px', padding: '8px 12px', background: 'rgba(255,107,107,.12)', border: '1px solid #ff6b6b', borderRadius: 6, fontSize: 13, color: '#ff6b6b' }}>
          {saveError}
        </div>
      )}

      {/* 保存ボタン */}
      {saved ? (
        <div style={{ padding: '14px', borderRadius: 10, background: '#1a1a2e', border: '1px solid #2ecc71', textAlign: 'center', color: '#2ecc71', fontWeight: 700, fontSize: 15 }}>
          ✅ 保存しました
        </div>
      ) : (
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ width: '100%', padding: '14px', borderRadius: 10, background: saving ? '#1a1a2e' : '#5dade2', color: saving ? '#8888a8' : '#000', border: 'none', fontWeight: 700, fontSize: 15, cursor: saving ? 'default' : 'pointer', marginBottom: 24 }}
        >
          {saving ? '保存中...' : saveLabel}
        </button>
      )}

      {showOcr && (
        <MeterOcr
          boothCode={booth.booth_code}
          lastIn={prev?.inMeter != null ? Number(prev.inMeter) : null}
          lastOut={prev?.outMeter != null ? Number(prev.outMeter) : null}
          onApply={handleOcrApply}
          onClose={() => setShowOcr(false)}
        />
      )}

      {/* モード選択ダイアログ */}
      {dialogOpen && existingRecord && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#1a1a2e', border: '1px solid #2a2a44', borderRadius: 12, padding: 20, maxWidth: 360, width: '100%' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f0', marginBottom: 6 }}>ℹ️ 既に保存済みのブースです</div>
              <div style={{ fontSize: 13, color: '#8888a8' }}>
                {machineInfo?.machineName} / {boothLabel}<br/>
                {existingRecord.patrol_date} に入力済み
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={handleSelectCorrection}
                style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(240,160,64,.15)', border: '1px solid rgba(240,160,64,.4)', color: '#f0a040', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
              >
                ✏️ 修正する<br/>
                <span style={{ fontSize: 12, fontWeight: 400, color: '#8888a8' }}>
                  {existingRecord.patrol_date} のデータを上書き
                </span>
              </button>
              <button
                onClick={handleSelectReplace}
                style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(93,173,226,.15)', border: '1px solid rgba(93,173,226,.4)', color: '#5dade2', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
              >
                🔄 入替変更として記録<br/>
                <span style={{ fontSize: 12, fontWeight: 400, color: '#8888a8' }}>
                  今日 {new Date().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} の日付で新規記録
                </span>
              </button>
              <button
                onClick={handleCancelDialog}
                style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(136,136,168,.1)', border: '1px solid rgba(136,136,168,.3)', color: '#8888a8', fontSize: 14, cursor: 'pointer' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
