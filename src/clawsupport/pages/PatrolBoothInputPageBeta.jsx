import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useFeatureFlag } from '../../hooks/useFeatureFlag'
import { PageHeader } from '../../shared/ui/PageHeader'
import { NumpadFooterPanel } from '../components/NumpadField'
import BoothHistoryList from '../components/BoothHistoryList'
import BoothInputForm, { EMPTY_TOUCHED, diffDisplay } from '../components/BoothInputForm'
import { useFieldNavigation } from '../hooks/useFieldNavigation'
import {
  savePatrolReading,
  getLastReadingForBooth,
  classifyEntryType,
} from '../../services/patrolCore'
import { useOCR } from '../hooks/useOCR'
import LiveCameraView from '../components/LiveCameraView'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'

function mapMetersToColumns(meters) {
  const inTypes = ['in','yen1000_in','yen500_in','yen100_in','in_a','in_b','change_in']
  const cols = { in_meter: null, out_meter: null, out_meter_2: null, out_meter_3: null }
  for (const t of inTypes) {
    const m = meters.find(x => x.type === t && x.value != null)
    if (m) { cols.in_meter = parseInt(m.value, 10); break }
  }
  const outOrder = ['out_a','out','capsule_out','prize_out','out_b','out_c','change_out']
  const outs = meters
    .filter(m => /out/i.test(m.type) && m.value != null)
    .sort((a, b) => outOrder.indexOf(a.type) - outOrder.indexOf(b.type))
  if (outs[0]) cols.out_meter   = parseInt(outs[0].value, 10)
  if (outs[1]) cols.out_meter_2 = parseInt(outs[1].value, 10)
  if (outs[2]) cols.out_meter_3 = parseInt(outs[2].value, 10)
  return cols
}

