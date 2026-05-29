import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import NumpadField, { NumpadFooterPanel } from '../clawsupport/components/NumpadField'
import {
  getActiveStores, getActiveBoothsForStore, getPrevCollectionMeters,
  saveCollection, getCollectionDetail,
  nextCollectionId, uploadReceiptPhoto,
  uploadStaffSignature, deleteReceiptPhoto, // J-COLLECTION-09 fix_1/4
} from '../services/collections'
import { DENOMINATIONS, boothTotal } from './lib/collectionCalc'
import { buildCollectionSlip, slipFileName, ensureJpFont } from './lib/collectionPdf'
import { compressImage } from './lib/imageUtil'
import SignatureCanvas, { SIGNATURE_MIN_POINTS } from './components/SignatureCanvas' // J-COLLECTION-07 fix_1 / J-COLLECTION-12 R3-R4

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
  const [staffSignatureData, setStaffSignatureData] = useState(null) // J-COLLECTION-07 fix_1
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
  // J-COLLECTION-12 R3: 2段ボタン状態。
  //   'idle' = SignatureCanvas 非表示、フッタボタンは「サイン」disabled→tap で 'drawing' へ
  //   'drawing' = SignatureCanvas 表示中、point < threshold は「サイン」disabled、>= は「確定」enabled
  const [signStage, setSignStage] = useState('idle')
  const [signaturePoints, setSignaturePoints] = useState(0)
  // J-COLLECTION-12 R2: レシート削除確認ダイアログ対象 (boothCode|null)
  const [pendingDeleteBooth, setPendingDeleteBooth] = useState(null)

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
    setLoading(true); setError(null); setLoaded(false); setConfirmedId(null); setStaffSignatureData(null)
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

  async function confirm() {
    if (!staffSignatureData) { setError('弊社担当者署名が必要です'); return }
    setSaving(true); setError(null)
    // J-COLLECTION-09 fix_1: 弊社署名を Storage 'receipts' に upload (失敗時は continue=DB側のみ NULL で確定継続)
    let sigUrl = null, sigPath = null
    try {
      const { data: sigData, error: sigErr } = await uploadStaffSignature({
        collectionId, dataUrl: staffSignatureData,
      })
      if (sigErr) throw sigErr
      sigUrl = sigData?.url ?? null
      sigPath = sigData?.path ?? null
    } catch (e) {
      // 致命ではない (確定自体は継続)。 URLなしの確定は後続署名再生成時に dataURL 不可ペナルティ。
      setError(`ERR-COLLECTION-009: 弊社署名の保存に失敗 (${e.message})、確定は継続します`)
    }
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
      staffSignatureUrl: sigUrl, staffSignaturePath: sigPath, // J-COLLECTION-09 fix_1
    })
    if (e) { setError(`ERR-COLLECTION-002: ${e.message}`); setSaving(false); return }
    setConfirmedId(data.collectionId); setSaving(false)
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

  // J-COLLECTION-11 fix_B: 二度押しガード。ref で同期ロック、UI は state で disabled+spinner。
  async function outputPdf() {
    if (generatingPdfRef.current) return
    generatingPdfRef.current = true
    setError(null)
    setGeneratingPdf(true)
    try {
      const { data, error: e } = await getCollectionDetail(confirmedId)
      if (e) throw e
      await ensureJpFont()
      // J-COLLECTION-13: getCollectionDetail が data.issuer を返す (...data で透過的に伝播)
      const doc = await buildCollectionSlip({ ...data, collectedByName: staffName, staffSignatureDataUrl: staffSignatureData })
      doc.save(slipFileName(confirmedId))
    } catch (e) {
      setError(`ERR-COLLECTION-003: ${e.message}`)
    } finally {
      generatingPdfRef.current = false
      setGeneratingPdf(false)
    }
  }

  const locked = !!confirmedId

  return (
    <div data-testid="collection-input" className="flex flex-col" style={{ height: '100dvh' }}>
      <div className="flex-shrink-0 p-3 pb-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('/launcher')} className="text-sm text-gray-400 hover:text-white min-h-[44px] flex items-center gap-1">← 戻る</button>
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
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">店舗</span>
            <select data-testid="collection-store-select" value={storeCode} disabled={locked}
              onChange={e => setStoreCode(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text disabled:opacity-50">
              <option value="">店舗を選択</option>
              {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
            </select>
          </label>
          <button data-testid="collection-load-button" onClick={handleLoad} disabled={!storeCode || loading || locked}
            className="px-4 min-h-[44px] rounded-lg bg-blue-600 text-white text-base font-bold disabled:opacity-50">
            {loading ? '読込中…' : '読み込む'}
          </button>
        </div>
      </div>

      {error && <p data-testid="collection-error" className="text-red-400 text-sm px-3 py-1 flex-shrink-0">{error}</p>}

      <div className="flex-1 overflow-auto min-h-0">
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
                        onRegister={setCurrentField} style={cellInputStyle} />
                    </td>
                    <td className="px-1 py-1">
                      <NumpadField value={r.in_meter_current} onChange={v => setRow(b.booth_code, { in_meter_current: v })}
                        label={`今回IN ${b.booth_name}`} max={9999999}
                        dataTabindex={tabBase + 1} testId={`booth-in-cur-${b.booth_code}`}
                        onRegister={setCurrentField} style={cellInputStyle} />
                    </td>
                    <td data-testid={`booth-in-diff-${b.booth_code}`}
                      className={`px-1 py-1 text-right tabular-nums ${inD == null ? 'text-muted' : inD < 0 ? 'text-red-600' : 'text-text'}`}>
                      {inD == null ? '—' : (inD >= 0 ? '+' : '') + inD}
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
                        onRegister={setCurrentField} style={cellInputStyle} />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        data-testid={`booth-notes-${b.booth_code}`} type="text" value={r.notes || ''}
                        onChange={e => setRow(b.booth_code, { notes: e.target.value })}
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
                          onClick={() => !locked && fileInputs.current[b.booth_code]?.click()}
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
                  {open && (
                    <tr data-testid={`denom-inline-${b.booth_code}`} className="bg-surface/40">
                      <td colSpan={COLS.length} className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-3">
                          {DENOMINATIONS.map(d => (
                            <div key={d.key} className="flex items-center gap-1">
                              <span className="text-xs text-muted w-10 text-right">{d.short}</span>
                              <NumpadField
                                value={r.counts?.[d.key] ? String(r.counts[d.key]) : ''}
                                onChange={v => setCount(b.booth_code, d.key, v)}
                                label={`${d.short} ${b.booth_name}`} max={99999}
                                testId={`denom-input-${d.key}-${b.booth_code}`}
                                onRegister={setCurrentField}
                                style={denomInputStyle}
                              />
                            </div>
                          ))}
                          <span className="ml-auto text-sm font-bold text-text tabular-nums" data-testid={`denom-subtotal-${b.booth_code}`}>合計 {yen(sub)} 円</span>
                          <button data-testid={`denom-close-${b.booth_code}`} onClick={() => setOpenDenom(null)} className="text-xs text-blue-400 px-2 min-h-[36px]">閉じる</button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* J-COLLECTION-07 fix_1 / J-COLLECTION-12 R3: 弊社担当者署名は 'drawing' 段階のみ表示。
          'idle' 中は canvas を畳んでフッタに「サイン」ボタンだけ出す。 */}
      {loaded && booths.length > 0 && !locked && signStage === 'drawing' && (
        <div className="flex-shrink-0 px-3 pt-2">
          <SignatureCanvas
            value={staffSignatureData}
            onChange={setStaffSignatureData}
            onPointCount={setSignaturePoints}
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
            // J-COLLECTION-12 R3: 'idle' は「サイン」(canvas を出すための disabled-look + enabled tap)、
            // 'drawing' は points >= SIGNATURE_MIN_POINTS で「確定」 enabled、未達は「サイン」 disabled。
            signStage === 'idle' ? (
              <button
                data-testid="collection-sign-toggle-button"
                onClick={() => setSignStage('drawing')}
                disabled={saving}
                className="px-5 min-h-[48px] rounded-xl bg-blue-600 text-white text-base font-bold disabled:opacity-50"
              >
                サイン
              </button>
            ) : signaturePoints < SIGNATURE_MIN_POINTS ? (
              <button
                data-testid="collection-confirm-button"
                disabled
                aria-disabled="true"
                className="px-5 min-h-[48px] rounded-xl bg-blue-600 text-white text-base font-bold disabled:opacity-50"
              >
                サイン
              </button>
            ) : (
              <button
                data-testid="collection-confirm-button"
                onClick={confirm}
                disabled={saving || !staffSignatureData}
                className="px-5 min-h-[48px] rounded-xl bg-blue-600 text-white text-base font-bold disabled:opacity-50"
              >
                {saving ? '保存中…' : '確定'}
              </button>
            )
          ) : (
            <div className="flex flex-col items-end gap-1">
              <span data-testid="collection-confirmed-badge" className="text-xs text-green-400 font-bold">確定済 {confirmedId}</span>
              <button data-testid="collection-pdf-button" onClick={outputPdf}
                disabled={generatingPdf}
                aria-busy={generatingPdf || undefined}
                className={`px-5 min-h-[48px] rounded-xl bg-emerald-600 text-white text-base font-bold disabled:opacity-60 ${generatingPdf ? 'ring-2 ring-emerald-300' : ''}`}>
                {generatingPdf ? '生成中…' : 'PDF出力'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex-shrink-0">
        <NumpadFooterPanel currentField={currentField} />
      </div>

      {/* J-COLLECTION-12 R2: レシート削除確認ダイアログ。背景タップ=キャンセル、× 'キャンセル' でも閉じる、'削除' のみ実行。 */}
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
