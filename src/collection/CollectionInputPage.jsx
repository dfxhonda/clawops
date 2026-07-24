import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import NumpadField from '../clawsupport/components/NumpadField'
import NumpadFooterSlot from '../clawsupport/components/NumpadFooterSlot'
import Collapse from '../components/Collapse'
import {
  getActiveStores, getActiveBoothsForStore, getPrevCollectionMeters,
  saveCollection, getCollectionDetail,
  nextCollectionId, uploadReceiptPhoto,
  uploadCustomerSignature, deleteReceiptPhoto, // COLLECTION-SIGNATURE-REDESIGN-01 R1 / J-COLLECTION-09 fix_4
} from '../services/collections'
import { DENOMINATIONS, boothTotal } from './lib/collectionCalc'
import { buildCollectionSlip, slipFileName, ensureJpFont } from './lib/collectionPdf'
import { compressImage } from './lib/imageUtil'
import SignatureCanvas, { SIGNATURE_MIN_POINTS } from './components/SignatureCanvas' // J-COLLECTION-07 fix_1 / J-COLLECTION-12 R3-R4
import StorePickerSheet from '../components/StorePickerSheet'

// J-COLLECTION-05: PDF改修+署名+レシート写真+前回IN修正
// fix_A PDFヘッダ/注意書き  fix_B 署名Canvas  fix_C レシート撮影+upload
// fix_D PDF page2+ レシートページ  fix_E 前回IN=patrol_date>=prev_date ASC最古

const yen = n => Number(n || 0).toLocaleString()
const todayJst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
const numOrNull = v => (v === '' || v == null ? null : Number(v))
const diff = (cur, prev) => {
  const c = numOrNull(cur), p = numOrNull(prev)
  if (c == null || p == null) return null
  return c - p
}

function emptyRow(b) {
  return {
    in_meter_prev: b.in_meter_prev_default != null ? String(b.in_meter_prev_default) : '',
    in_meter_current: b.in_meter_current_default != null ? String(b.in_meter_current_default) : '',
    advance_payment: '',
    notes: '',
    counts: {},
    receipt_photo_url: null,
    receipt_photo_path: null,
    _prefilled_current: b.in_meter_current_default != null ? String(b.in_meter_current_default) : '',
  }
}

const COLS = [
  { key: 'rental_code',       label: 'レンタル', w: 72 },
  { key: 'machine_name',      label: '機械名',   w: 120 },
  { key: 'booth_name',        label: 'ブース',   w: 80 },
  { key: 'in_meter_prev',     label: '前回IN',   w: 90 },
  { key: 'in_meter_current',  label: '今回IN',   w: 90 },
  { key: 'in_diff',           label: '差',       w: 64 },
  { key: 'machine_sub',       label: '機械計',   w: 64 },
  { key: 'collection_amount', label: '集金額',   w: 96 },
  { key: 'advance_payment',   label: '立替',     w: 72 },
  { key: 'notes',             label: '備考',     w: 72 },  /* J-COLLECTION-12 ad-hoc-2: 立替と同幅 (120→72) */
  { key: 'receipt',           label: 'レシート', w: 56 },
]
const TABLE_MIN_WIDTH = COLS.reduce((s, c) => s + c.w, 0)

const cellInputStyle = { width: '100%', height: '36px', fontSize: 12, padding: '0 4px', textAlign: 'right' }
const denomInputStyle = { width: '60px', height: '32px', fontSize: 12, padding: '0 4px', textAlign: 'right' }