const ENTRY_BADGES = {
  patrol:     { label: '通常巡回',      cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-400/30' },
  replace:    { label: '入替/設定変更', cls: 'bg-amber-500/20 text-amber-400 border-amber-400/30' },
  collection: { label: '集金',          cls: 'bg-blue-500/20 text-blue-400 border-blue-400/30' },
}

function EntryTypeBadge({ type }) {
  const b = ENTRY_BADGES[type] ?? ENTRY_BADGES.patrol
  return (
    <span
      data-testid="entry-type-badge"
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-base border font-bold ${b.cls}`}
    >
      {b.label}
    </span>
  )
}

function PrevReadingRow({ prev }) {
  if (!prev) return null
  const date = prev.patrol_date ?? prev.read_time?.slice(0, 10) ?? '—'
  return (
    <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-surface/60 border border-border text-base text-muted">
      <span className="font-bold mr-2">前回</span>
      <span>{date}</span>
      <span className="mx-2">|</span>
      <span>IN {prev.in_meter ?? '—'}</span>
      <span className="mx-1">/</span>
      <span>OUT {prev.out_meter ?? '—'}</span>
      <span className="mx-2">|</span>
      <span>在庫 {prev.prize_stock_count ?? '—'}</span>
      <span className="mx-1">補充 {prev.prize_restock_count ?? '—'}</span>
      {prev.prize_name && <><span className="mx-2">|</span><span>{prev.prize_name}</span></>}
    </div>
  )
}

function TheoryRow({ prev }) {
  if (!prev) return null
  const payout = prev.payout_rate
  const payoutLabel =
    payout == null || payout === ''
      ? '—'
      : Number(payout) <= 1 && Number(payout) > 0
        ? `${(Number(payout) * 100).toFixed(1)}%`
        : `${payout}%`
  return (
    <div
      data-testid="theory-row"
      className="mx-4 mb-2 px-3 py-2 rounded-xl bg-surface/40 border border-border/80 text-base text-muted"
    >
      <span className="font-bold text-text/90 mr-2">理論・出率（前回記録）</span>
      <span>出率 {payoutLabel}</span>
      <span className="mx-2">|</span>
      <span data-testid="theoretical-stock-label">
        理論在庫 {prev.theoretical_stock != null ? prev.theoretical_stock : '—'}
      </span>
    </div>
  )
}

export default function PatrolBoothInputPageBeta() {
  const { boothCode } = useParams()
  const { state }    = useLocation()
  const navigate     = useNavigate()
  const { staffId }  = useAuth()
  const { enabled: patrolEnabled } = useFeatureFlag('patrol_core')
  const { navigateNext, currentField, registerField } = useFieldNavigation()
  const activeTabindex = currentField?.dataTabindex ?? null

  const { machine, booth, storeCode } = state ?? {}
  const resolvedStoreCode = storeCode ?? machine?.store_code ?? null
  const outMeterCount = machine?.machine_models?.out_meter_count ?? 1

  const [prev,           setPrev]   = useState(null)
  const [inMeter,        setIn]     = useState('')
  const [outMeter1,      setOut1]   = useState('')
  const [outMeter2,      setOut2]   = useState('')
  const [outMeter3,      setOut3]   = useState('')
  const [stock,          setStk]    = useState('')
  const [restock,        setRst]    = useState('')
  const [prizeName,      setPrize]  = useState('')
  const [prizeCost,      setCost]   = useState('')
  const [setA,           setSetA]   = useState('')
  const [setC,           setSetC]   = useState('')
  const [setL,           setSetL]   = useState('')
  const [setR,           setSetR]   = useState('')
  const [setO,           setSetO]   = useState('')
  const [touched,        setTouched] = useState(() => ({ ...EMPTY_TOUCHED }))
  const [selectedPrizeId, setSelectedPrizeId] = useState(null)
  const [isCollectionDay, setIsCollectionDay] = useState(false)
  const [isCollection,   setIsColl] = useState(false)
  const [saving,         setSaving] = useState(false)
  const [result,         setResult] = useState(null)

  const [showCamera,       setShowCamera]       = useState(false)
  const [photoUrl,         setPhotoUrl]         = useState(null)
  const [capturedImageUrl, setCapturedImageUrl] = useState(null)
  const [ocrResultMeters,  setOcrResultMeters]  = useState([])
  const [showOcrConfirm,   setShowOcrConfirm]   = useState(false)
  const [ocrErrMsg,        setOcrErrMsg]        = useState(null)

  const { engine, toggleEngine, loading: ocrLoading, error: ocrError, runOCR } =
    useOCR({ boothCode, orgId: DFX_ORG_ID })

  const touch = key => () => setTouched(t => ({ ...t, [key]: true }))

  useEffect(() => {
    getLastReadingForBooth(boothCode).then(setPrev)
  }, [boothCode])

  useEffect(() => {
    setTouched({ ...EMPTY_TOUCHED })
  }, [boothCode])

  useEffect(() => {
    if (!prev) return
    setIn(prev.in_meter != null ? String(prev.in_meter) : '')
    setOut1(prev.out_meter != null ? String(prev.out_meter) : '')
    setOut2(prev.out_meter_2 != null ? String(prev.out_meter_2) : '')
    setOut3(prev.out_meter_3 != null ? String(prev.out_meter_3) : '')
    setStk(prev.prize_stock_count != null ? String(prev.prize_stock_count) : '')
    setRst(prev.prize_restock_count != null ? String(prev.prize_restock_count) : '')
    setPrize(prev.prize_name ?? '')
    const pc = prev.prize_cost ?? prev.prize_cost_1
    setCost(pc != null && pc !== '' ? String(pc) : '')
    setSetA(prev.set_a ?? '')
    setSetC(prev.set_c ?? '')
    setSetL(prev.set_l ?? '')
    setSetR(prev.set_r ?? '')
    setSetO(prev.set_o ?? '')
    setSelectedPrizeId(null)
  }, [prev?.reading_id, boothCode])

  useEffect(() => {
    if (!resolvedStoreCode) { setIsCollectionDay(false); return }
    let cancel = false
    supabase
      .from('stores')
      .select('is_collection_day')
      .eq('store_code', resolvedStoreCode)
      .maybeSingle()
      .then(({ data }) => { if (!cancel) setIsCollectionDay(!!data?.is_collection_day) })
    return () => { cancel = true }
  }, [resolvedStoreCode])

  useEffect(() => {
    if (!isCollectionDay) setIsColl(false)
  }, [isCollectionDay])

  useEffect(() => {
    if (touched.stock || !prev || outMeter1 === '') return
    const out_diff = Number(outMeter1) - Number(prev.out_meter ?? 0)
    const theoretical = (prev.prize_stock_count ?? 0) + (prev.prize_restock_count ?? 0) - out_diff
    if (theoretical >= 0) setStk(String(theoretical))
  }, [outMeter1, prev, touched.stock])

  const recordAsCollection = isCollectionDay && isCollection

  const entryType = useMemo(
    () => classifyEntryType({
      prev,
      next: { inMeter, outMeter: outMeter1, prizeName, setA, setC, setL, setR, setO },
      isCollection: recordAsCollection,
    }),
    [prev, inMeter, outMeter1, prizeName, setA, setC, setL, setR, setO, recordAsCollection],
  )

  const canSave = inMeter !== '' && outMeter1 !== '' && stock !== ''

  async function handleOcrCapture(base64, blob) {
    setShowCamera(false)
    setOcrErrMsg(null)
    if (blob) setCapturedImageUrl(URL.createObjectURL(blob))
    const res = await runOCR(base64, blob)
    const { meters: ocrMeters, storagePath: sp, error: resErr } = res ?? {}
    if (sp) setPhotoUrl(sp)
    if (resErr) setOcrErrMsg(resErr)
    setOcrResultMeters(ocrMeters ?? [])
    setShowOcrConfirm(true)
  }

  function applyOcrValues() {
    if (ocrResultMeters.length) {
      const cols = mapMetersToColumns(ocrResultMeters)
      if (cols.in_meter != null) { setIn(String(cols.in_meter)); setTouched(t => ({ ...t, inMeter: true })) }
      if (cols.out_meter != null) { setOut1(String(cols.out_meter)); setTouched(t => ({ ...t, outMeter1: true })) }
      if (cols.out_meter_2 != null) { setOut2(String(cols.out_meter_2)); setTouched(t => ({ ...t, outMeter2: true })) }
      if (cols.out_meter_3 != null) { setOut3(String(cols.out_meter_3)); setTouched(t => ({ ...t, outMeter3: true })) }
    }
    setShowOcrConfirm(false)
  }

  function buildOptionalPatch() {
    const patch = {}
    if (touched.prizeName) patch.prize_name = prizeName.trim() || null
    if (touched.prizeName && selectedPrizeId != null) patch.prize_id = selectedPrizeId
    if (touched.prizeCost) {
      const t = prizeCost.trim()
      if (t === '') patch.prize_cost = null
      else {
        const n = parseInt(t, 10)
        patch.prize_cost = Number.isFinite(n) ? n : null
      }
    }
    if (touched.setA) patch.set_a = setA.trim() || null
    if (touched.setC) patch.set_c = setC.trim() || null
    if (touched.setL) patch.set_l = setL.trim() || null
    if (touched.setR) patch.set_r = setR.trim() || null
    if (touched.setO) patch.set_o = setO.trim() || null
    if (touched.outMeter2) patch.out_meter_2 = outMeter2 !== '' ? parseFloat(outMeter2) : null
    if (touched.outMeter3) patch.out_meter_3 = outMeter3 !== '' ? parseFloat(outMeter3) : null
    if (photoUrl) patch.photo_url = photoUrl
    return patch
  }

  async function handleSave() {
    if (!patrolEnabled) {
      alert('patrol_core フラグが無効です。管理者に連絡してください。')
      return
    }
    if (!canSave) return
    setSaving(true)
    try {
      const res = await savePatrolReading({
        boothCode,
        storeCode:   storeCode ?? machine?.store_code,
        machineCode: machine?.machine_code,
        inMeter,
        outMeter:     outMeter1,
        prizeStock:   stock,
        prizeRestock: restock,
        entryType,
        staffId,
        optionalPatch: buildOptionalPatch(),
        defaultsFromPrev: prev,
      })
      if (res.skipped) {
        setResult('skipped')
        setTimeout(() => navigate(-1), 1000)
      } else {
        setResult('saved')
        setTimeout(() => navigate(-1), 800)
      }
    } catch {
      setResult('error')
    } finally {
      setSaving(false)
    }
  }

  const boothLabel = booth
    ? `${machine?.machine_name ?? ''} ブース ${booth.booth_number}`
    : boothCode

  const inDiff = touched.inMeter && prev != null && inMeter !== ''
    ? Number(inMeter) - Number(prev.in_meter ?? 0)
    : null
  const outDiff = touched.outMeter1 && prev != null && outMeter1 !== ''
    ? Number(outMeter1) - Number(prev.out_meter ?? 0)
    : null
  const inDiffDisp  = diffDisplay(inDiff)
  const outDiffDisp = diffDisplay(outDiff)

  // ─── カメラ ────────────────────────────────────────────────────────
  if (showCamera) {
    return (
      <LiveCameraView
        engine={engine}
        onToggleEngine={toggleEngine}
        onCapture={handleOcrCapture}
        onQR={() => {}}
        onCancel={() => setShowCamera(false)}
      />
    )
  }

  // ─── OCR確認画面 ───────────────────────────────────────────────────
  if (showOcrConfirm) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a16', display: 'flex', flexDirection: 'column', zIndex: 9998 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2a44', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ color: '#d0d0e0', fontSize: 14, fontWeight: 700 }}>OCR読み取り結果確認</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8888a8' }}>{boothCode}</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {capturedImageUrl && (
            <div style={{ marginBottom: 12 }}>
              <img
                src={capturedImageUrl}
                alt="captured"
                style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, border: '1px solid #2a2a44', background: '#111' }}
              />
            </div>
          )}

          {(ocrErrMsg || ocrError || !ocrResultMeters.length) && (
            <div style={{ background: '#422006', border: '1px solid #d97706', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#fcd34d', fontSize: 13 }}>
              {ocrErrMsg || ocrError
                ? `OCR読取失敗: ${ocrErrMsg || ocrError}`
                : 'メーターが検出されませんでした'}
              <br />
              <span style={{ fontSize: 12, color: '#fbbf24' }}>「採用」で閉じて手入力フィールドに直接入力できます</span>
            </div>
          )}

          {ocrResultMeters.map((m, i) => {
            const conf = typeof m.confidence === 'number' ? m.confidence : null
            const confColor = conf == null ? '#6b7280' : conf >= 0.9 ? '#6ee7b7' : conf >= 0.7 ? '#9ca3af' : '#fcd34d'
            const confLabel = conf == null ? null : conf >= 0.9 ? '高' : conf >= 0.7 ? '中' : '低'
            return (
              <div key={i} style={{ background: '#16162a', border: '1px solid #2a2a44', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#8888a8' }}>{m.label || m.type}</span>
                  {confLabel && (
                    <span style={{ fontSize: 9, color: confColor, border: `1px solid ${confColor}`, borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>
                      {confLabel}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={m.value ?? ''}
                  onChange={e => setOcrResultMeters(prev => prev.map((x, j) =>
                    j === i ? { ...x, value: e.target.value === '' ? null : e.target.value } : x
                  ))}
                  style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '2px solid #3a3a54', color: '#d0d0e0', fontSize: 22, fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )
          })}
        </div>

        <div style={{ padding: '12px 16px 40px', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => { setShowOcrConfirm(false); setShowCamera(true) }}
            style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: '#2a2a44', color: '#d0d0e0', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            ↻ 再撮影
          </button>
          <button
            onClick={applyOcrValues}
            style={{ flex: 2, padding: '12px 0', borderRadius: 10, background: '#0891b2', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            ✓ この値を採用
          </button>
        </div>
      </div>
    )
  }

  // ─── メイン入力画面 ────────────────────────────────────────────────
  return (
    <div className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="clawsupport"
        title={boothLabel}
        variant="compact"
        onBack={() => navigate(-1)}
      />

      <div className="px-4 flex items-center gap-2">
        <EntryTypeBadge type={entryType} />
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-400/30 font-bold">BETA</span>
      </div>
      <PrevReadingRow prev={prev} />
      <TheoryRow prev={prev} />

      <div className="px-4 pb-2 shrink-0">
        <button
          onClick={() => setShowCamera(true)}
          disabled={ocrLoading}
          className="w-full py-3 rounded-xl text-base font-bold transition-opacity"
          style={{ background: ocrLoading ? '#2a2a44' : '#16a34a', color: ocrLoading ? '#666' : '#fff' }}
        >
          {ocrLoading ? '読み取り中...' : '📷 OCR一括撮影'}
        </button>
        {photoUrl && (
          <p className="text-xs text-muted mt-1 text-center">📷 写真保存済み</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-[300px]">
        <BoothInputForm
          mode="patrol"
          outMeterCount={outMeterCount}
          inMeter={inMeter} setIn={setIn}
          outMeter1={outMeter1} setOut1={setOut1}
          outMeter2={outMeter2} setOut2={setOut2}
          outMeter3={outMeter3} setOut3={setOut3}
          stock={stock} setStk={setStk}
          restock={restock} setRst={setRst}
          prizeName={prizeName} setPrize={setPrize}
          prizeCost={prizeCost} setCost={setCost}
          setA={setA} setSetA={setSetA}
          setC={setC} setSetC={setSetC}
          setL={setL} setSetL={setSetL}
          setR={setR} setSetR={setSetR}
          setO={setO} setSetO={setSetO}
          selectedPrizeId={selectedPrizeId} setSelectedPrizeId={setSelectedPrizeId}
          touched={touched} touch={touch}
          isCollectionDay={isCollectionDay} isCollection={isCollection} setIsColl={setIsColl}
          entryType={entryType}
          inDiffDisp={inDiffDisp} outDiffDisp={outDiffDisp}
          navigateNext={navigateNext} registerField={registerField} activeTabindex={activeTabindex}
          canSave={canSave} saving={saving} result={result} onSave={handleSave}
        />
        <BoothHistoryList
          boothCode={boothCode}
          meterUnitPrice={machine?.machine_models?.meter_unit_price ?? 100}
          storeCode={storeCode}
          machine={machine}
          booth={booth}
          limit={10}
        />
      </div>

      <NumpadFooterPanel currentField={currentField} />
    </div>
  )
}
