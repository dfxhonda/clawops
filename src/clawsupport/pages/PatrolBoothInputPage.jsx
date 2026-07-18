import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useHierarchicalBack } from '../../shared/nav/hierarchicalBack' // J-NAV-BACK-HIERARCHICAL-01
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useFeatureFlag } from '../../hooks/useFeatureFlag'
import { useSaveState } from '../../hooks/useSaveState'
import { PageHeader } from '../../shared/ui/PageHeader'
import NumpadField, { NumpadFooterPanel } from '../components/NumpadField'
import NumpadFooterSlot from '../components/NumpadFooterSlot'
import { isCustomNumpadEnabled } from '../../shared/lib/device'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import Tooltip from '../components/Tooltip'
import BoothHistoryList from '../components/BoothHistoryList'
import BoothInputForm, { EMPTY_TOUCHED, diffDisplay } from '../components/BoothInputForm'
import AlertSheetModal from '../components/AlertSheetModal'
import ErrorBanner from '../../components/ErrorBanner'
import { useFieldNavigation } from '../hooks/useFieldNavigation'
import { useOCR } from '../hooks/useOCR'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'
import { patrolCanSave } from '../lib/patrolCanSave'
import { logger } from '../../lib/logger'
import { ERR } from '../../lib/errorCodes'
import { Sentry } from '../../lib/sentry'
import { recordMachineLoad, recordMachineUnload } from '../../services/movements'
import { putPatrolRecord, getPatrolRecordsByBooth } from '../../lib/localStore/patrolRecords'
import { notifyLfChange } from '../../hooks/useUnsentBanner'
import { usePatrolListScrollStore } from '../../stores/patrolListScrollStore'
import { mapMetersToColumns, theoreticalStock } from '../utils/patrolStockCalc'
import { useSwipeNav } from '../../hooks/useSwipeNav'
import {
  setPendingEnterFrom,
  consumePendingEnterFrom,
} from '../state/swipeTransition'
import { getPrevHold } from '../state/patrolPrevHold'
import {
  savePatrolReading,
  getLastReadingForBooth,
  classifyEntryType,
} from '../../services/patrolCore'
import { buildPrevFromRows } from '../../services/prevBaseline'
// J-PATROL-99_adhoc_ocr_preprocess_patrol_path-fix-05 (2026-05-30 ヒロ実機FB):
// fix-03 取りこぼし対応。本番巡回経路の resizeImageFile に preprocessForOcr 未適用
// → ヒロ実機で「写真白黒なってない」報告。grayscale + Otsu 二値化を適用。
import { preprocessForOcr } from '../../lib/ocrPreprocess'

// FIX2: booth_code から store_code を逆引き (prefix パターン)
// ABC01::suffix → ABC01 / ABC01-M01 → ABC01
function deriveStoreCode(boothCd) {
  if (!boothCd) return null
  if (/^[A-Z]{3}\d{2}::/.test(boothCd)) return boothCd.split('::')[0]
  const p = boothCd.split('-')
  return p.length >= 2 ? p[0] : null
}