export default function CollectionInputPage() {
  const navigate = useNavigate()
  const { staffId, staffName } = useAuth()

  const [stores, setStores] = useState([])
  const [storeCode, setStoreCode] = useState('')
  const [collectedAt, setCollectedAt] = useState(todayJst())
  const [prevDate, setPrevDate] = useState('')
  const [booths, setBooths] = useState([])
  const [rowData, setRowData] = useState({})
  const [collectionId, setCollectionId] = useState(null) // J-COLLECTION-05: 事前生成
  const [customerSignatureData, setCustomerSignatureData] = useState(null) // COLLECTION-SIGNATURE-REDESIGN-01 R1: 先方サイン
  const [openDenom, setOpenDenom] = useState(null)
  const [currentField, setCurrentField] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingBooth, setUploadingBooth] = useState(null)
  const [confirmedId, setConfirmedId] = useState(null)
  const [error, setError] = useState(null)
  const [generatingPdf, setGeneratingPdf] = useState(false) // J-COLLECTION-11 fix_B
  const generatingPdfRef = useRef(false) // 同期 ref ロック (state batching を待たない)
  const signatureCanvasRef = useRef(null)
  // J-COLLECTION-12 R3: 2段ボタン状態。
  //   'idle' = SignatureCanvas 非表示、フッタボタンは「サイン」disabled→tap で 'drawing' へ
  //   'drawing' = SignatureCanvas 表示中、point < threshold は「サイン」disabled、>= は「確定」enabled
  const [signStage, setSignStage] = useState('idle')
  const [signaturePoints, setSignaturePoints] = useState(0)
  // J-COLLECTION-12 R2: レシート削除確認ダイアログ対象 (boothCode|null)
  const [pendingDeleteBooth, setPendingDeleteBooth] = useState(null)
  // SPEC-COLLECTION-RECEIPT-CONFIRM-VIEW-01: レシート確認モーダル対象ブース (boothCode|null)
  const [receiptConfirmBooth, setReceiptConfirmBooth] = useState(null)

  // 隠しfile input (booth毎に動的ref)
  const fileInputs = useRef({})

  useEffect(() => {
    getActiveStores().then(({ data, error: e }) => {
      if (e) { setError(`ERR-COLLECTION-001: ${e.message}`); return }
      setStores(data ?? [])
    })
  }, [])

  async function handleLoad() {
    if (!storeCode) return
    setLoading(true); setError(null); setLoaded(false); setConfirmedId(null); setCustomerSignatureData(null)
    // J-COLLECTION-12 R3: 店舗再読み込み時はサインステージも初期化
    setSignStage('idle'); setSignaturePoints(0)
    const { data, error: e } = await getActiveBoothsForStore(storeCode, collectedAt, prevDate || null)
    if (e) { setError(`ERR-COLLECTION-001: ${e.message}`); setLoading(false); return }
    const rd = Object.fromEntries((data ?? []).map(b => [b.booth_code, emptyRow(b)]))
    if (prevDate) {
      const { data: prevMap, error: e2 } = await getPrevCollectionMeters(storeCode, prevDate)
      if (e2) { setError(`ERR-COLLECTION-004: ${e2.message}`); setLoading(false); return }
      for (const b of data ?? []) {
        const p = prevMap?.[b.booth_code]
        if (p && p.in_meter_prev != null) rd[b.booth_code].in_meter_prev = String(p.in_meter_prev)
      }
    }
    // collectionId 事前生成 (レシート upload pathに使う)
    const cid = await nextCollectionId(storeCode, collectedAt)
    setCollectionId(cid)
    setBooths(data ?? [])
    setRowData(rd)
    setLoaded(true); setLoading(false)
  }

  // fix_4: 集金日変更時、未編集の今回IN を再プリフィル
  useEffect(() => {
    if (!loaded || !storeCode || !collectedAt) return
    let cancelled = false
    ;(async () => {
      const { data } = await getActiveBoothsForStore(storeCode, collectedAt, prevDate || null)
      if (cancelled || !data) return
      setBooths(data)
      setRowData(prev => {
        const next = { ...prev }
        for (const b of data) {
          const cur = next[b.booth_code]
          if (!cur) { next[b.booth_code] = emptyRow(b); continue }
          const newDefault = b.in_meter_current_default != null ? String(b.in_meter_current_default) : ''
          if (cur.in_meter_current === cur._prefilled_current) {
            next[b.booth_code] = { ...cur, in_meter_current: newDefault, _prefilled_current: newDefault }
          } else {
            next[b.booth_code] = { ...cur, _prefilled_current: newDefault }
          }
          if (!cur.in_meter_prev && b.in_meter_prev_default != null) {
            next[b.booth_code].in_meter_prev = String(b.in_meter_prev_default)
          }
        }
        return next
      })
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectedAt])

  const setRow = (boothCode, patch) =>
    setRowData(prev => ({ ...prev, [boothCode]: { ...prev[boothCode], ...patch } }))

  const setCount = (boothCode, denomKey, val) =>
    setRowData(prev => ({
      ...prev,
      [boothCode]: { ...prev[boothCode], counts: { ...(prev[boothCode]?.counts || {}), [denomKey]: val === '' ? 0 : Number(val) || 0 } },
    }))

  async function handleReceiptPick(boothCode, file) {
    if (!file || !collectionId) return
    setUploadingBooth(boothCode); setError(null)
    try {
      const blob = await compressImage(file, { maxWidth: 800, quality: 0.75 })
      const { data, error: e } = await uploadReceiptPhoto({ collectionId, boothCode, fileBlob: blob })
      if (e) throw e
      setRow(boothCode, { receipt_photo_url: data.url, receipt_photo_path: data.path })
    } catch (e) {
      setError(`ERR-COLLECTION-007: ${e.message} (写真なしで続行可)`)
    } finally {
      setUploadingBooth(null)
    }
  }

  const collectionTotal = useMemo(
    () => booths.reduce((s, b) => s + boothTotal(rowData[b.booth_code]?.counts), 0),
    [booths, rowData]
  )
  const advanceTotal = useMemo(
    () => booths.reduce((s, b) => s + (Number(rowData[b.booth_code]?.advance_payment) || 0), 0),
    [booths, rowData]
  )

  // COLLECTION-METER-DIFF-SUBTOTAL-01 R1+R2: 機械計+店舗計(表示のみ、保存/PDF不関与)
  const machineSubtotalMap = useMemo(() => {
    const byMachine = {}
    for (const b of booths) {
      if (!byMachine[b.machine_code]) byMachine[b.machine_code] = { total: 0, allNull: true, boothCodes: [] }
      byMachine[b.machine_code].boothCodes.push(b.booth_code)
      const r = rowData[b.booth_code] || emptyRow(b)
      const d = diff(r.in_meter_current, r.in_meter_prev)
      if (d != null) { byMachine[b.machine_code].total += d; byMachine[b.machine_code].allNull = false }
    }
    const result = {}
    for (const [mc, info] of Object.entries(byMachine)) {
      const sorted = [...info.boothCodes].sort()
      result[mc] = { firstBoothCode: sorted[0], total: info.allNull ? null : info.total, multi: sorted.length > 1 }
    }
    return result
  }, [booths, rowData])

  const storeDiffTotal = useMemo(() => {
    let total = 0, hasAny = false
    for (const b of booths) {
      const r = rowData[b.booth_code] || emptyRow(b)
      const d = diff(r.in_meter_current, r.in_meter_prev)
      if (d != null) { total += d; hasAny = true }
    }
    return hasAny ? total : null
  }, [booths, rowData])

  // COLLECTION-SIGNATURE-REDESIGN-01 R1+R3: 先方サイン必須 → 確定 → PDF自動生成1回
  async function confirm() {
    if (!customerSignatureData) { setError('先方ご担当者様のサインが必要です'); return }
    setSaving(true); setError(null)
    // 先方サインをStorageにupload (失敗時は確定継続)
    let customerSigUrl = null, customerSigPath = null
    try {
      const { data: sigData, error: sigErr } = await uploadCustomerSignature({
        collectionId, dataUrl: customerSignatureData,
      })
      if (sigErr) throw sigErr
      customerSigUrl = sigData?.url ?? null
      customerSigPath = sigData?.path ?? null
    } catch (e) {
      setError(`ERR-COLLECTION-009: 先方署名の保存に失敗 (${e.message})、確定は継続します`)
    }
    const now = new Date().toISOString()
    const payload = Object.fromEntries(booths.map(b => {
      const r = rowData[b.booth_code] || {}
      return [b.booth_code, {
        in_meter_prev: numOrNull(r.in_meter_prev),
        in_meter_current: r.in_meter_current,
        out_meter_prev: null,
        out_meter_current: null,
        advance_payment: r.advance_payment,
        notes: r.notes,
        counts: r.counts || {},
        receipt_photo_url: r.receipt_photo_url || null,
        receipt_photo_path: r.receipt_photo_path || null,
      }]
    }))
    const { data, error: e } = await saveCollection({
      storeCode, collectedAt, prevCollectionDate: prevDate || null,
      collectedBy: staffId || null, collectedByName: staffName || null,
      booths, rowData: payload, collectionId,
      customerSignatureUrl: customerSigUrl,
      customerSignaturePath: customerSigPath,
      customerSignedAt: now,
    })
    if (e) { setError(`ERR-COLLECTION-002: ${e.message}`); setSaving(false); return }
    const savedId = data.collectionId
    setConfirmedId(savedId)
    setSaving(false)
    // R3: 確定後にPDFを1回だけ自動生成
    if (generatingPdfRef.current) return
    generatingPdfRef.current = true
    setGeneratingPdf(true)
    try {
      const { data: detail, error: detailErr } = await getCollectionDetail(savedId)
      if (detailErr) throw detailErr
      await ensureJpFont()
      const doc = await buildCollectionSlip({
        ...detail,
        collectedByName: staffName,
        customerSignatureDataUrl: customerSignatureData,
      })
      doc.save(slipFileName(savedId))
    } catch (pdfErr) {
      setError(`ERR-COLLECTION-003: PDF自動生成に失敗 (${pdfErr.message})`)
    } finally {
      generatingPdfRef.current = false
      setGeneratingPdf(false)
    }
  }

  // J-COLLECTION-09 fix_4 / J-COLLECTION-12 R2: レシート × ボタンは確認ダイアログ経由のみ削除実行。
  //   × tap → setPendingDeleteBooth → ダイアログ表示
  //   '削除' tap → confirmReceiptDelete(boothCode) → Storage remove + rowData null reset
  //   'キャンセル' tap or 背景タップ → setPendingDeleteBooth(null)
  async function confirmReceiptDelete(boothCode) {
    if (locked) return
    const cur = rowData[boothCode] || {}
    if (!cur.receipt_photo_url) { setPendingDeleteBooth(null); return }
    const path = cur.receipt_photo_path
    // 楽観的に先に UI を消す (Storage 削除失敗時はエラー表示してロールバックしない)
    setRow(boothCode, { receipt_photo_url: null, receipt_photo_path: null })
    setPendingDeleteBooth(null)
    if (path) {
      const { error: dErr } = await deleteReceiptPhoto({ path })
      if (dErr) setError(`ERR-COLLECTION-010: レシート削除失敗 (${dErr.message})`)
    }
  }

  const locked = !!confirmedId

  function handleOutsideTap(e) {
    // HOTFIX-COLLECTION-DENOM-INPUT-DEAD-01 (D-052): dataTabindex を持たない金種フィールド等も
    // numpad を閉じない。data-numpad-field で全 NumpadField を保護 (denom は dataTabindex 非付与)。
    if (e.target.closest('[data-numpad-field]')) return
    if (e.target.closest('[data-tabindex]')) return
    if (e.target.closest('[data-testid="numpad-footer"]')) return
    setCurrentField(null)
  }

  // SPEC-MOTION-W1-COLLAPSE-AND-NUMPAD-01 (D-069) F4: 金種展開時、行が画面外なら滑らかに追従スクロール。
  useEffect(() => {
    if (!openDenom || typeof document === 'undefined') return
    const el = document.querySelector(`[data-testid="denom-inline-${CSS.escape(openDenom)}"]`)
    el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [openDenom])

  return (
    <div data-testid="collection-input" className="flex flex-col" style={{ height: '100svh' }} onPointerDown={handleOutsideTap}>
      <div className="flex-shrink-0 p-3 pb-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('/admin/collection')} className="text-sm text-gray-400 hover:text-white min-h-[44px] flex items-center gap-1">← 戻る</button>
          <button onClick={() => navigate('/collection/history')} className="text-sm text-blue-400 min-h-[44px]">履歴</button>
        </div>
        <h1 className="text-base font-bold text-text mb-1">集金入力</h1>
        <div className="text-xs text-muted mb-2">担当: {staffName || '(未ログイン)'}</div>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">集金日</span>
            <input data-testid="collection-date" type="date" value={collectedAt} disabled={locked}
              onChange={e => setCollectedAt(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text disabled:opacity-50" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">前回集金日 (任意)</span>
            <input data-testid="collection-prev-date" type="date" value={prevDate} disabled={locked}
              onChange={e => setPrevDate(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text disabled:opacity-50" />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">店舗</span>
            <StorePickerSheet
              value={storeCode || null}
              onChange={(code) => setStoreCode(code ?? '')}
              showAllOption={false}
              disabled={locked}
              placeholder="店舗を選択"
            />
          </div>
          <button data-testid="collection-load-button" onClick={handleLoad} disabled={!storeCode || loading || locked}
            className="px-4 min-h-[44px] rounded-lg bg-blue-600 text-white text-base font-bold disabled:opacity-50">
            {loading ? '読込中…' : '読み込む'}
          </button>
        </div>
      </div>

      {error && <p data-testid="collection-error" className="text-red-400 text-sm px-3 py-1 flex-shrink-0">{error}</p>}

      {/* SPEC-MOTION-W1-COLLAPSE-AND-NUMPAD-01 (D-069) F5: overflow-anchor で開閉時のスクロール位置を安定化 */}
      <div className="flex-1 overflow-auto min-h-0 list-scroll" style={{ overflowAnchor: 'auto' }}>
        {!loaded && !loading && <p className="text-center text-muted text-base py-8">店舗を選んで読み込んでください</p>}
        {loaded && booths.length === 0 && <p className="text-center text-muted text-base py-8">アクティブブースがありません</p>}
        {loaded && booths.length > 0 && (
          <table data-testid="collection-table" className="text-xs" style={{ minWidth: TABLE_MIN_WIDTH, width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead className="sticky top-0 bg-bg z-10">
              <tr className="border-b border-border text-muted">
                {COLS.map(c => (
                  <th key={c.key} className="px-1 py-1 text-left font-normal" style={{ width: c.w, minWidth: c.w }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {booths.map((b, idx) => {
                const r = rowData[b.booth_code] || emptyRow(b)
                const inD = diff(r.in_meter_current, r.in_meter_prev)
                const sub = boothTotal(r.counts)
                const tabBase = idx * 4 + 1
                const open = openDenom === b.booth_code
                const hasPhoto = !!r.receipt_photo_url
                const isUploading = uploadingBooth === b.booth_code
                const mInfo = machineSubtotalMap[b.machine_code]
                const machineSubCell = !mInfo ? null : (!mInfo.multi || mInfo.firstBoothCode === b.booth_code) ? mInfo.total : '→↑'
                return (
                  <Fragment key={b.booth_code}>
                  <tr data-testid="collection-booth-row" className="border-b border-border/40" style={{ height: 44 }}>
                    <td className="px-1 py-1 font-mono text-text">{b.rental_code}</td>
                    <td className="px-1 py-1 text-text truncate" style={{ maxWidth: 120 }} title={b.machine_name}>{b.machine_name}</td>
                    <td className="px-1 py-1 text-text" data-testid={`booth-name-${b.booth_code}`}>{b.booth_name}</td>
                    <td className="px-1 py-1">
                      <NumpadField value={r.in_meter_prev} onChange={v => setRow(b.booth_code, { in_meter_prev: v })}
                        label={`前回IN ${b.booth_name}`} max={9999999}
                        dataTabindex={tabBase} testId={`booth-in-prev-${b.booth_code}`}
                        isActive={currentField?.testId === `booth-in-prev-${b.booth_code}`} strongActive
                        onRegister={setCurrentField} onClear={() => setCurrentField(null)} style={cellInputStyle} />
                    </td>
                    <td className="px-1 py-1">
                      <NumpadField value={r.in_meter_current} onChange={v => setRow(b.booth_code, { in_meter_current: v })}
                        label={`今回IN ${b.booth_name}`} max={9999999}
                        dataTabindex={tabBase + 1} testId={`booth-in-cur-${b.booth_code}`}
                        isActive={currentField?.testId === `booth-in-cur-${b.booth_code}`} strongActive
                        onRegister={setCurrentField} onClear={() => setCurrentField(null)} style={cellInputStyle} />
                    </td>
                    <td data-testid={`booth-in-diff-${b.booth_code}`}
                      className={`px-1 py-1 text-right tabular-nums ${inD == null ? 'text-muted' : inD < 0 ? 'text-red-600' : 'text-text'}`}>
                      {inD == null ? '—' : (inD >= 0 ? '+' : '') + inD}
                    </td>
                    <td data-testid={`booth-machine-sub-${b.booth_code}`}
                      className={`px-1 py-1 text-right tabular-nums text-xs ${machineSubCell === '→↑' ? 'text-gray-400' : machineSubCell == null ? 'text-muted' : machineSubCell < 0 ? 'text-red-500' : 'text-text'}`}>
                      {machineSubCell === '→↑' ? '→↑' : machineSubCell == null ? '—' : (machineSubCell >= 0 ? '+' : '') + machineSubCell}
                    </td>
                    <td className="px-1 py-1">
                      <button data-testid={`booth-amount-${b.booth_code}`}
                        onClick={() => !locked && setOpenDenom(open ? null : b.booth_code)} disabled={locked}
                        className={`w-full text-right tabular-nums border rounded px-2 h-9 text-xs text-text disabled:opacity-60 ${open ? 'bg-blue-900/30 border-blue-500' : 'bg-bg border-border'}`}>
                        {yen(sub)}円
                      </button>
                    </td>
                    <td className="px-1 py-1">
                      <NumpadField value={r.advance_payment} onChange={v => setRow(b.booth_code, { advance_payment: v })}
                        label={`立替 ${b.booth_name}`} max={9999999}
                        dataTabindex={tabBase + 2} testId={`booth-advance-${b.booth_code}`}
                        isActive={currentField?.testId === `booth-advance-${b.booth_code}`} strongActive
                        onRegister={setCurrentField} onClear={() => setCurrentField(null)} style={cellInputStyle} />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        data-testid={`booth-notes-${b.booth_code}`} type="text" value={r.notes || ''}
                        onChange={e => setRow(b.booth_code, { notes: e.target.value })}
                        onFocus={() => setCurrentField(null)}
                        disabled={locked} enterKeyHint="next"
                        className="w-full bg-bg border border-border rounded px-2 text-xs text-text outline-none focus:border-blue-500 h-9 disabled:opacity-60"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input type="file" accept="image/*" capture="environment" hidden
                        data-testid={`booth-receipt-input-${b.booth_code}`}
                        ref={el => { fileInputs.current[b.booth_code] = el }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptPick(b.booth_code, f); e.target.value = '' }}
                      />
                      <div className="relative inline-block">
                        <button
                          data-testid={`booth-receipt-btn-${b.booth_code}`}
                          onClick={() => {
                            if (locked || isUploading) return
                            if (hasPhoto) setReceiptConfirmBooth(b.booth_code)
                            else fileInputs.current[b.booth_code]?.click()
                          }}
                          disabled={locked || isUploading}
                          className="w-9 h-9 rounded border border-border bg-bg flex items-center justify-center disabled:opacity-60"
                          title={hasPhoto ? 'タップで再撮影' : 'レシート撮影'}
                        >
                          {isUploading ? '…' : hasPhoto
                            ? <img src={r.receipt_photo_url} alt="" className="w-8 h-8 object-cover rounded" />
                            : <span className="text-base">📷</span>}
                        </button>
                        {/* J-COLLECTION-09 fix_4 / J-COLLECTION-12 R2: × は確認ダイアログを開く */}
                        {hasPhoto && !locked && !isUploading && (
                          <button
                            data-testid={`booth-receipt-delete-${b.booth_code}`}
                            onClick={() => setPendingDeleteBooth(b.booth_code)}
                            aria-label="レシート削除"
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] leading-none flex items-center justify-center shadow"
                            title="レシート削除"
                          >×</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* SPEC-MOTION-W1-COLLAPSE-AND-NUMPAD-01 (D-069) F4: {open&&tr} を常時 tr + Collapse に。DOM 瞬間挿入を断ち、タップ誤爆/スクロール飛びを防ぐ。 */}
                  <tr data-testid={`denom-inline-${b.booth_code}`} className="bg-surface/40">
                    <td colSpan={COLS.length} className="p-0">
                      <Collapse open={open} testId={`denom-collapse-${b.booth_code}`}>
                        <div className="flex flex-wrap items-center gap-3 px-3 py-2">
                          {DENOMINATIONS.map(d => (
                            <div key={d.key} className="flex items-center gap-1">
                              <span className="text-xs text-muted w-10 text-right">{d.short}</span>
                              <NumpadField
                                value={r.counts?.[d.key] ? String(r.counts[d.key]) : ''}
                                onChange={v => setCount(b.booth_code, d.key, v)}
                                label={`${d.short} ${b.booth_name}`} max={99999}
                                testId={`denom-input-${d.key}-${b.booth_code}`}
                                isActive={currentField?.testId === `denom-input-${d.key}-${b.booth_code}`}
                                strongActive
                                onRegister={setCurrentField}
                                onClear={() => setCurrentField(null)}
                                style={denomInputStyle}
                              />
                            </div>
                          ))}
                          <span className="ml-auto text-sm font-bold text-text tabular-nums" data-testid={`denom-subtotal-${b.booth_code}`}>合計 {yen(sub)} 円</span>
                          <button data-testid={`denom-close-${b.booth_code}`} onClick={() => setOpenDenom(null)} className="text-xs text-blue-400 px-3 min-h-[44px]">閉じる</button>
                        </div>
                      </Collapse>
                    </td>
                  </tr>
                  </Fragment>
                )
              })}
              {/* COLLECTION-METER-DIFF-SUBTOTAL-01 R2: 店舗計行 */}
              <tr data-testid="collection-store-total-row" className="border-t-2 border-border font-bold">
                <td colSpan={6} className="px-1 py-2 text-xs text-right text-muted pr-2">店舗計</td>
                <td data-testid="collection-store-diff-total"
                  className={`px-1 py-2 text-right tabular-nums text-sm ${storeDiffTotal == null ? 'text-muted' : storeDiffTotal < 0 ? 'text-red-500' : 'text-text'}`}>
                  {storeDiffTotal == null ? '—' : (storeDiffTotal >= 0 ? '+' : '') + storeDiffTotal}
                </td>
                <td colSpan={4} />
              </tr>
            </tbody>
          </table>
        )}
        {/* SPEC-COLLECTION-BOTTOM-SPACER-01 (D-083) C1: リストスクロール領域末尾に固定 50svh spacer。
            NumpadFooterSlot (最大70svh) 迫り上がり時に最下行をスクロールで Slot 上部へ逃がす逃げ余白。
            動的増減はそれ自体がガタつき源になるため固定値 (numpad 開閉と非連動)。 */}
        <div aria-hidden data-testid="collection-bottom-spacer" style={{ height: '50svh', flexShrink: 0 }} />
      </div>

      {/* COLLECTION-SIGNATURE-REDESIGN-01 R1+追補: 先方サイン。'drawing' 段階のみ表示。
          ボタン3本(キャンセル/リセット/確定)をキャンバス上部に配置(右利き手のひら対策)。
          height=220 で従来比約1.8倍。hideActions でキャンバス内クリアボタンを非表示。 */}
      {loaded && booths.length > 0 && !locked && signStage === 'drawing' && (
        <div className="flex-shrink-0 px-3 pt-2 space-y-2">
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setSignStage('idle'); setCustomerSignatureData(null); setSignaturePoints(0) }}
              className="px-4 min-h-[44px] rounded-lg border border-border text-text text-sm"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => signatureCanvasRef.current?.clear()}
              className="px-4 min-h-[44px] rounded-lg border border-border text-text text-sm"
            >
              リセット
            </button>
            <button
              data-testid="collection-confirm-button"
              onClick={confirm}
              disabled={saving || signaturePoints < SIGNATURE_MIN_POINTS || !customerSignatureData}
              className="px-5 min-h-[48px] rounded-xl bg-blue-600 text-white text-base font-bold disabled:opacity-50"
            >
              {saving ? '保存中…' : '確定'}
            </button>
          </div>
          <SignatureCanvas
            ref={signatureCanvasRef}
            value={customerSignatureData}
            onChange={setCustomerSignatureData}
            onPointCount={setSignaturePoints}
            label="先方ご担当者様"
            height={220}
            hideActions
          />
        </div>
      )}

      {loaded && booths.length > 0 && (
        <div className="flex-shrink-0 border-t border-border p-3 flex items-center gap-2">
          <div className="flex-1">
            <div className="text-xs text-muted">合計金額 <span className="ml-2">立替(参考) {yen(advanceTotal)} 円</span></div>
            <div data-testid="collection-total" className="text-2xl font-bold text-text tabular-nums">{yen(collectionTotal)} 円</div>
          </div>
          {!locked ? (
            // 'idle' → フッターに「先方サイン」ボタン。
            // 'drawing' → ボタンはキャンバス上部ボタンバーで管理、フッターは合計表示のみ。
            signStage === 'idle' ? (
              <button
                data-testid="collection-sign-toggle-button"
                onClick={() => setSignStage('drawing')}
                disabled={saving}
                className="px-5 min-h-[48px] rounded-xl bg-blue-600 text-white text-base font-bold disabled:opacity-50"
              >
                先方サイン
              </button>
            ) : null
          ) : (
            // R3: 確定後はPDF自動生成のみ。PDF出力ボタン廃止。
            <div className="flex flex-col items-end gap-1">
              <span data-testid="collection-confirmed-badge" className="text-xs text-green-400 font-bold">確定済 {confirmedId}</span>
              {generatingPdf && (
                <span className="text-xs text-gray-400" aria-busy="true">PDF生成中…</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* SPEC-MOTION-W1-COLLAPSE-AND-NUMPAD-01 (D-069) F3: h-0 即時 → NumpadFooterSlot (grid-rows transition + scrollIntoView) */}
      <NumpadFooterSlot currentField={currentField} />

      {/* J-COLLECTION-12 R2: レシート削除確認ダイアログ。背景タップ=キャンセル、× 'キャンセル' でも閉じる、'削除' のみ実行。 */}
      {/* SPEC-COLLECTION-RECEIPT-CONFIRM-VIEW-01: レシート確認モーダル。写真ありブースでReceiptボタンタップ時に表示。再撮影 or 戻る。 */}
      {receiptConfirmBooth && (
        <div
          data-testid="receipt-confirm-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center gap-4 px-4"
        >
          <img
            data-testid="receipt-confirm-image"
            src={rowData[receiptConfirmBooth]?.receipt_photo_url}
            alt="レシート確認"
            className="max-w-full max-h-[60dvh] object-contain rounded-lg"
          />
          <div className="flex gap-3">
            <button
              data-testid="receipt-confirm-back"
              onClick={() => setReceiptConfirmBooth(null)}
              className="px-6 min-h-[44px] rounded-xl border border-border text-text text-base bg-surface"
            >戻る</button>
            <button
              data-testid="receipt-confirm-reshoot"
              onClick={() => {
                setReceiptConfirmBooth(null)
                fileInputs.current[receiptConfirmBooth]?.click()
              }}
              className="px-6 min-h-[44px] rounded-xl bg-blue-600 text-white text-base font-bold"
            >再撮影</button>
          </div>
        </div>
      )}

      {pendingDeleteBooth && (
        <div
          data-testid="receipt-delete-dialog-backdrop"
          onClick={() => setPendingDeleteBooth(null)}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
        >
          <div
            data-testid="receipt-delete-dialog"
            onClick={e => e.stopPropagation()}
            className="bg-bg border border-border rounded-xl p-4 w-full max-w-xs"
          >
            <p className="text-base text-text">このレシート写真を削除しますか？</p>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                data-testid="receipt-delete-cancel"
                onClick={() => setPendingDeleteBooth(null)}
                className="px-4 min-h-[44px] rounded-lg border border-border text-text text-sm"
              >キャンセル</button>
              <button
                data-testid="receipt-delete-confirm"
                onClick={() => confirmReceiptDelete(pendingDeleteBooth)}
                className="px-4 min-h-[44px] rounded-lg bg-red-600 text-white text-sm font-bold"
              >削除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
