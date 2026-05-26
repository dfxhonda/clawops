import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useFeatureFlag } from '../../hooks/useFeatureFlag'
import { useSaveState } from '../../hooks/useSaveState'
import { PageHeader } from '../../shared/ui/PageHeader'
import NumpadField, { NumpadFooterPanel } from '../components/NumpadField'
import Tooltip from '../components/Tooltip'
import BoothHistoryList from '../components/BoothHistoryList'
import BoothInputForm, { EMPTY_TOUCHED, diffDisplay } from '../components/BoothInputForm'
import AlertSheetModal from '../components/AlertSheetModal'
import LiveCameraView from '../components/LiveCameraView'
import ErrorBanner from '../../components/ErrorBanner'
import { useFieldNavigation } from '../hooks/useFieldNavigation'
import { useOCR } from '../hooks/useOCR'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'
import { logger } from '../../lib/logger'
import {
  savePatrolReading,
  getLastReadingForBooth,
  classifyEntryType,
} from '../../services/patrolCore'

function mapMetersToColumns(meters) {
  const inTypes = ['in','yen1000_in','yen500_in','yen100_in','in_a','in_b','change_in']
  const cols = { in_meter: null, out_meter: null }
  for (const t of inTypes) {
    const m = meters.find(x => x.type === t && x.value != null)
    if (m) { cols.in_meter = parseInt(m.value, 10); break }
  }
  const outOrder = ['out_a','out','capsule_out','prize_out','out_b','out_c','change_out']
  const outs = meters
    .filter(m => /out/i.test(m.type) && m.value != null)
    .sort((a, b) => outOrder.indexOf(a.type) - outOrder.indexOf(b.type))
  if (outs[0]) cols.out_meter = parseInt(outs[0].value, 10)
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

export default function PatrolBoothInputPage() {
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

  // OCR state
  const [showOcr,       setShowOcr]   = useState(false)
  const [ocrState,      setOcrState]  = useState('idle') // 'idle' | 'loading' | 'confirming'
  const [ocrCapture,    setOcrCapture] = useState(null)  // { imageUrl, cols, photoUrl, avgConf }
  const [ocrEditIn,     setOcrEditIn]  = useState('')
  const [ocrEditOut,    setOcrEditOut] = useState('')
  const [ocrEdited,     setOcrEdited]  = useState(false)
  const [ocrPhotoUrl,   setOcrPhotoUrl] = useState(null)
  const [ocrConfidence, setOcrConf]   = useState(null)
  const [ocrInputMethod,setOcrIM]     = useState('ocr')
  const [ocrError,      setOcrError]  = useState(null)
  const { engine, toggleEngine, loading: ocrLoading, runOCR } = useOCR({ boothCode, orgId: DFX_ORG_ID })

  // Form state — OUT1
  const [prev,          setPrev]   = useState(null)
  const [inMeter,       setIn]     = useState('')
  const [outMeter1,     setOut1]   = useState('')
  const [outMeter2,     setOut2]   = useState('')
  const [outMeter3,     setOut3]   = useState('')
  const [stock,         setStk]    = useState('')
  const [restock,       setRst]    = useState('')
  const [prizeName,     setPrize]  = useState('')
  const [prizeCost,     setCost]   = useState('')
  // Form state — OUT2
  const [stock2,        setStk2]   = useState('')
  const [restock2,      setRst2]   = useState('')
  const [prizeName2,    setPrize2] = useState('')
  const [prizeCost2,    setCost2]  = useState('')
  const [selectedPrizeId2, setSelectedPrizeId2] = useState(null)
  // Form state — OUT3
  const [stock3,        setStk3]   = useState('')
  const [restock3,      setRst3]   = useState('')
  const [prizeName3,    setPrize3] = useState('')
  const [prizeCost3,    setCost3]  = useState('')
  const [selectedPrizeId3, setSelectedPrizeId3] = useState(null)
  // Settings
  const [setA,          setSetA]   = useState('')
  const [setC,          setSetC]   = useState('')
  const [setL,          setSetL]   = useState('')
  const [setR,          setSetR]   = useState('')
  const [setO,          setSetO]   = useState('')
  const [touched,       setTouched] = useState(() => ({ ...EMPTY_TOUCHED }))
  const [selectedPrizeId, setSelectedPrizeId] = useState(null)
  const [isCollectionDay, setIsCollectionDay] = useState(false)
  const [isCollection,  setIsColl] = useState(false)
  const [saveState, saveActions] = useSaveState()
  const [skipped,       setSkipped]   = useState(false)
  const [showAlert,     setShowAlert] = useState(false)
  const [historyKey,    setHistoryKey] = useState(0)

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
    // OUT2
    setStk2(prev.stock_2 != null ? String(prev.stock_2) : '')
    setRst2(prev.restock_2 != null ? String(prev.restock_2) : '')
    setPrize2(prev.prize_name_2 ?? '')
    setCost2(prev.prize_cost_2 != null ? String(prev.prize_cost_2) : '')
    setSelectedPrizeId2(null)
    // OUT3
    setStk3(prev.stock_3 != null ? String(prev.stock_3) : '')
    setRst3(prev.restock_3 != null ? String(prev.restock_3) : '')
    setPrize3(prev.prize_name_3 ?? '')
    setCost3(prev.prize_cost_3 != null ? String(prev.prize_cost_3) : '')
    setSelectedPrizeId3(null)
    // Settings
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

  function buildOptionalPatch() {
    const patch = {}
    if (touched.prizeName) patch.prize_name = prizeName.trim() || null
    if (touched.prizeName && selectedPrizeId != null) patch.prize_id = selectedPrizeId
    if (touched.prizeCost) {
      const t = prizeCost.trim()
      patch.prize_cost = t === '' ? null : (Number.isFinite(parseInt(t, 10)) ? parseInt(t, 10) : null)
    }
    if (touched.setA) patch.set_a = setA.trim() || null
    if (touched.setC) patch.set_c = setC.trim() || null
    if (touched.setL) patch.set_l = setL.trim() || null
    if (touched.setR) patch.set_r = setR.trim() || null
    if (touched.setO) patch.set_o = setO.trim() || null
    if (touched.outMeter2) patch.out_meter_2 = outMeter2 !== '' ? parseFloat(outMeter2) : null
    if (touched.outMeter3) patch.out_meter_3 = outMeter3 !== '' ? parseFloat(outMeter3) : null
    // OUT2 fields
    if (touched.stock2)    patch.stock_2    = stock2 !== '' ? parseInt(stock2, 10) : null
    if (touched.restock2)  patch.restock_2  = restock2 !== '' ? parseInt(restock2, 10) : null
    if (touched.prizeName2) patch.prize_name_2 = prizeName2.trim() || null
    if (touched.prizeCost2) {
      const t = prizeCost2.trim()
      patch.prize_cost_2 = t === '' ? null : (Number.isFinite(parseInt(t, 10)) ? parseInt(t, 10) : null)
    }
    // OUT3 fields
    if (touched.stock3)    patch.stock_3    = stock3 !== '' ? parseInt(stock3, 10) : null
    if (touched.restock3)  patch.restock_3  = restock3 !== '' ? parseInt(restock3, 10) : null
    if (touched.prizeName3) patch.prize_name_3 = prizeName3.trim() || null
    if (touched.prizeCost3) {
      const t = prizeCost3.trim()
      patch.prize_cost_3 = t === '' ? null : (Number.isFinite(parseInt(t, 10)) ? parseInt(t, 10) : null)
    }
    // OCR photo
    if (ocrPhotoUrl) {
      patch.source         = 'ocr'
      patch.photo_url      = ocrPhotoUrl
      patch.input_method   = ocrInputMethod
      patch.ocr_confidence = ocrConfidence ?? null
    }
    return patch
  }

  async function handleOCRCapture(base64, blob) {
    setShowOcr(false)
    setOcrState('loading')
    setOcrError(null)
    logger.info('ocr_photo_captured', { boothCode, blob_size: blob?.size ?? 0 })

    const result = await runOCR(base64, blob)

    if (!result || result.timeout) {
      setOcrError('OCR読取がタイムアウトしました。再試行してください。')
      return
    }

    const { meters: ocrMeters, photoUrl, uploadError } = result
    if (photoUrl) logger.info('ocr_photo_uploaded', { photo_url: photoUrl })
    else if (uploadError) logger.error('ocr_photo_upload_error', { error: uploadError, code: 'ERR-OCR-PHOTO-001' })

    if (!ocrMeters?.length) {
      setOcrError('メーター数値を読み取れませんでした。再試行してください。')
      return
    }

    const cols = mapMetersToColumns(ocrMeters)
    const confList = ocrMeters.filter(m => typeof m.confidence === 'number')
    const avgConf = confList.length
      ? confList.reduce((s, m) => s + m.confidence, 0) / confList.length
      : null

    logger.info('ocr_result_returned', { confidence: avgConf })

    const imageUrl = blob ? URL.createObjectURL(blob) : null
    setOcrCapture({ imageUrl, cols, photoUrl: photoUrl ?? null, avgConf })
    setOcrEditIn(cols.in_meter != null ? String(cols.in_meter) : '')
    setOcrEditOut(cols.out_meter != null ? String(cols.out_meter) : '')
    setOcrEdited(false)
    setOcrState('confirming')
  }

  function handleOCRUse() {
    if (!ocrCapture) return
    const { photoUrl, avgConf } = ocrCapture
    const finalIn = ocrEditIn !== '' ? parseInt(ocrEditIn, 10) : null
    const finalOut = ocrEditOut !== '' ? parseInt(ocrEditOut, 10) : null
    logger.info('ocr_confirmation_use_clicked', { in: finalIn, out: finalOut, confidence: avgConf, edited: ocrEdited })
    if (finalIn != null) { setIn(String(finalIn)); setTouched(t => ({ ...t, inMeter: true })) }
    if (finalOut != null) { setOut1(String(finalOut)); setTouched(t => ({ ...t, outMeter1: true })) }
    setOcrPhotoUrl(photoUrl ?? null)
    setOcrConf(avgConf ?? null)
    setOcrIM('ocr')
    setOcrState('idle')
    setOcrCapture(null)
    setOcrEditIn('')
    setOcrEditOut('')
    setOcrEdited(false)
  }

  function handleOCRRecapture() {
    logger.info('ocr_confirmation_recapture_clicked')
    setOcrCapture(null)
    setOcrEditIn('')
    setOcrEditOut('')
    setOcrEdited(false)
    setOcrState('idle')
    setShowOcr(true)
  }

  async function handleSave() {
    if (!patrolEnabled) {
      alert('patrol_core フラグが無効です。管理者に連絡してください。')
      return
    }
    if (!canSave) return
    const didStart = saveActions.setLoading()
    if (!didStart) return
    logger.info('patrol_save_attempted', { boothCode, entryType, has_photo: !!ocrPhotoUrl })
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
      if (!res.ok) {
        saveActions.setError(res.errCode, res.message)
      } else if (res.skipped) {
        setSkipped(true)
        saveActions.reset()
        setTimeout(() => navigate(-1), 1000)
      } else {
        saveActions.setSuccess()
        setHistoryKey(k => k + 1)
        setTimeout(() => navigate(-1), 800)
      }
    } catch (e) {
      logger.error('patrol_save_failed_unexpected', { message: e?.message, boothCode })
      saveActions.setError('ERR-UNKNOWN', e?.message ?? '予期しないエラー')
    }
  }

  const savingProp = saveState.status === 'loading'
  const resultProp = saveState.status === 'success' ? 'saved'
    : saveState.status === 'error' ? 'error'
    : skipped ? 'skipped'
    : null

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

  // === LiveCamera full-screen ===
  if (showOcr) {
    return (
      <LiveCameraView
        engine={engine}
        onToggleEngine={toggleEngine}
        onCapture={handleOCRCapture}
        onQR={null}
        onCancel={() => setShowOcr(false)}
        showGuide={false}
      />
    )
  }

  // === OCR loading overlay ===
  if (ocrState === 'loading') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-4">
        {ocrError ? (
          <>
            <div className="text-red-400 text-4xl">✕</div>
            <div className="text-red-400 text-base font-bold px-6 text-center">{ocrError}</div>
            <button
              onClick={() => { setOcrError(null); setOcrState('idle') }}
              className="px-6 py-2 bg-gray-700 text-white rounded-lg text-base font-bold"
            >
              閉じる
            </button>
          </>
        ) : (
          <>
            <div className="animate-spin w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full" />
            <div className="text-sky-300 text-base font-bold">OCR解析中...</div>
          </>
        )}
      </div>
    )
  }

  // === OCR confirmation screen (editable IN/OUT) ===
  if (ocrState === 'confirming' && ocrCapture) {
    const { imageUrl, photoUrl, avgConf } = ocrCapture
    const confPct = avgConf != null ? Math.round(avgConf * 100) : null
    const confCls = confPct == null ? 'text-muted' : confPct >= 90 ? 'text-green-400' : confPct >= 70 ? 'text-yellow-400' : 'text-red-400'
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        {imageUrl && (
          <div className="shrink-0 bg-black" style={{ height: '60vh' }}>
            <img src={imageUrl} alt="OCR撮影" className="w-full h-full object-contain" />
          </div>
        )}
        <div className="flex-1 overflow-y-auto bg-bg px-4 pt-4 pb-6">
          <div className="rounded-2xl border border-border bg-surface/60 p-4 mb-4">
            <div className="text-xs font-bold text-muted mb-3">OCR認識値 — タップして修正可</div>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div>
                <div className="text-xs text-muted mb-1">IN</div>
                <div className={`rounded-xl transition-all ${activeTabindex === 91 ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
                  <NumpadField
                    id="ocr-confirm-in"
                    value={ocrEditIn}
                    onChange={v => { setOcrEdited(true); setOcrEditIn(v); logger.info('ocr_confirmation_value_edited', { field: 'in_meter' }) }}
                    label="IN"
                    allowDecimal={false}
                    dataTabindex={91}
                    onRegister={registerField}
                    isActive={activeTabindex === 91}
                    style={{ fontSize: 24, width: '100%', fontWeight: 'bold' }}
                    testId="ocr-confirm-in"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-muted mb-1">OUT</div>
                <div className={`rounded-xl transition-all ${activeTabindex === 92 ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
                  <NumpadField
                    id="ocr-confirm-out"
                    value={ocrEditOut}
                    onChange={v => { setOcrEdited(true); setOcrEditOut(v); logger.info('ocr_confirmation_value_edited', { field: 'out_meter' }) }}
                    label="OUT"
                    allowDecimal={false}
                    dataTabindex={92}
                    onRegister={registerField}
                    isActive={activeTabindex === 92}
                    style={{ fontSize: 24, width: '100%', fontWeight: 'bold' }}
                    testId="ocr-confirm-out"
                  />
                </div>
              </div>
            </div>
            <div className="text-xs text-muted">
              信頼度: <span className={confCls}>{confPct != null ? `${confPct}%` : '—'}</span>
              {ocrEdited && <span className="ml-3 text-amber-400">修正済み</span>}
              {!photoUrl && <span className="ml-3 text-amber-400">写真アップロード失敗</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-3 flex-shrink-0 px-4 pt-2 pb-3 bg-bg border-t border-border/30">
          <button
            type="button"
            onClick={handleOCRUse}
            className="flex-1 py-4 bg-blue-600 text-white font-bold text-base rounded-2xl min-h-[44px]"
          >
            使う
          </button>
          <button
            type="button"
            onClick={handleOCRRecapture}
            className="flex-1 py-4 border-2 border-border text-text font-bold text-base rounded-2xl min-h-[44px]"
          >
            再撮影
          </button>
        </div>
        <NumpadFooterPanel currentField={currentField} />
      </div>
    )
  }

  // === Main patrol form ===
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
      </div>

      <div className="flex-shrink-0">
        {saveState.status === 'error' && (
          <ErrorBanner
            errCode={saveState.errCode}
            message={saveState.errMessage}
            onClose={saveActions.reset}
            onRetry={handleSave}
          />
        )}
        <BoothInputForm
          mode="patrol"
          outMeterCount={outMeterCount}
          inMeter={inMeter} setIn={setIn}
          outMeter1={outMeter1} setOut1={setOut1}
          outMeter2={outMeter2} setOut2={setOut2}
          outMeter3={outMeter3} setOut3={setOut3}
          stock={stock} setStk={setStk}
          restock={restock} setRst={setRst}
          stock2={stock2} setStk2={setStk2}
          restock2={restock2} setRst2={setRst2}
          stock3={stock3} setStk3={setStk3}
          restock3={restock3} setRst3={setRst3}
          prizeName={prizeName} setPrize={setPrize}
          prizeCost={prizeCost} setCost={setCost}
          prizeName2={prizeName2} setPrize2={setPrize2}
          prizeCost2={prizeCost2} setCost2={setCost2}
          prizeName3={prizeName3} setPrize3={setPrize3}
          prizeCost3={prizeCost3} setCost3={setCost3}
          setA={setA} setSetA={setSetA}
          setC={setC} setSetC={setSetC}
          setL={setL} setSetL={setSetL}
          setR={setR} setSetR={setSetR}
          setO={setO} setSetO={setSetO}
          selectedPrizeId={selectedPrizeId} setSelectedPrizeId={setSelectedPrizeId}
          selectedPrizeId2={selectedPrizeId2} setSelectedPrizeId2={setSelectedPrizeId2}
          selectedPrizeId3={selectedPrizeId3} setSelectedPrizeId3={setSelectedPrizeId3}
          touched={touched} touch={touch}
          isCollectionDay={isCollectionDay} isCollection={isCollection} setIsColl={setIsColl}
          entryType={entryType}
          inDiffDisp={inDiffDisp} outDiffDisp={outDiffDisp}
          navigateNext={navigateNext} registerField={registerField} activeTabindex={activeTabindex}
          canSave={canSave} saving={savingProp} result={resultProp} onSave={handleSave}
          onOCR={() => { logger.info('ocr_button_pressed', { booth_code: boothCode, source: 'camera' }); setShowOcr(true) }}
        />
      </div>

      <div className="px-4 py-2 border-t border-border/30 shrink-0">
        <button
          type="button"
          onClick={() => setShowAlert(true)}
          className="w-full py-2 text-sm font-bold text-amber-400/90 bg-amber-400/10 border border-amber-400/20 rounded-xl flex items-center justify-center gap-1.5"
        >
          📝 気づきを記録
        </button>
      </div>
      <NumpadFooterPanel
        currentField={currentField}
        idleContent={
          <BoothHistoryList
            boothCode={boothCode}
            meterUnitPrice={machine?.machine_models?.meter_unit_price ?? 100}
            storeCode={storeCode}
            machine={machine}
            booth={booth}
            limit={10}
            historyKey={historyKey}
            draftRow={{
              active: saveState.status !== 'success' && !skipped && (inDiff != null || outDiff != null),
              inDiff,
              outDiff,
            }}
          />
        }
      />

      <AlertSheetModal
        open={showAlert}
        onClose={() => setShowAlert(false)}
        boothCode={boothCode}
        machineCode={machine?.machine_code ?? boothCode}
        storeCode={resolvedStoreCode ?? ''}
        readingId={prev?.reading_id ?? null}
        photoUrl={null}
        orgId={DFX_ORG_ID}
        staffId={staffId}
      />
    </div>
  )
}
