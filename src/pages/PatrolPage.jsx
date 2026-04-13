import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePatrolForm } from '../hooks/usePatrolForm'
import { useLockerState } from '../hooks/useLockerState'
import { getMachineLockers } from '../services/patrol'

import PatrolHeader    from '../components/patrol/PatrolHeader'
import PrevRow         from '../components/patrol/PrevRow'
import MeterInputRow   from '../components/patrol/MeterInputRow'
import CalcBar         from '../components/patrol/CalcBar'
import PrizeRow        from '../components/patrol/PrizeRow'
import SettingRow      from '../components/patrol/SettingRow'
import OutGroupRow     from '../components/patrol/OutGroupRow'
import LockerButton    from '../components/patrol/LockerButton'
import ChangeZoneHeader from '../components/patrol/ChangeZone'
import MonthlySummary  from '../components/patrol/MonthlySummary'
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
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)

  // ロッカー読み込み
  useEffect(() => {
    if (!booth?.machine_code) return
    getMachineLockers(booth.machine_code).then(list => {
      setLockers(list.map((l, i) => ({
        ...l,
        label: list.length > 1
          ? (i === 0 ? '▲ 上段' : '▼ 下段')
          : undefined,
      })))
    })
  }, [booth?.machine_code])

  const form = usePatrolForm(booth)
  const lockerState = useLockerState(lockers)

  // guard
  if (!booth) {
    navigate('/patrol', { replace: true })
    return null
  }

  if (form.loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a12', color: '#8888a8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '2px solid #f0c040', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 13 }}>読み込み中...</div>
        </div>
      </div>
    )
  }

  const { pattern, outCount, prev, hist, dateOpts, readDate, setReadDate,
    patrol, change,
    setPatrolIn, setPatrolOut, setPatrolZan, setPatrolSet,
    setChangeIn, setChangeOut, setChangeZan, setChangeSet,
    resetPatrol, resetChange,
    calc, changeCalc, changeType, machineInfo,
    save,
  } = form

  const today = new Date().toISOString().slice(0, 10)
  const changeDateLabel = today.slice(5).replace('-', '/')
  const outLabels = pattern === 'B' ? OUT_LABELS_B : OUT_LABELS_D2

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
      />
    )
  }

  const boothLabel = `B${String(booth.booth_number || '').padStart(2, '0')}`
  const hasLocker = machineInfo?.hasLocker && lockers.length > 0

  async function handleSave() {
    setSaveError(null)
    setSaving(true)
    const result = await save(staffId)
    setSaving(false)
    if (!result.ok) { setSaveError(result.message); return }
    setSaved(true)
    setTimeout(() => navigate('/patrol'), 800)
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
        const o0 = p.outs[0] || { meter:'', zan:'', ho:'ー', prize:'', cost:'' }
        const t0 = p.touchedOuts[0] || {}
        return (
          <>
            {/* IN + OUT + 残 + 補 */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
              <button onClick={() => {}} style={{ width: 38, height: 38, borderRadius: 6, background: '#5dade2', color: '#000', border: 'none', fontSize: 17, flexShrink: 0, cursor: 'pointer' }}>📷</button>
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

            {/* 差分バー */}
            <CalcBar
              inDiff={c?.inDiff} outDiff={c?.outs[0]?.diff}
              theoryZan={c?.outs[0]?.theory} rate={c?.inRate}
              onReset={resetPatrol} />

            {/* 景品 + @単価 (read-only) */}
            <PrizeRow prize={o0.prize} cost={o0.cost} prizeRO costRO />

            {/* 設定 A/C/L/R (read-only) + O (editable) */}
            <SettingRow
              setA={p.setA} setC={p.setC} setL={p.setL} setR={p.setR} setO={p.setO}
              readonly
              onSetO={v => setPatrolSet('O', v)} />
          </>
        )
      }

      // ── パターンB: バーバーカットOUT×3 ───────────────────────
      case 'B': {
        return (
          <>
            {/* IN行 */}
            <MeterInputRow
              inMeter={p.inMeter} inTouched={p.inTouched}
              inDiff={calc?.inDiff} showDiff
              onChange={setPatrolIn} onCamera={() => {}} />

            {/* OUT-A/B/C */}
            {p.outs.map((o, i) => (
              <OutGroupRow key={i} idx={i} label={outLabels[i]}
                out={o} touched={p.touchedOuts[i]}
                prevOut={i === 0 ? prev?.outMeter : i === 1 ? prev?.outMeter2 : prev?.outMeter3}
                outDiff={c?.outs[i]?.diff}
                readonly
                onMeter={v => setPatrolOut(i, 'meter', v)}
                onZan={v => setPatrolZan(i, v)}
                onHo={v => setPatrolOut(i, 'ho', v)} />
            ))}

            {/* O設定のみ */}
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
            {/* IN + OUT + 残 + 補 */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
              <button onClick={() => {}} style={{ width: 36, height: 36, borderRadius: 6, background: '#5dade2', color: '#000', border: 'none', fontSize: 16, flexShrink: 0, cursor: 'pointer' }}>📷</button>
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

            <CalcBar inDiff={c?.inDiff} outDiff={c?.outs[0]?.diff}
              theoryZan={c?.outs[0]?.theory} rate={c?.inRate}
              onReset={resetPatrol} />

            {/* 景品 + @単価 + O */}
            <PrizeRow prize={o0.prize} cost={o0.cost} setO={p.setO}
              prizeRO costRO showO
              onSetO={v => setPatrolSet('O', v)} />

            {/* ロッカーボタン (確認) */}
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
            {/* IN行 + diff */}
            <MeterInputRow
              inMeter={p.inMeter} inTouched={p.inTouched}
              inDiff={c?.inDiff} showDiff
              onChange={setPatrolIn} onCamera={() => {}} />

            {/* OUT-A(上段)/B(下段) */}
            {p.outs.map((o, i) => (
              <OutGroupRow key={i} idx={i} label={outLabels[i]}
                out={o} touched={p.touchedOuts[i]}
                prevOut={i === 0 ? prev?.outMeter : prev?.outMeter2}
                outDiff={c?.outs[i]?.diff}
                readonly
                onMeter={v => setPatrolOut(i, 'meter', v)}
                onZan={v => setPatrolZan(i, v)}
                onHo={v => setPatrolOut(i, 'ho', v)} />
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

  // ── 入替/設定変更ゾーン ────────────────────────────────────────
  function renderChangeContent() {
    if (!change) return null
    const ch = change
    const cc = changeCalc

    switch (pattern) {
      case 'A':
      case 'A0': {
        const o0 = ch.outs[0] || {}
        const t0 = ch.touchedOuts[0] || {}
        return (
          <>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: '#8888a8', width: 18, textAlign: 'center', flexShrink: 0 }}>IN</span>
                <input type="text" inputMode="numeric"
                  style={inp(ch.inTouched)} value={ch.inMeter}
                  onFocus={e => { if (!ch.inTouched) e.target.select() }}
                  onChange={e => setChangeIn(e.target.value)} />
              </div>
              {pattern !== 'A0' && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: '#8888a8', width: 20, textAlign: 'center', flexShrink: 0 }}>OUT</span>
                  <input type="text" inputMode="numeric"
                    style={inp(t0.meter)} value={o0.meter}
                    onFocus={e => { if (!t0.meter) e.target.select() }}
                    onChange={e => setChangeOut(0, 'meter', e.target.value)} />
                </div>
              )}
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 10, color: '#f0c040', fontWeight: 700 }}>残</span>
                <input type="text" inputMode="numeric" maxLength={4}
                  style={{ ...INP_BASE, width: 48, color: '#d0d0e0' }}
                  value={o0.zan}
                  onFocus={e => e.target.select()}
                  onChange={e => setChangeZan(0, e.target.value)} />
              </div>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 10, color: '#f0c040', fontWeight: 700 }}>補</span>
                <input type="text" inputMode="numeric" maxLength={4}
                  style={{ ...INP_BASE, width: 48, textAlign: 'center', color: '#d0d0e0' }}
                  value={o0.ho}
                  onFocus={e => e.target.select()}
                  onChange={e => setChangeOut(0, 'ho', e.target.value)} />
              </div>
            </div>

            <PrizeRow
              prize={o0.prize} cost={o0.cost}
              onPrize={v => setChangeOut(0, 'prize', v)}
              onCost={v => setChangeOut(0, 'cost', v)} />

            <SettingRow
              setA={ch.setA} setC={ch.setC} setL={ch.setL} setR={ch.setR} setO={ch.setO}
              onSetA={v => setChangeSet('A', v)} onSetC={v => setChangeSet('C', v)}
              onSetL={v => setChangeSet('L', v)} onSetR={v => setChangeSet('R', v)}
              onSetO={v => setChangeSet('O', v)} />

            {pattern === 'D1' && hasLocker && (
              <LockerButton variant="edit"
                total={lockerState.summary.total}
                emptyCount={lockerState.summary.empty}
                onClick={() => { lockerState.refresh(); setLockerView('edit') }} />
            )}
          </>
        )
      }

      case 'B':
      case 'D2': {
        return (
          <>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: '#8888a8', width: 18, textAlign: 'center', flexShrink: 0 }}>IN</span>
                <input type="text" inputMode="numeric"
                  style={inp(ch.inTouched)} value={ch.inMeter}
                  onFocus={e => { if (!ch.inTouched) e.target.select() }}
                  onChange={e => setChangeIn(e.target.value)} />
              </div>
            </div>
            {ch.outs.map((o, i) => (
              <OutGroupRow key={i} idx={i} label={outLabels[i]}
                out={o} touched={ch.touchedOuts[i]}
                prevOut={null}
                outDiff={cc?.[i]?.diff}
                onMeter={v => setChangeOut(i, 'meter', v)}
                onZan={v => setChangeZan(i, v)}
                onHo={v => setChangeOut(i, 'ho', v)}
                onPrize={v => setChangeOut(i, 'prize', v)}
                onCost={v => setChangeOut(i, 'cost', v)} />
            ))}
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#f0c040', fontWeight: 700, flexShrink: 0 }}>O</span>
              <input type="text"
                style={{ ...INP_BASE, flex: 1, textAlign: 'left', color: '#d0d0e0' }}
                value={ch.setO}
                onFocus={e => e.target.select()}
                onChange={e => setChangeSet('O', e.target.value)} />
            </div>
            {pattern === 'D2' && hasLocker && (
              <LockerButton variant="edit"
                total={lockerState.summary.total}
                emptyCount={lockerState.summary.empty}
                onClick={() => { lockerState.refresh(); setLockerView('edit') }} />
            )}
          </>
        )
      }

      case 'D1': {
        const o0 = ch.outs[0] || {}
        const t0 = ch.touchedOuts[0] || {}
        return (
          <>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: '#8888a8', width: 18, textAlign: 'center', flexShrink: 0 }}>IN</span>
                <input type="text" inputMode="numeric"
                  style={inp(ch.inTouched)} value={ch.inMeter}
                  onFocus={e => { if (!ch.inTouched) e.target.select() }}
                  onChange={e => setChangeIn(e.target.value)} />
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: '#8888a8', width: 20, textAlign: 'center', flexShrink: 0 }}>OUT</span>
                <input type="text" inputMode="numeric"
                  style={inp(t0.meter)} value={o0.meter}
                  onFocus={e => { if (!t0.meter) e.target.select() }}
                  onChange={e => setChangeOut(0, 'meter', e.target.value)} />
              </div>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 10, color: '#f0c040', fontWeight: 700 }}>残</span>
                <input type="text" inputMode="numeric" maxLength={4}
                  style={{ ...INP_BASE, width: 48, color: '#d0d0e0' }}
                  value={o0.zan}
                  onFocus={e => e.target.select()}
                  onChange={e => setChangeZan(0, e.target.value)} />
              </div>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 10, color: '#f0c040', fontWeight: 700 }}>補</span>
                <input type="text" inputMode="numeric" maxLength={4}
                  style={{ ...INP_BASE, width: 48, textAlign: 'center', color: '#d0d0e0' }}
                  value={o0.ho}
                  onFocus={e => e.target.select()}
                  onChange={e => setChangeOut(0, 'ho', e.target.value)} />
              </div>
            </div>
            <PrizeRow
              prize={o0.prize} cost={o0.cost} setO={ch.setO} showO
              onPrize={v => setChangeOut(0, 'prize', v)}
              onCost={v => setChangeOut(0, 'cost', v)}
              onSetO={v => setChangeSet('O', v)} />
            {hasLocker && (
              <LockerButton variant="edit"
                total={lockerState.summary.total}
                emptyCount={lockerState.summary.empty}
                onClick={() => { lockerState.refresh(); setLockerView('edit') }} />
            )}
          </>
        )
      }

      default: return null
    }
  }

  // ── メイン描画 ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a12', color: '#e8e8f0', padding: 10, fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif", maxWidth: 640, margin: '0 auto' }}>

      {/* ヘッダー */}
      <PatrolHeader
        dateOpts={dateOpts} readDate={readDate} onDateChange={setReadDate}
        machineName={machineInfo?.machineName || ''}
        boothLabel={boothLabel}
        badge={pattern === 'B' ? 'その他' : pattern.startsWith('D') ? 'ガチャ' : undefined}
      />

      {/* 巡回ゾーン */}
      <div style={ZONE}>
        {/* 前回値 */}
        <PrevRow prev={prev}
          outCount={outCount}
          outLabels={pattern === 'B' ? OUT_LABELS_B : pattern === 'D2' ? OUT_LABELS_D2 : null} />

        {/* パターン別入力 */}
        {renderPatrolContent()}

        {/* 入替/設定変更 区切り */}
        <ChangeZoneHeader
          changeDate={changeDateLabel}
          changeType={changeType}
          onReset={resetChange} />

        {/* 変更ゾーン内容 */}
        {renderChangeContent()}

        {/* 月次サマリー */}
        <MonthlySummary
          currRevenue={null}
          currRate={null}
          histRows={hist} />
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
          {saving ? '保存中...' : `${boothLabel} を保存`}
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