// J-PATROL-OCR-CAMERA C: 撮影/選択画像を長辺 MAX px q QUALITY に縮小して {base64, blob} を返す
// fix-05: grayscale + コントラスト線形伸長 + Otsu 二値化 を canvas に適用、
// OCR 送信 base64 + プレビュー blob 双方が白黒化される。
// J-PATROL-99_adhoc_ocr_smaller_payload-fix-13 (2026-05-30 ヒロ承認):
// 1600px q0.85 → 800px q0.75 に縮小、ペイロード ~400KB → ~100KB に削減。
// iPhone 4G の OCR 送信時間短縮 (typical 2-4s → 0.5-1s)、6s timeout 内収まりを担保。
// 「保存もその解像度でいい」(ヒロ) のため、blob (= Storage 保存用) も同サイズ。
const OCR_MAX_EDGE = 800
const OCR_JPEG_QUALITY = 0.75
function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const sw = img.naturalWidth, sh = img.naturalHeight
      const scale = Math.min(1, OCR_MAX_EDGE / Math.max(sw, sh))
      const w = Math.round(sw * scale), h = Math.round(sh * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      // fix-05: in-place で preprocess、base64 + blob (= プレビュー画像) 双方に反映。
      const imageData = ctx.getImageData(0, 0, w, h)
      preprocessForOcr(imageData.data)
      ctx.putImageData(imageData, 0, 0)
      const base64 = canvas.toDataURL('image/jpeg', OCR_JPEG_QUALITY).split(',')[1]
      canvas.toBlob(blob => resolve({ base64, blob }), 'image/jpeg', OCR_JPEG_QUALITY)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
    img.src = url
  })
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
  const { state, pathname } = useLocation()
  const navigate     = useNavigate()
  const goBack       = useHierarchicalBack() // J-NAV-BACK-HIERARCHICAL-01
  const { staffId }  = useAuth()
  const { enabled: patrolEnabled } = useFeatureFlag('patrol_core')
  const { navigateNext, currentField, registerField, clearField } = useFieldNavigation()
  const activeTabindex = currentField?.dataTabindex ?? null

  function handleOutsideTap(e) {
    // HOTFIX-COLLECTION-DENOM-INPUT-DEAD-01 (D-052): dataTabindex 非付与フィールド保護 (F3 一貫性)
    if (e.target.closest('[data-numpad-field]')) return
    if (e.target.closest('[data-tabindex]')) return
    if (e.target.closest('[data-testid="numpad-footer"]')) return
    clearField()
  }

  const { machine, booth, storeCode, boothList, boothIndex } = state ?? {}
  const resolvedStoreCode = storeCode ?? machine?.store_code ?? null
  const isBeta = pathname.startsWith('/clawsupport/beta/')
  const setFocusBooth = usePatrolListScrollStore(s => s.setFocusBooth)
  const outMeterCount = machine?.machine_models?.out_meter_count ?? 1

  // OCR state
  const fileInputRef = useRef(null) // 読み取り写真の入力 (ギャラリー用、capture無し。iOSは「写真を撮る/選ぶ」メニュー)
  // SPEC-OCR-ANDROID-CAMERA-2BTN-HOTFIX-01 (D-082): Android14+ の Chrome フォトピッカー仕様変更で capture 無 input は
  // カメラ選択肢が消えギャラリー直行するため、カメラ直行用に capture=environment の別 input + 2ボタン選択を追加。
  const cameraInputRef = useRef(null)
  const [showOcrSource, setShowOcrSource] = useState(false)
  const [ocrState,      setOcrState]  = useState('idle') // 'idle' | 'loading' | 'confirming'
  const [ocrCapture,    setOcrCapture] = useState(null)  // { imageUrl, cols, photoUrl, avgConf }
  const [ocrLoadingImg, setOcrLoadingImg] = useState(null) // 解析中に上ゾーンへ表示する撮影画像URL
  const [ocrEditIn,     setOcrEditIn]  = useState('')
  const [ocrEditOut,    setOcrEditOut] = useState('')
  const [ocrEdited,     setOcrEdited]  = useState(false)
  const [ocrPhotoUrl,   setOcrPhotoUrl] = useState(null)
  const [ocrConfidence, setOcrConf]   = useState(null)
  const [ocrInputMethod,setOcrIM]     = useState('ocr')
  const [ocrError,      setOcrError]  = useState(null)
  const [ocrPhotoUploadFailed, setOcrPhotoUploadFailed] = useState(false)
  const { runOCR } = useOCR({ boothCode, orgId: DFX_ORG_ID })

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
  const [saveState, saveActions] = useSaveState()
  const [skipped,       setSkipped]   = useState(false)
  // J-STOCK-MACHINE-fix-03b: stock_movements 記録失敗時の非ブロッキングバナー (best-effort)
  const [stockMoveErr,  setStockMoveErr] = useState(null)
  const [showAlert,     setShowAlert] = useState(false)
  const [showBackConfirm, setShowBackConfirm] = useState(false)
  const [historyKey,    setHistoryKey] = useState(0)

  const touch = key => () => setTouched(t => ({ ...t, [key]: true }))

  useEffect(() => {
    // SPEC-PATROL-REPLACE-SWIPE-SAVE-FIX-01: IDB未syncレコード優先、Supabaseフォールバック。
    // replace後ブース再訪時、景品名等の変更が prev に反映されない問題の修正。
    async function fetchPrev() {
      // SPEC-PATROL-SWIPE-LATENCY-FIX-01: 3-tier IDB-first prev fetch。
      // tier-1: unsynced local edit (replace/edit correctness, unchanged)
      // tier-2: synced baseline from IDB → zero Supabase round-trip
      // tier-3: Supabase fallback (cold booth or IDB error)
      try {
        const idbRecords = await getPatrolRecordsByBooth(boothCode)
        // tier-1: unsynced (replace後ブース再訪でprev反映)
        const latestUnsynced = idbRecords
          .filter(r => !r.synced)
          .sort((a, b) => (b.read_time ?? '').localeCompare(a.read_time ?? ''))[0] ?? null
        if (latestUnsynced) {
          const defaults = latestUnsynced.defaultsFromPrev ?? {}
          const patch = latestUnsynced.optionalPatch ?? {}
          setPrev({
            ...defaults,
            ...patch,
            in_meter:            latestUnsynced.in_meter,
            out_meter:           latestUnsynced.out_meter,
            prize_stock_count:   latestUnsynced.prize_stock_count,
            prize_restock_count: latestUnsynced.prize_restock_count,
          })
          return
        }
        // tier-0: memory hold (SPEC-PATROL-SWIPE-LATENCY-FIX-03: microsecond, zero IDB/Supabase)
        // Only reached when latestUnsynced is null (unsynced correctness preserved above).
        const held = getPrevHold(boothCode)
        if (held) {
          setPrev(held)
          return
        }
        // tier-2: synced baseline from IDB (PatrolStorePage.fetchStoreBaselineRows が事前投入)。
        // SPEC-PATROL-PRIZE-PREFILL-REPLACE-VISIBLE-FIX-01 (D-094): IDB に patrol+replace が並存するため、
        // 単純な最新1行ではなく buildPrevFromRows で 景品=最新any / メーター=patrol を合成する。
        const syncedRows = idbRecords.filter(r => r.synced)
        const prevComposite = buildPrevFromRows(syncedRows)
        if (prevComposite) {
          setPrev(prevComposite)
          return
        }
      } catch (err) {
        logger.error?.('ERR-LF1-PREV-IDB', { boothCode, message: err?.message })
      }
      // tier-3: Supabase fallback (cold booth or IDB error)
      const supabasePrev = await getLastReadingForBooth(boothCode)
      setPrev(supabasePrev)
    }
    fetchPrev()
  }, [boothCode])

  useEffect(() => {
    // ブース切替(保存して次へ含む)時は入力済み判定/保存ステータスをリセット。
    // これをしないと前ブースの「変化なし/保存しました」が次ブースに残る。
    setTouched({ ...EMPTY_TOUCHED })
    setSkipped(false)
    saveActions.reset()
  }, [boothCode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!prev) return
    applyPrevFields(prev)
  }, [prev?.reading_id, boothCode]) // eslint-disable-line react-hooks/exhaustive-deps

  // J-PATROL: 未編集(グレー)の在庫欄を OUT入力にリアルタイム追従させ理論在庫を再計算。
  // 手入力(touched)された欄は上書きしない。保存時は在庫state(理論在庫 or 手入力)がそのまま確定。
  useEffect(() => {
    if (!prev) return
    if (!touched.stock) {
      const v = theoreticalStock(prev.prize_stock_count, prev.prize_restock_count, prev.out_meter, outMeter1)
      setStk(v != null ? String(v) : '')
    }
    if (!touched.stock2) {
      const v = theoreticalStock(prev.stock_2, prev.restock_2, prev.out_meter_2, outMeter2)
      setStk2(v != null ? String(v) : '')
    }
    if (!touched.stock3) {
      const v = theoreticalStock(prev.stock_3, prev.restock_3, prev.out_meter_3, outMeter3)
      setStk3(v != null ? String(v) : '')
    }
  }, [prev, outMeter1, outMeter2, outMeter3, touched.stock, touched.stock2, touched.stock3]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (touched.stock || !prev || outMeter1 === '') return
    const out_diff = Number(outMeter1) - Number(prev.out_meter ?? 0)
    const theoretical = (prev.prize_stock_count ?? 0) + (prev.prize_restock_count ?? 0) - out_diff
    if (theoretical >= 0) setStk(String(theoretical))
  }, [outMeter1, prev, touched.stock])

  const entryType = useMemo(
    () => classifyEntryType({
      prev,
      next: { inMeter, outMeter: outMeter1, prizeName, setA, setC, setL, setR, setO },
      isCollection: false,
    }),
    [prev, inMeter, outMeter1, prizeName, setA, setC, setL, setR, setO],
  )

  // 保存はINメーターのみ必須。OUT/在庫は任意。
  // 入替モード (entryType==='replace') は景品/設定変更のみでも保存可 → inMeter 空でも canSave=true。
  const canSave = patrolCanSave(inMeter) || entryType === 'replace'

  // SPEC-PATROL-SWIPE-NAV-fix-01 C2: dirty 判定。
  // canSave は inMeter が prev から prefill 済の時点で常に true、SWIPE-NAV-01 の swipe 暗黙保存
  // gate として canSave 単独では機能せず「未編集ブースを横スワイプするだけで空 IDB record を
  // 生成 → unsynced count 増殖」のバグになる (ヒロ実機検出)。実際の編集 (touched.inMeter /
  // outMeter1/2/3) を見て 'ユーザがメーター欄を触ったか' を厳密判定し、swipe 暗黙保存の唯一の
  // gate とする (spec の 'meter field changed from initial loaded value' 解釈)。touched は
  // boothCode 変更時に EMPTY_TOUCHED で reset 済 (line ~174) のため別途 mount/navigate reset 不要。
  const isDirty =
    !!touched.inMeter    ||
    !!touched.outMeter1  ||
    !!touched.outMeter2  ||
    !!touched.outMeter3  ||
    !!touched.prizeName  ||
    !!touched.prizeCost  ||
    !!touched.setA       ||
    !!touched.setC       ||
    !!touched.setL       ||
    !!touched.setR       ||
    !!touched.setO       ||
    !!touched.stock2     ||
    !!touched.restock2   ||
    !!touched.prizeName2 ||
    !!touched.prizeCost2 ||
    !!touched.stock3     ||
    !!touched.restock3   ||
    !!touched.prizeName3 ||
    !!touched.prizeCost3 ||
    !!touched.stock      ||
    !!touched.restock

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
    // OUT2 fields (stock/restock: empty→0 not null, matches patrolV2 semantics)
    if (touched.stock2)    patch.stock_2    = stock2 !== '' ? parseInt(stock2, 10) : 0
    if (touched.restock2)  patch.restock_2  = restock2 !== '' ? parseInt(restock2, 10) : 0
    if (touched.prizeName2) patch.prize_name_2 = prizeName2.trim() || null
    if (touched.prizeCost2) {
      const t = prizeCost2.trim()
      patch.prize_cost_2 = t === '' ? null : (Number.isFinite(parseInt(t, 10)) ? parseInt(t, 10) : null)
    }
    // OUT3 fields (stock/restock: empty→0 not null, matches patrolV2 semantics)
    if (touched.stock3)    patch.stock_3    = stock3 !== '' ? parseInt(stock3, 10) : 0
    if (touched.restock3)  patch.restock_3  = restock3 !== '' ? parseInt(restock3, 10) : 0
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

  // J-PATROL-OCR-CAMERA C: 「読み取り」→ファイル入力(iOSは撮る/選ぶメニュー)→縮小→OCR
  async function handleReadFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    logger.info('ocr_read_file_selected', { boothCode, size: file?.size ?? 0 })
    try {
      const { base64, blob } = await resizeImageFile(file)
      handleOCRCapture(base64, blob)
    } catch {
      const reader = new FileReader()
      reader.onload = ev => handleOCRCapture(ev.target.result.split(',')[1], file)
      reader.readAsDataURL(file)
    }
  }

  async function handleOCRCapture(base64, blob) {
    // fix-04: 解析中も同じ3分割レイアウトで撮影画像を上ゾーンに見せる
    const previewUrl = blob ? URL.createObjectURL(blob) : null
    setOcrLoadingImg(previewUrl)
    setOcrState('loading')
    setOcrError(null)
    setOcrPhotoUploadFailed(false)
    logger.info('ocr_photo_captured', { boothCode, blob_size: blob?.size ?? 0 })

    const result = await runOCR(base64, blob)

    // J-PATROL-99_adhoc_ocr_failure_inline_input-fix-04 (2026-05-30 ヒロ実機FB):
    // 旧: OCR 失敗時は loading 画面に「閉じる」ボタンだけ表示 → 手入力できなかった。
    // 新: 失敗時 (timeout / meters=[]) も confirming に遷移、IN/OUT 空欄+
    //     エラーバナー+numpad アクティブで「その場で手入力」を可能化。
    //     ヒロ要件「読み取り不可の場合その状態で手入力させる」を満たす。
    // J-PATROL-99_adhoc_ocr_haiku_lazy_upload-fix-12: uploadStorage は OCR 経路から
    // 排除済、ここでは保管のみ。実発火は handleOCRUse (= 「使う」ボタン押下後)。
    const uploadStorage = result?.uploadStorage ?? null

    if (!result || result.timeout) {
      setOcrCapture({ imageUrl: previewUrl, cols: { in_meter: null, out_meter: null }, photoUrl: null, avgConf: null, uploadStorage })
      setOcrEditIn('')
      setOcrEditOut('')
      setOcrEdited(false)
      setOcrError('6秒で読み取れませんでした。下のテンキーで手入力してください')
      setOcrState('confirming')
      return
    }

    const { meters: ocrMeters } = result

    if (!ocrMeters?.length) {
      // 同上: メーター検出ゼロ時も confirming で手入力可
      setOcrCapture({ imageUrl: previewUrl, cols: { in_meter: null, out_meter: null }, photoUrl: null, avgConf: null, uploadStorage })
      setOcrEditIn('')
      setOcrEditOut('')
      setOcrEdited(false)
      setOcrError('メーター数値を読み取れませんでした。下のテンキーで手入力してください')
      setOcrState('confirming')
      return
    }

    const cols = mapMetersToColumns(ocrMeters)
    const confList = ocrMeters.filter(m => typeof m.confidence === 'number')
    const avgConf = confList.length
      ? confList.reduce((s, m) => s + m.confidence, 0) / confList.length
      : null

    logger.info('ocr_result_returned', { confidence: avgConf })

    setOcrCapture({ imageUrl: previewUrl, cols, photoUrl: null, avgConf, uploadStorage })
    setOcrEditIn(cols.in_meter != null ? String(cols.in_meter) : '')
    setOcrEditOut(cols.out_meter != null ? String(cols.out_meter) : '')
    setOcrEdited(false)
    setOcrState('confirming')
  }

  function handleOCRUse() {
    if (!ocrCapture) return
    const { avgConf, uploadStorage } = ocrCapture
    const finalIn = ocrEditIn !== '' ? parseInt(ocrEditIn, 10) : null
    const finalOut = ocrEditOut !== '' ? parseInt(ocrEditOut, 10) : null
    logger.info('ocr_confirmation_use_clicked', { in: finalIn, out: finalOut, confidence: avgConf, edited: ocrEdited })
    if (finalIn != null) { setIn(String(finalIn)); setTouched(t => ({ ...t, inMeter: true })) }
    if (finalOut != null) { setOut1(String(finalOut)); setTouched(t => ({ ...t, outMeter1: true })) }
    // J-PATROL-99_adhoc_ocr_haiku_lazy_upload-fix-12: 「使う」が押された後に Storage upload を
    // 発火、結果が来たら setOcrPhotoUrl で audit に乗せる。fire-and-forget なので
    // 保存ボタンタップが先行しても 巡回 reading の保存自体は止めない。
    if (uploadStorage) {
      uploadStorage().then(up => {
        if (up?.url) {
          setOcrPhotoUrl(up.url)
          setOcrPhotoUploadFailed(false)
          logger.info('ocr_photo_uploaded_lazy', { photo_url: up.url })
        } else if (up?.uploadError) {
          setOcrPhotoUploadFailed(true)
          logger.error('ocr_photo_upload_error_lazy', { error: up.uploadError, code: 'ERR-OCR-PHOTO-001' })
        }
      }).catch(e => {
        setOcrPhotoUploadFailed(true)
        logger.error('ocr_photo_upload_throw_lazy', { error: e?.message ?? String(e), code: 'ERR-OCR-PHOTO-002' })
      })
    }
    setOcrPhotoUrl(null)
    setOcrConf(avgConf ?? null)
    // J-PATROL-99_adhoc_ocr_failure_inline_input-fix-04 (2026-05-30):
    // OCR が値を返さなかった (avgConf===null = timeout / no meters) ケースで
    // ユーザーが手入力した場合は input_method='ocr_failed' (observability.md 準拠)。
    // OCR が値を返した場合は従来通り 'ocr'。
    setOcrIM(avgConf == null ? 'ocr_failed' : 'ocr')
    setOcrState('idle')
    setOcrCapture(null)
    setOcrError(null)
    setOcrEditIn('')
    setOcrEditOut('')
    setOcrEdited(false)
  }

  function handleOCRRecapture() {
    logger.info('ocr_confirmation_recapture_clicked')
    setOcrCapture(null)
    setOcrError(null)
    setOcrEditIn('')
    setOcrEditOut('')
    setOcrEdited(false)
    setOcrState('idle')
    // D-082: 撮り直しも撮影/ギャラリー選択シート経由 (Android カメラ直行を担保)
    setShowOcrSource(true)
  }

  // J-PATROL-OCR-UNIFY-01-fix-01: 確認画面から手入力に戻る (OCR破棄)。
  function handleOCRCancel() {
    logger.info('ocr_confirmation_cancel_clicked')
    setOcrState('idle')
    setOcrCapture(null)
    setOcrError(null)
    setOcrEditIn('')
    setOcrEditOut('')
    setOcrEdited(false)
  }

  // J-STOCK-MACHINE-fix-03b: 巡回補充→machine_load / 入替→machine_unload+machine_load を
  // stock_movements に記録 (best-effort)。INSERT失敗は ERR-STOCK-010 バナー + Sentry のみ、
  // メーター保存本体はロールバックしない。prize_id は booths.current_prize_id 相当 (fix-03a同期)。
  async function recordBoothStockMovements() {
    const effectivePrizeId = selectedPrizeId ?? prev?.prize_id ?? null
    try {
      if (entryType === 'patrol') {
        const qty = parseInt(restock, 10)
        if (Number.isFinite(qty) && qty > 0) {
          await recordMachineLoad({ boothCode, prizeId: effectivePrizeId, quantity: qty, staffId, reason: 'patrol_supplement' })
        }
      } else if (entryType === 'replace') {
        // 入替前景品の引き上げ → 新景品セット の2レコード (collectionは対象外)
        await recordMachineUnload({ boothCode, prizeId: prev?.prize_id ?? null, staffId, reason: 'replace_unload' })
        await recordMachineLoad({ boothCode, prizeId: effectivePrizeId, quantity: 1, staffId, reason: 'replace_load' })
      }
    } catch (e) {
      logger.error('stock_movement_record_failed', { boothCode, entryType, code: ERR.STOCK_010, message: e?.message })
      Sentry.captureException(e, { tags: { errCode: ERR.STOCK_010, boothCode } })
      setStockMoveErr(ERR.STOCK_010)
    }
  }

  async function handleSave(onDone) {
    if (!patrolEnabled) {
      alert('patrol_core フラグが無効です。管理者に連絡してください。')
      return
    }
    if (!canSave) return
    // FIX2: store_code を resolvedStoreCode から確定。null の場合は booth_code prefix で逆引き。
    // 逆引き不能 (=真のデータ異常) は ERR-METER-003 でブロック。
    const effectiveStoreCode = resolvedStoreCode ?? deriveStoreCode(boothCode)
    if (!effectiveStoreCode) {
      logger.error?.('ERR-METER-003', { boothCode, hint: 'store_code 特定失敗' })
      saveActions.setError('ERR-METER-003', 'ブースコードから店舗コードを特定できません')
      return
    }
    const didStart = saveActions.setLoading()
    if (!didStart) return
    Sentry.addBreadcrumb({ category: 'user', message: `${entryType}_save`, data: { boothCode, entryType }, level: 'info' })
    logger.info('patrol_save_attempted', { boothCode, entryType, has_photo: !!ocrPhotoUrl })
    // SPEC-LF1-STORE-LOCAL-CACHE-01:
    // local-first 路線。Supabase 直書きはせず IndexedDB へ書いて即 navigate。
    // 同期 (Supabase upload) は店舗離脱時の uploadStoreRecords / とりま保存 button が担う。
    // 失敗時 (IDB quota など) は ERR ログ + ユーザー通知、navigation は走らせない。
    try {
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
      const optionalPatch = buildOptionalPatch()
      const numIn  = inMeter   !== '' && inMeter   != null ? parseFloat(inMeter)       : null
      const numOut = outMeter1 !== '' && outMeter1 != null ? parseFloat(outMeter1)     : null
      const numStk = stock     !== '' && stock     != null ? parseInt(stock, 10)       : 0
      const numRst = restock   !== '' && restock   != null ? parseInt(restock, 10)     : 0
      await putPatrolRecord({
        booth_code: boothCode,
        store_code: effectiveStoreCode,
        machine_code: machine?.machine_code ?? null,
        patrol_date: today,
        read_time: new Date().toISOString(),
        in_meter:  numIn,
        out_meter: numOut,
        prize_stock_count:   numStk,
        prize_restock_count: numRst,
        entry_type: entryType,
        source: 'manual',
        input_method: ocrInputMethod ?? 'manual',
        ...optionalPatch,
        // store-exit autosync 用に payload を保持
        optionalPatch,
        defaultsFromPrev: prev,
        created_by: staffId ?? null,
        synced: false,
      })
      notifyLfChange()
      // best-effort 在庫移動 (LF1 では従来通り即時 Supabase 書き)。
      // 巡回 UX 自体は IDB write 完了で即 navigate へ進めるため、ここは fire-and-forget。
      void recordBoothStockMovements().catch(() => {})
      saveActions.setSuccess()
      setHistoryKey(k => k + 1)
      // SPEC-LF1 AC-02 / AC-01: setTimeout 削除、即 navigate。
      if (onDone) onDone(); else navigate(-1)
    } catch (e) {
      logger.error('patrol_save_failed_unexpected', { message: e?.message, boothCode })
      saveActions.setError(e?.code ?? 'ERR-UNKNOWN', e?.message ?? '保存に失敗しました')
    }
    void savePatrolReading // SPEC-LF1: 旧 Supabase 直書き経路は storeSync が再利用 (import 維持)
    void setSkipped       // skipped 経路は LF2 で同期判定に統合
  }

  // 次ブース (リストのフラット順)。最後なら null。
  const nextBoothEntry =
    Array.isArray(boothList) && boothIndex != null && boothIndex >= 0
      ? (boothList[boothIndex + 1] ?? null)
      : null

  // SPEC-PATROL-SWIPE-NAV-01: 前ブース。boothList は PatrolStorePage で
  // machines.flatMap(m => m.booths) で構築されるため、index-1 で前ブース、
  // 機械を跨いでの戻りも自然にサポート。
  const prevBoothEntry =
    Array.isArray(boothList) && boothIndex != null && boothIndex > 0
      ? (boothList[boothIndex - 1] ?? null)
      : null

  function goBackToList() {
    // 展開状態を維持したまま、次ブース(無ければ現ブース)が見える位置へ復帰
    if (resolvedStoreCode) {
      setFocusBooth(resolvedStoreCode, nextBoothEntry?.booth?.booth_code ?? boothCode)
      navigate(`/clawsupport/${isBeta ? 'beta/' : ''}store/${resolvedStoreCode}`)
    } else {
      navigate(-1)
    }
  }

  function goNextBooth() {
    if (nextBoothEntry) {
      navigate(`/clawsupport/${isBeta ? 'beta/' : ''}booth/${nextBoothEntry.booth.booth_code}`, {
        state: {
          machine: nextBoothEntry.machine,
          booth: nextBoothEntry.booth,
          storeCode: resolvedStoreCode,
          boothList,
          boothIndex: boothIndex + 1,
        },
      })
    } else {
      goBackToList()
    }
  }

  // SPEC-PATROL-SWIPE-NAV-01: 前ブースへ navigate。前が無ければ no-op (AC-04)。
  function goPrevBooth() {
    if (!prevBoothEntry) return
    navigate(`/clawsupport/${isBeta ? 'beta/' : ''}booth/${prevBoothEntry.booth.booth_code}`, {
      state: {
        machine: prevBoothEntry.machine,
        booth: prevBoothEntry.booth,
        storeCode: resolvedStoreCode,
        boothList,
        boothIndex: boothIndex - 1,
      },
    })
  }

  const handleSaveNext = () => handleSave(goNextBooth)
  const handleSaveList = () => handleSave(goBackToList)

  // FIX5b: ブース初期化 useEffect と handleReset の共通ヘルパー。
  // p=null (新規ブース) は全フィールド空クリア、p 有りは pre-populate 値を復元。
  function applyPrevFields(p) {
    if (!p) {
      setIn(''); setOut1(''); setOut2(''); setOut3('')
      setStk(''); setRst('')
      setPrize(''); setCost('')
      setStk2(''); setRst2(''); setPrize2(''); setCost2('')
      setSelectedPrizeId2(null)
      setStk3(''); setRst3(''); setPrize3(''); setCost3('')
      setSelectedPrizeId3(null)
      setSetA(''); setSetC(''); setSetL(''); setSetR(''); setSetO('')
      setSelectedPrizeId(null)
      return
    }
    setIn(p.in_meter != null ? String(p.in_meter) : '')
    setOut1(p.out_meter != null ? String(p.out_meter) : '')
    setOut2(p.out_meter_2 != null ? String(p.out_meter_2) : '')
    setOut3(p.out_meter_3 != null ? String(p.out_meter_3) : '')
    const t1 = theoreticalStock(p.prize_stock_count, p.prize_restock_count, p.out_meter, p.out_meter)
    setStk(t1 != null ? String(t1) : '')
    setRst('')
    setPrize(p.prize_name ?? '')
    const pc = p.prize_cost ?? p.prize_cost_1
    setCost(pc != null && pc !== '' ? String(pc) : '')
    const t2 = theoreticalStock(p.stock_2, p.restock_2, p.out_meter_2, p.out_meter_2)
    setStk2(t2 != null ? String(t2) : '')
    setRst2('')
    setPrize2(p.prize_name_2 ?? '')
    setCost2(p.prize_cost_2 != null ? String(p.prize_cost_2) : '')
    setSelectedPrizeId2(null)
    const t3 = theoreticalStock(p.stock_3, p.restock_3, p.out_meter_3, p.out_meter_3)
    setStk3(t3 != null ? String(t3) : '')
    setRst3('')
    setPrize3(p.prize_name_3 ?? '')
    setCost3(p.prize_cost_3 != null ? String(p.prize_cost_3) : '')
    setSelectedPrizeId3(null)
    setSetA(p.set_a ?? '')
    setSetC(p.set_c ?? '')
    setSetL(p.set_l ?? '')
    setSetR(p.set_r ?? '')
    setSetO(p.set_o ?? '')
    setSelectedPrizeId(null)
  }

  // FIX5b: 空クリアではなく画面オープン時の pre-populate 値に復元する。
  // touched=EMPTY_TOUCHED → isDirty=false → スワイプ/戻るで「変更なし」扱いになり空保存を防ぐ。
  function handleReset() {
    applyPrevFields(prev)
    setTouched({ ...EMPTY_TOUCHED })
  }

  // SPEC-PATROL-SWIPE-NAV-01 C2 + SPEC-PATROL-SWIPE-ANIM-01: 横スワイプ → アニメ → 暗黙保存 → navigate。
  // 左スワイプ=次ブース、右スワイプ=前ブース。canSave 偽 (= IN 未入力等) なら保存スキップで navigate のみ。
  // 末端 (最初の前 / 最後の次) では no-op で spring back (AC-04)。OCR overlay 中は無効化。
  //
  // ANIM-01:
  // - swipeDx: touchmove 中の指 dx (px)、live で transform: translateX に反映 (follow-finger)
  // - swipeTransition: CSS transition 文字列。drag 中は 'none'、commit/cancel で 220ms ease-out
  // - 入場アニメ: consumePendingEnterFrom() で前画面の遷移方向を読取、初期 dx を ±innerWidth に置いて
  //   useLayoutEffect で次フレームに 0 へ transition (entering panel slides in)
  const [swipeDx, setSwipeDx] = useState(() => {
    if (typeof window === 'undefined') return 0
    const enter = consumePendingEnterFrom()
    if (enter === 'right') return  window.innerWidth   // 次画面が右側から
    if (enter === 'left')  return -window.innerWidth   // 前画面が左側から
    return 0
  })
  const [swipeTransition, setSwipeTransition] = useState('none')

  // 入場アニメーション: 初期 dx が非ゼロなら、次フレームで 0 へ transition (220ms ease-out)
  useEffect(() => {
    if (swipeDx === 0) return
    const t = requestAnimationFrame(() => {
      setSwipeTransition('transform 220ms ease-out')
      setSwipeDx(0)
    })
    return () => cancelAnimationFrame(t)
    // 初回 mount のみ意図、boothCode が変わって新規 mount された時もここを通る
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function springBack() {
    setSwipeTransition('transform 220ms ease-out')
    setSwipeDx(0)
  }

  function commitSwipeAndNavigate(direction, navFn) {
    // direction: 'left' or 'right' (exit 方向)
    const w = typeof window !== 'undefined' ? window.innerWidth : 360
    setSwipeTransition('transform 220ms ease-out')
    setSwipeDx(direction === 'left' ? -w : w)
    // 次画面の入場方向を予約 (左退場 → 次画面は右から、右退場 → 次画面は左から)
    setPendingEnterFrom(direction === 'left' ? 'right' : 'left')
    // 220ms 後に navigate (+ 必要なら save)。LF1 save は IDB write のみで実時間 <10ms、
    // ここの timeout を待っても UX 影響なし (AC-06 LF1 <1s 保持)。
    //
    // FIX1: isDirty gate を削除。canSave のみでスワイプ保存 (IDB/prev pre-populate 済の値も保存)。
    // 旧: isDirty && canSave → 未编集扱いでスワイプしても保存されなかった (probe h1 根本原因)。
    // C3 (SPEC-PATROL-BOOTH-BACK-SAVE-CONFIRM-01): isDirty gate 復活。stock/restock 含む C4 修正後は
    // 未編集スワイプで不要保存が発生しないよう isDirty を再付与 (canSave は inMeter prefill で常 true)。
    setTimeout(() => {
      if (isDirty && canSave) handleSave(navFn)
      else navFn()
    }, 220)
  }

  function handleSwipeLeft() {
    if (!nextBoothEntry) {
      // SPEC-PATROL-SWIPE-NAV-fix-02: 最後の機械の最後のブースで左スワイプ →
      // 旧 no-op (spring back) ではなく goBackToList で店舗リストへ戻る。
      // isDirty && canSave なら save してから戻る (他 swipe 経路と同一の暗黙保存挙動)。
      // navigate(-1) の代わりに goBackToList を使う理由: 既存 hierarchical
      // navigation の '次ブース focus + 店舗リスト' 動線と統一でき、navigate(-1) で
      // 履歴遷移の予測不能性 (ログイン履歴等) を回避できる。
      commitSwipeAndNavigate('left', goBackToList)
      return
    }
    commitSwipeAndNavigate('left', goNextBooth)
  }
  function handleSwipeRight() {
    if (!prevBoothEntry) return springBack()  // 末端: spring back
    commitSwipeAndNavigate('right', goPrevBooth)
  }
  const swipeRef = useSwipeNav({
    onSwipeLeft:  handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    onSwipeProgress: (dx) => {
      // SPEC-PATROL-SWIPE-ANIM-01 C2: drag 中は transition なしで dx を直接反映
      setSwipeTransition('none')
      setSwipeDx(dx)
    },
    onSwipeCancel: springBack,
    enabled: ocrState === 'idle',  // OCR overlay 中はスワイプ無効
  })

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

  // J-PATROL-OCR-CONFIRM-LAYOUT-01 fix-05: loading と confirming で同一の上ゾーンJSX (TransformWrapper, initialScale=1, w-full h-auto)
  function renderOcrImageZone(url) {
    return (
      <div className="h-[33dvh] flex-none overflow-hidden bg-black">
        {url ? (
          <TransformWrapper initialScale={1} minScale={1} maxScale={6} doubleClick={{ mode: 'zoomIn' }}>
            <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%' }}>
              <img src={url} alt="OCR撮影" className="w-full h-auto" />
            </TransformComponent>
          </TransformWrapper>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs">画像なし</div>
        )}
      </div>
    )
  }

  // === OCR loading: confirming と同じ3分割レイアウトを流用 (fix-04/05) ===
  if (ocrState === 'loading') {
    return (
      <div className="fixed inset-x-0 top-0 h-[100dvh] z-50 bg-black flex flex-col overflow-hidden">
        {renderOcrImageZone(ocrLoadingImg)}
        {/* zone_middle: 解析中スピナーをIN/OUTエリアに重ねる (画像には暗転無し) or エラー */}
        <div className="h-[31dvh] flex-none overflow-y-auto bg-bg px-3 pt-2 pb-2">
          {ocrError ? (
            <div className="flex flex-col gap-2">
              <div className="text-red-400 text-sm font-bold">{ocrError}</div>
              <button
                type="button"
                onClick={() => { setOcrError(null); setOcrState('idle') }}
                className="py-2 bg-gray-700 text-white font-bold text-sm rounded-xl min-h-[44px]"
              >
                閉じる
              </button>
            </div>
          ) : (
            <div className="relative rounded-xl border border-border bg-surface/60 p-2">
              <div className="text-xs font-bold text-muted mb-1">解析中…</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted mb-0.5">IN</div>
                  <div className="h-8 rounded-lg bg-surface" />
                </div>
                <div>
                  <div className="text-xs text-muted mb-0.5">OUT</div>
                  <div className="h-8 rounded-lg bg-surface" />
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full" />
              </div>
            </div>
          )}
        </div>
        {/* zone_bottom: テンキー グレーアウト (操作不可) */}
        <div className="h-[36dvh] flex-none shrink-0 flex flex-col overflow-hidden pointer-events-none opacity-50">
          <NumpadFooterPanel currentField={null} />
        </div>
      </div>
    )
  }

  // === OCR confirmation screen (editable IN/OUT) ===
  if (ocrState === 'confirming' && ocrCapture) {
    const { imageUrl, photoUrl, avgConf } = ocrCapture
    const confPct = avgConf != null ? Math.round(avgConf * 100) : null
    const confCls = confPct == null ? 'text-muted' : confPct >= 90 ? 'text-green-400' : confPct >= 70 ? 'text-yellow-400' : 'text-red-400'
    // J-PATROL-OCR-CONFIRM-LAYOUT-01: 前回値との差分 (IN差/OUT差 チップ)
    const ocrInDiff = prev?.in_meter != null && ocrEditIn !== '' ? Number(ocrEditIn) - Number(prev.in_meter) : null
    const ocrOutDiff = prev?.out_meter != null && ocrEditOut !== '' ? Number(ocrEditOut) - Number(prev.out_meter) : null
    // J-PATROL-OCR-CONFIRM-LAYOUT-01 fix-02: 3分割 (上33vh画像窓枠 / 中25vh値+ボタン / 下42vhテンキー safe-area)
    return (
      <div className="fixed inset-x-0 top-0 h-[100dvh] z-50 bg-black flex flex-col overflow-hidden">
        {/* zone_top: loading と共有 (fix-05) */}
        {renderOcrImageZone(imageUrl)}
        {/* zone_middle: 読取値 + 差分 + 使う/撮り直す/✕ 25vh (圧縮、テンキーは置かない) */}
        <div className="h-[31dvh] flex-none overflow-y-auto bg-bg px-3 pt-2 pb-2">
          {/* SPEC-PATROL-BOOTH-LABEL-VISIBILITY-01 R2: スワイプミスで別ブースを撮った時に気づける */}
          <div className="text-xs text-muted mb-1 truncate" data-testid="ocr-confirm-booth-label">{boothLabel}</div>
          {/* J-PATROL-99_adhoc_ocr_failure_inline_input-fix-04: OCR 失敗時の inline 案内バナー。
              ocrCapture.avgConf === null は OCR が値を出してない (timeout / no meters)、
              ocrError 文言を表示しつつ confirming UI と numpad はそのまま使える。 */}
          {ocrError && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-2 mb-2 text-red-300 text-xs font-bold">
              {ocrError}
            </div>
          )}
          <div className="rounded-xl border border-border bg-surface/60 p-2 mb-2">
            <div className="text-xs font-bold text-muted mb-1">
              {avgConf == null ? 'OCR失敗 — テンキーで手入力してください' : 'OCR認識値 — タップして修正可'}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-1">
              <div>
                <div className="text-xs text-muted mb-0.5">IN</div>
                <div className={`rounded-lg transition-all ${activeTabindex === 91 ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
                  <NumpadField
                    id="ocr-confirm-in"
                    value={ocrEditIn}
                    onChange={v => { setOcrEdited(true); setOcrEditIn(v); logger.info('ocr_confirmation_value_edited', { field: 'in_meter' }) }}
                    label="IN"
                    allowDecimal={false}
                    dataTabindex={91}
                    onRegister={registerField}
                    isActive={activeTabindex === 91}
                    style={{ fontSize: 18, width: '100%', fontWeight: 'bold' }}
                    testId="ocr-confirm-in"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-muted mb-0.5">OUT</div>
                <div className={`rounded-lg transition-all ${activeTabindex === 92 ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
                  <NumpadField
                    id="ocr-confirm-out"
                    value={ocrEditOut}
                    onChange={v => { setOcrEdited(true); setOcrEditOut(v); logger.info('ocr_confirmation_value_edited', { field: 'out_meter' }) }}
                    label="OUT"
                    allowDecimal={false}
                    dataTabindex={92}
                    onRegister={registerField}
                    isActive={activeTabindex === 92}
                    style={{ fontSize: 18, width: '100%', fontWeight: 'bold' }}
                    testId="ocr-confirm-out"
                  />
                </div>
              </div>
            </div>
            {/* 信頼度 + 差分バッジを1行に集約 */}
            <div className="text-xs text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>信頼度: <span className={confCls}>{confPct != null ? `${confPct}%` : '—'}</span></span>
              {ocrEdited && <span className="text-amber-400">修正済み</span>}
              {ocrInDiff != null && (
                <span className={`font-bold px-2 py-0.5 rounded ${ocrInDiff >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>IN差 {ocrInDiff >= 0 ? '+' : ''}{ocrInDiff}</span>
              )}
              {ocrOutDiff != null && (
                <span className={`font-bold px-2 py-0.5 rounded ${ocrOutDiff >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>OUT差 {ocrOutDiff >= 0 ? '+' : ''}{ocrOutDiff}</span>
              )}
            </div>
          </div>
          {/* 使う / 撮り直す / ✕ (1行、パディング圧縮) */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleOCRUse}
              className="flex-[2] py-2 bg-blue-600 text-white font-bold text-sm rounded-xl min-h-[44px]"
            >
              使う
            </button>
            <button
              type="button"
              onClick={handleOCRRecapture}
              className="flex-1 py-2 border-2 border-border text-text font-bold text-sm rounded-xl min-h-[44px]"
            >
              撮り直す
            </button>
            <button
              type="button"
              onClick={handleOCRCancel}
              aria-label="閉じる"
              className="flex-none w-[48px] py-2 border-2 border-border text-text font-bold text-lg rounded-xl min-h-[44px] flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>
        {/* zone_bottom: テンキー 固定領域。
            J-COLLECTION-12 R5 + ad-hoc 2026-05-29: カスタムテンキー有効時のみ wrapper も拡張 (倍化に対応)。
            カスタムテンキー無効時は NumpadFooterPanel が null を返すので wrapper は 0 高 (h-0)。
            iPad/PC は元々 isIPhone() で footer 非表示、本フラグ反映後も挙動不変。
            SPEC-MOTION-W1_5-NUMPAD-PATROL-ADMIN-01 (D-070) F2: 主フッターを NumpadFooterSlot 化
            (grid-rows transition + scrollIntoView)。L855 null固定 / L1108 別配置は不変。 */}
        <NumpadFooterSlot currentField={currentField} />
      </div>
    )
  }

  // === Main patrol form ===
  return (
    <div
      ref={swipeRef}
      onPointerDown={handleOutsideTap}
      className="grid h-svh bg-bg text-text overflow-x-hidden overflow-y-hidden relative min-w-0"
      data-testid="patrol-booth-swipe-container"
      style={{
        gridTemplateRows: 'auto auto auto 1fr auto',
        minHeight: 0,
        // SPEC-MOTION-W1_8-PATROL-PARENT-TRANSFORM-GATE-01 (D-079) C1: transform/willChange を swipeDx!==0 時のみ出力。
        // 真因 = swipeDx=0(通常時)でも translateX(0px)+willChange:transform を常時出すと親が containing block /
        // 合成レイヤを作り、iOS Safari で子孫 (NumpadFooterSlot/Collapse) の高さ transition を合成抑制していた
        // (集金親は transform 無し = ぬるっと動く、の差分で確定)。dx=0 で transform 無しは集金親と同条件・視覚差ゼロ。
        // スワイプ追従/入退場/springBack (dx 非ゼロ) は従来通り transform 適用 = swipe ロジック非破壊。
        transform: swipeDx !== 0 ? `translateX(${swipeDx}px)` : undefined,
        transition: swipeTransition,
        willChange: swipeDx !== 0 ? 'transform' : undefined,
      }}
    >
      {/* SPEC-OCR-ANDROID-CAMERA-2BTN-HOTFIX-01 (D-082): 撮影(capture=environment=カメラ直行)/ギャラリー(capture無)の
          2入力に分離。onChange は共に handleReadFile 共用。display:none は input 自身に直接付与 (親 div 不可=iOS Safari
          change 未発火事故回避、SPEC-UI iOS ルール)。 */}
      <input
        ref={cameraInputRef}
        data-testid="ocr-camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleReadFile}
      />
      {/* J-PATROL-OCR-CAMERA C: ギャラリー入力 (capture無し)。iOSは従来通り「撮る/選ぶ」メニュー、Androidはギャラリー */}
      <input
        ref={fileInputRef}
        data-testid="ocr-gallery-input"
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleReadFile}
      />
      {showOcrSource && (
        <div
          data-testid="ocr-source-picker"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setShowOcrSource(false)}
        >
          <div
            className="w-full max-w-md bg-surface border-t border-border p-4 pb-8 rounded-t-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center text-xs text-muted mb-3">読み取り画像の取得方法</div>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                data-testid="ocr-source-camera"
                onClick={() => { setShowOcrSource(false); cameraInputRef.current?.click() }}
                className="flex-1 max-w-[180px] bg-blue-600 text-white font-bold py-4 px-2 rounded-xl text-[15px] flex flex-col items-center gap-1 min-h-[44px] border-none"
              >
                <span className="text-[28px]">📸</span>
                <span>撮影する</span>
              </button>
              <button
                type="button"
                data-testid="ocr-source-gallery"
                onClick={() => { setShowOcrSource(false); fileInputRef.current?.click() }}
                className="flex-1 max-w-[180px] bg-surface2 border-2 border-border text-text font-bold py-4 px-2 rounded-xl text-[15px] flex flex-col items-center gap-1 min-h-[44px]"
              >
                <span className="text-[28px]">🖼️</span>
                <span>ギャラリー</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <PageHeader
        module="clawsupport"
        title={boothLabel}
        variant="compact"
        onBack={() => { if (!isDirty) goBack(); else setShowBackConfirm(true) }}

      />

      <div className="px-4 flex items-center gap-2">
        <EntryTypeBadge type={entryType} />
        {booth && (
          <span
            data-testid="booth-number-badge"
            className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-surface border-border text-muted"
          >
            ブース {booth.booth_number}
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowAlert(true)}
          className="text-xs font-bold text-amber-400/90 bg-amber-400/10 border border-amber-400/20 rounded-lg px-2 py-0.5 active:opacity-60"
        >
          📝 気づき
        </button>
        {/* FIX5: リセットボタン [A] input-density: text-xs, 即クリア, 確認なし */}
        <button
          type="button"
          data-testid="reset-form-button"
          onClick={handleReset}
          className="ml-auto text-xs text-muted border border-border rounded px-2 py-0.5 active:opacity-60"
        >
          リセット
        </button>
      </div>

      <div>
        {saveState.status === 'error' && (
          <ErrorBanner
            errCode={saveState.errCode}
            message={saveState.errMessage}
            onClose={saveActions.reset}
            onRetry={handleSave}
          />
        )}
        {ocrPhotoUploadFailed && (
          <div className="mx-4 mb-3 rounded-xl bg-red-950/50 border border-red-500/40 px-4 py-2" data-testid="ocr-photo-upload-failed-banner">
            <span className="text-xs font-mono font-bold text-red-400">証拠写真のUPに失敗しました</span>
          </div>
        )}
        {stockMoveErr && (
          <div className="mx-4 mb-3 rounded-xl bg-amber-950/50 border border-amber-500/40 px-4 py-2">
            <span className="text-xs font-mono font-bold text-amber-400">{stockMoveErr}</span>
            <span className="text-xs text-amber-200 ml-2">在庫移動の記録に失敗 (メーター保存は完了)</span>
          </div>
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
          entryType={entryType}
          inDiffDisp={inDiffDisp} outDiffDisp={outDiffDisp}
          navigateNext={navigateNext} registerField={registerField} activeTabindex={activeTabindex}
          onClearField={clearField}
          canSave={canSave} saving={savingProp} result={resultProp} onSave={handleSave}
          onSaveNext={handleSaveNext} onSaveList={handleSaveList}
          onOCR={() => { logger.info('ocr_button_pressed', { booth_code: boothCode, source: 'picker' }); setShowOcrSource(true) }}
        />
      </div>

      <div className="min-h-0 overflow-y-auto px-4" data-testid="booth-history-outside-panel">
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
      </div>
      {/* SPEC-MOTION-W1_6-NUMPAD-PATROL-MAINFORM-SLOT-01 (D-076) C1: Main patrol form の日常フッター。
          旧 hidden↔flex 即時トグル (display:none からは transition 発火不能) を NumpadFooterSlot に置換し
          grid-rows 0fr↔1fr の 200ms transition に一本化。D-075 で「巡回パッと出る」の実フッターと確定した箇所。 */}
      <NumpadFooterSlot currentField={currentField} />

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

      {showBackConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowBackConfirm(false)}
          data-testid="back-confirm-overlay"
        >
          <div
            className="w-full max-w-lg bg-bg border-t border-border rounded-t-2xl p-5 pb-8 space-y-4"
            onClick={e => e.stopPropagation()}
            data-testid="back-confirm-dialog"
          >
            <div className="text-sm font-bold text-center">保存しますか？</div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowBackConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-border text-sm text-muted"
                data-testid="back-confirm-cancel"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => { setShowBackConfirm(false); goBack() }}
                className="flex-1 min-h-[44px] py-3 rounded-xl border border-border text-sm text-muted"
                data-testid="back-confirm-discard"
              >
                保存せず戻る
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={() => { setShowBackConfirm(false); handleSave(goBack) }}
                className="flex-1 min-h-[44px] py-3 rounded-xl bg-blue-600 text-white font-bold text-sm disabled:opacity-40"
                data-testid="back-confirm-save"
              >
                保存して戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
