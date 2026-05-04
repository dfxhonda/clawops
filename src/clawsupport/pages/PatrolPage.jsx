import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { detectAlerts } from '../../utils/patrolAlerts'
import { usePatrolForm } from '../../hooks/usePatrolForm'
import { useLockerState } from '../../hooks/useLockerState'
import { getYesterdayPatrol, updatePatrolReading, saveReplaceReadingV2, getReadingBefore } from '../../services/patrolV2'

import Term    from '../../components/Term'
import HelpFAB from '../../components/HelpFAB'

import OcrCaptureScreen from '../components/OcrCaptureScreen'
import NativeCamera from '../components/NativeCamera'

const USE_NEW_CAMERA = import.meta.env.VITE_USE_NEW_CAMERA !== 'false'
import PatrolHeader    from '../components/PatrolHeader'
import PrevRow         from '../components/PrevRow'
import MeterInputRow   from '../components/MeterInputRow'
import CalcBar         from '../components/CalcBar'
import AlertBar        from '../components/AlertBar'
import PrizeRow        from '../components/PrizeRow'
import SettingRow      from '../components/SettingRow'
import OutGroupRow     from '../components/OutGroupRow'
import LockerButton    from '../components/LockerButton'
import LockerCheckPage from '../components/locker/LockerCheckPage'
import LockerEditPage  from '../components/locker/LockerEditPage'
import GachaOutCard      from '../components/GachaOutCard'
import GachaCheckBar     from '../components/GachaCheckBar'
import GachaInputV3      from '../components/GachaInputV3'
import NumpadField       from '../components/NumpadField'
import BoothHistoryTable from '../components/BoothHistoryTable'

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
  const machine = state?.machine

  const [lockers, setLockers] = useState(() => {
    const list = (machine?.machine_lockers || []).filter(l => l.is_active !== false)
    return list.map((l, i) => ({
      ...l,
      posLabel: list.length >= 2 ? (i === 0 ? '上段' : '下段') : null,
    }))
  })
  const [lockerView, setLockerView] = useState(null) // null | 'check' | 'edit'
  const [showOcr, setShowOcr] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [croppedPhotoUrl, setCroppedPhotoUrl] = useState(null)
  const nativeCamRef = useRef(null)
  const onCamera = useCallback(() => {
    if (USE_NEW_CAMERA) { nativeCamRef.current?.trigger() } else { setShowOcr(true) }
  }, [])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)

  // モード管理
  const [mode, setMode] = useState('loading') // 'loading' | 'new_patrol' | 'correction' | 'replace'
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

  const form = usePatrolForm(booth, machine)
  const lockerState = useLockerState(lockers)

  // フォームロード完了後、最新レコードを確認してモード決定
  // getLatestReading の代わりに usePatrolForm から返る prevRecord（_raw）を使ってクエリを1本削減
  useEffect(() => {
    if (form.loading) {
      setMode('loading')
      setExistingRecord(null)
      return
    }
    if (!booth?.booth_code) return
    const record = form.prevRecord
    // 今日(JST)の created_at または updated_at があるレコードのみ修正モードに入る
    const todayJST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
    const isToday = r => {
      if (!r) return false
      const ca = r.created_at ? new Date(r.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) : null
      const ua = r.updated_at ? new Date(r.updated_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) : null
      return ca === todayJST || ua === todayJST
    }
    ;(async () => {
      if (record && isToday(record)) {
        setExistingRecord(record)
        form.loadCorrectionData(record)
        setMode('correction')
        const prevRecord = await getReadingBefore(booth.booth_code, record.reading_id)
        form.setPrevOverride(prevRecord)
      } else {
        setMode('new_patrol')
      }
    })()
  }, [form.loading, booth?.booth_code]) // eslint-disable-line react-hooks/exhaustive-deps

  // 入替変更モードへの切り替え（修正モードヘッダーから呼ぶ）
  async function handleSwitchToReplace() {
    if (!existingRecord) return
    form.loadReplaceData(existingRecord)
    setMode('replace')
    const prevRecord = await getReadingBefore(booth.booth_code, existingRecord.reading_id)
    form.setPrevOverride(prevRecord)
  }

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

  const { pattern, outCount, prev, readDate, setReadDate,
    patrol,
    setPatrolIn, setPatrolOut, setPatrolZan, setPatrolSet,
    resetPatrol,
    resetPatrolInMeter, resetPatrolOutMeter,
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

  function handleOcrApply({ inMeter, outMeter, outMeter2, photoUrl: pUrl, croppedPhotoUrl: cUrl } = {}) {
    if (inMeter) setPatrolIn(inMeter)
    if (outMeter) setPatrolOut(0, 'meter', outMeter)
    if (outMeter2) setPatrolOut(1, 'meter', outMeter2)
    if (pUrl) setPhotoUrl(pUrl)
    if (cUrl) setCroppedPhotoUrl(cUrl)
    setShowOcr(false)
  }

  function handleNativeCameraResult({ extractedNumber, photoUrl: pUrl, croppedPhotoUrl: cUrl }) {
    if (extractedNumber !== null && extractedNumber !== undefined) setPatrolIn(String(extractedNumber))
    if (pUrl) setPhotoUrl(pUrl)
    if (cUrl) setCroppedPhotoUrl(cUrl)
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
        const result = await save(staffId, { photoUrl, croppedPhotoUrl })
        if (!result.ok) {
          setSaveError(result.message)
          setSaving(false)
          return
        }
      }
      setSaving(false)
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        // 次ブースへ遷移、最後のブースなら巡回一覧に戻る
        const nextIdx = currentIdx + 1
        if (nextIdx < allBooths.length) {
          const { machine: nm, booth: nb } = allBooths[nextIdx]
          navigate('/patrol/input', { state: { ...state, machine: nm, booth: nb } })
        } else {
          const overviewPath = state?.storeCode
            ? `/clawsupport/store/${state.storeCode}/patrol`
            : '/clawsupport'
          navigate(overviewPath)
        }
      }, 800)
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
                inDiff={c?.inDiff} showDiff={true}
                onChange={setPatrolIn} onCamera={onCamera} />
              {p.outs.slice(0, displayCount).map((o, i) => (
                <OutGroupRow key={i} idx={i} label={OUT_LABELS_B[i]}
                  out={o} touched={p.touchedOuts[i]}
                  prevOut={prevOuts[i]}
                  outDiff={c?.outs[i]?.diff}
                  onMeter={v => setPatrolOut(i, 'meter', v)}
                  onZan={v => setPatrolZan(i, v)}
                  onHo={v => setPatrolOut(i, 'ho', v)}
                  onPrize={v => setPatrolOut(i, 'prize', v)}
                  onCost={v => setPatrolOut(i, 'cost', v)} />
              ))}
              <SettingRow
                setA={p.setA} setC={p.setC} setL={p.setL} setR={p.setR} setO={p.setO}
                onSetA={v => setPatrolSet('A', v)}
                onSetC={v => setPatrolSet('C', v)}
                onSetL={v => setPatrolSet('L', v)}
                onSetR={v => setPatrolSet('R', v)}
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
              <button onClick={onCamera} style={{ width: 38, height: 38, borderRadius: 6, background: '#5dade2', color: '#000', border: 'none', fontSize: 17, flexShrink: 0, cursor: 'pointer' }}>📷</button>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Term id="in" style={{ fontSize: 10, color: '#8888a8', width: 18, textAlign: 'center', flexShrink: 0 }}>IN</Term>
                  <NumpadField
                    value={p.inMeter}
                    onChange={setPatrolIn}
                    label="INメーター"
                    max={999999}
                    style={inp(p.inTouched)}
                  />
                </div>
                <div style={{ fontSize: 10, color: '#8888a8', paddingLeft: 4, marginTop: 2 }}>
                  前回 {prev?.inMeter != null ? Number(prev.inMeter).toLocaleString() : '—'}
                </div>
              </div>
              {pattern !== 'A0' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Term id="out" style={{ fontSize: 10, color: '#8888a8', width: 20, textAlign: 'center', flexShrink: 0 }}>OUT</Term>
                    <NumpadField
                      value={o0.meter}
                      onChange={v => setPatrolOut(0, 'meter', v)}
                      label="OUTメーター"
                      max={999999}
                      style={inp(t0.meter)}
                    />
                  </div>
                  <div style={{ fontSize: 10, color: '#8888a8', paddingLeft: 4, marginTop: 2 }}>
                    前回 {prev?.outMeter != null ? Number(prev.outMeter).toLocaleString() : '—'}
                  </div>
                </div>
              )}
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Term id="residual" style={{ fontSize: 10, color: '#f0c040', fontWeight: 700 }}>残</Term>
                <NumpadField
                  value={o0.zan}
                  onChange={v => setPatrolZan(0, v)}
                  label="残"
                  max={9999}
                  style={{ ...INP_BASE, width: 48, color: '#d0d0e0', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Term id="refill" style={{ fontSize: 10, color: '#f0c040', fontWeight: 700 }}>補</Term>
                <NumpadField
                  value={o0.ho}
                  onChange={v => setPatrolOut(0, 'ho', v)}
                  label="補充数"
                  max={9999}
                  style={{ ...INP_BASE, width: 48, color: '#d0d0e0', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* 差分バー */}
            <CalcBar
              inDiff={c?.inDiff} outDiff={c?.outs[0]?.diff}
              theoryZan={c?.outs[0]?.theory} rate={c?.inRate}
              onReset={resetPatrol} />

            {/* 景品 + @単価 */}
            <PrizeRow
              prize={o0.prize} cost={o0.cost}
              onPrize={v => setPatrolOut(0, 'prize', v)}
              onCost={v => setPatrolOut(0, 'cost', v)} />

            {/* 設定 A/C/L/R/O */}
            <SettingRow
              setA={p.setA} setC={p.setC} setL={p.setL} setR={p.setR} setO={p.setO}
              onSetA={v => setPatrolSet('A', v)}
              onSetC={v => setPatrolSet('C', v)}
              onSetL={v => setPatrolSet('L', v)}
              onSetR={v => setPatrolSet('R', v)}
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
              inDiff={calc?.inDiff} showDiff={true}
              onChange={setPatrolIn} onCamera={onCamera} />

            {p.outs.map((o, i) => (
              <OutGroupRow key={i} idx={i} label={outLabels[i]}
                out={o} touched={p.touchedOuts[i]}
                prevOut={i === 0 ? prev?.outMeter : i === 1 ? prev?.outMeter2 : prev?.outMeter3}
                outDiff={c?.outs[i]?.diff}
                onMeter={v => setPatrolOut(i, 'meter', v)}
                onZan={v => setPatrolZan(i, v)}
                onHo={v => setPatrolOut(i, 'ho', v)}
                onPrize={v => setPatrolOut(i, 'prize', v)}
                onCost={v => setPatrolOut(i, 'cost', v)} />
            ))}

            <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 6 }}>
              <Term id="o" style={{ fontSize: 11, color: '#f0c040', fontWeight: 700, flexShrink: 0 }}>O</Term>
              <input type="text"
                style={{ ...INP_BASE, flex: 1, textAlign: 'left', color: '#d0d0e0' }}
                value={p.setO} placeholder="設定メモ"
                onFocus={e => e.target.select()}
                onChange={e => setPatrolSet('O', e.target.value)} />
            </div>
          </>
        )
      }

      // ── パターンD1/D2: ガチャ v3 (3メーター横並び) ────────────
      case 'D1':
      case 'D2': {
        return (
          <GachaInputV3
            pattern={pattern}
            boothCode={booth.booth_code}
            p={p}
            prev={prev}
            calc={c}
            lockers={lockers}
            lockerState={lockerState}
            staffId={staffId}
            setPatrolIn={setPatrolIn}
            setPatrolOut={setPatrolOut}
            setPatrolZan={setPatrolZan}
            onCamera={onCamera}
            resetPatrolInMeter={resetPatrolInMeter}
            resetPatrolOutMeter={resetPatrolOutMeter}
          />
        )
      }

      default: return null
    }
  }

  // 保存ボタンラベル
  let saveLabel = mode === 'correction' ? '修正を保存'
    : mode === 'replace' ? '入替として保存'
    : `${boothLabel} を保存`

  // D1/D2 v3: 据え置き状態に応じた動的ラベル
  if ((pattern === 'D1' || pattern === 'D2') && mode === 'new_patrol' && patrol) {
    const meters = [
      patrol.inTouched,
      patrol.touchedOuts[0]?.meter,
      ...(pattern === 'D2' ? [patrol.touchedOuts[1]?.meter] : []),
    ]
    const filled = meters.filter(Boolean).length
    const total = meters.length
    saveLabel = filled === 0 ? '全据え置きで保存して次へ'
      : filled === total ? '保存して次へ'
      : `${filled}件入力 + 残据え置きで保存`
  }

  // ── メイン描画 ─────────────────────────────────────────────────
  return (
    <>
    <div
      style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a0a12', color: '#e8e8f0', fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif", maxWidth: 640, margin: '0 auto' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      {/* スクロール可能なコンテンツエリア */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 0' }}>

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

        {/* モードバッジ（全モード、日付を内包） */}
        {mode === 'new_patrol' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', marginBottom: 8, borderRadius: 6, background: '#0d1f0d', border: '1px solid rgba(46,204,113,.25)' }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: '#2ecc71' }}>🆕 新規巡回入力</span>
            <span style={{ fontSize: 11, color: '#8888a8', marginLeft: 'auto' }}>{readDate}</span>
          </div>
        )}
        {mode === 'correction' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 8, borderRadius: 6, background: '#1a1a2e', border: '1px solid #2a2a44' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#f0a040' }}>
              ✏️ {existingRecord?.entry_type === 'replace' ? '今日の入替を編集中' : '昨日の巡回を編集中'}
            </span>
            <button
              onClick={handleSwitchToReplace}
              style={{ marginLeft: 'auto', fontSize: 11, color: '#5dade2', background: 'none', border: '1px solid rgba(93,173,226,.3)', borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}
            >
              🔄 入替変更で記録
            </button>
          </div>
        )}
        {mode === 'replace' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 8, borderRadius: 6, background: '#1a1a2e', border: '1px solid #2a2a44' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#5dade2' }}>🔄 入替変更モード</span>
            <span style={{ fontSize: 11, color: '#8888a8', marginLeft: 'auto' }}>{readDate} 🔒</span>
          </div>
        )}

        {/* 巡回ゾーン */}
        <div style={ZONE}>
          {/* 前回値 */}
          <PrevRow prev={prev}
            outCount={outCount}
            outLabels={pattern === 'B' ? OUT_LABELS_B : pattern === 'D2' ? OUT_LABELS_D2 : null} />

          {/* パターン別入力 */}
          {renderPatrolContent()}

          {/* 異常値アラート */}
          <AlertBar alerts={alerts} />

        </div>

        {/* 集金履歴テーブル（修正/入替モード） */}
        {(mode === 'correction' || mode === 'replace') && (
          <div style={{ marginTop: 8 }}>
            <BoothHistoryTable
              boothId={booth?.booth_code}
              currentReadingId={existingRecord?.reading_id}
            />
          </div>
        )}

      </div>

      {/* 保存ボタン固定 */}
      <div style={{ flexShrink: 0, padding: '8px 10px 16px' }}>
          {saveError && (
            <div style={{ margin: '0 0 8px', padding: '8px 12px', background: 'rgba(255,107,107,.12)', border: '1px solid #ff6b6b', borderRadius: 6, fontSize: 13, color: '#ff6b6b' }}>
              {saveError}
            </div>
          )}
          {saved ? (
            <div style={{ padding: '14px', borderRadius: 10, background: '#1a1a2e', border: '1px solid #2ecc71', textAlign: 'center', color: '#2ecc71', fontWeight: 700, fontSize: 15 }}>
              ✅ 保存しました
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ width: '100%', padding: '14px', borderRadius: 10, background: saving ? '#1a1a2e' : '#5dade2', color: saving ? '#8888a8' : '#000', border: 'none', fontWeight: 700, fontSize: 15, cursor: saving ? 'default' : 'pointer' }}
            >
              {saving ? '保存中...' : saveLabel}
            </button>
          )}
        </div>

    </div>

    {showOcr && !USE_NEW_CAMERA && (
      <OcrCaptureScreen
        boothCode={booth.booth_code}
        machineInfo={machineInfo}
        lastIn={prev?.inMeter != null ? Number(prev.inMeter) : null}
        lastOut={prev?.outMeter != null ? Number(prev.outMeter) : null}
        mode={outCount >= 2 ? 'three' : 'single'}
        onConfirm={handleOcrApply}
        onCancel={() => setShowOcr(false)}
      />
    )}
    {USE_NEW_CAMERA && (
      <NativeCamera
        ref={nativeCamRef}
        onOcrResult={handleNativeCameraResult}
        storagePrefix={`meter-captures/${booth?.store_code || 'unknown'}/${booth?.booth_code || 'unknown'}/${new Date().toISOString().slice(0, 10)}`}
      />
    )}

    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    <HelpFAB />
    </>
  )
}
