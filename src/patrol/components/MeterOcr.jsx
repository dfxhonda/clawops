// MeterOcr: カメラ撮影 → Claude Vision OCR → 確認 → 適用
// booth_code 末尾の奇数ブース(B01,B03)=左、偶数ブース(B02,B04)=右
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Term from '../../components/Term'

function getBoothSide(boothCode) {
  const match = boothCode?.match(/-B(\d+)$/)
  if (!match) return 'left'
  return parseInt(match[1], 10) % 2 === 0 ? 'right' : 'left'
}

// グレースケール変換 (OCR精度向上)
function applyGrayscale(ctx, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    data[i] = data[i + 1] = data[i + 2] = gray
  }
  ctx.putImageData(imageData, 0, 0)
}

// iPhoneの写真を1600px以下にリサイズ・EXIF補正・グレースケール変換してbase64返す
async function resizeImage(file, maxPx = 1600) {
  // createImageBitmap はブラウザがEXIF rotationを自動適用する
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas初期化失敗')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  applyGrayscale(ctx, w, h)
  const b64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1]
  // iOS Safariでピクセルバッファを解放
  canvas.width = 0; canvas.height = 0
  return b64
}

const OCR_CONFIDENCE_THRESHOLD = 0.65

/**
 * OCR結果の3状態を判定する
 * success  = in と out 両方認識成功
 * partial  = 一方が null/undefined
 * fail     = 両方失敗
 */
function getOcrStatus(inVal, outVal) {
  const hasIn  = inVal  !== null && inVal  !== undefined && inVal  !== ''
  const hasOut = outVal !== null && outVal !== undefined && outVal !== ''
  if (hasIn && hasOut) return 'success'
  if (hasIn || hasOut) return 'partial'
  return 'fail'
}

function validateOcr(ocr, lastIn, lastOut) {
  const warnings = []
  const { inVal, outVal } = ocr
  if (inVal !== null && lastIn !== null && inVal < lastIn) {
    warnings.push('INが前回値より減少しています')
  }
  if (outVal !== null && lastOut !== null && outVal < lastOut) {
    warnings.push('OUTが前回値より減少しています')
  }
  if (inVal !== null && outVal !== null && inVal < outVal) {
    warnings.push('IN < OUT（異常値の可能性）')
  }
  // confidence は内部ログのみ・UIには出さない
  if (ocr.confidence < OCR_CONFIDENCE_THRESHOLD) {
    console.log(`OCR信頼度: ${(ocr.confidence * 100).toFixed(0)}%`)
  }
  return warnings
}

export default function MeterOcr({ boothCode, lastIn, lastOut, onApply, onClose }) {
  const [phase, setPhase] = useState('idle') // idle | processing | confirming | error
  const [previewUrl, setPreviewUrl] = useState(null)
  const [ocrData, setOcrData] = useState(null)
  const [editIn, setEditIn] = useState('')
  const [editOut, setEditOut] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [showOcrOverlay, setShowOcrOverlay] = useState(true)
  const fileRef = useRef(null)
  const galleryRef = useRef(null)
  const mountedRef = useRef(true)
  const inRef = useRef(null)
  const outRef = useRef(null)

  const side = getBoothSide(boothCode)

  // アンマウント時フラグ + previewUrl の revoke
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    }
  }, [])

  // OCR失敗時にIN欄に自動フォーカス
  useEffect(() => {
    if (phase === 'confirming' && ocrData) {
      const status = getOcrStatus(ocrData.inVal, ocrData.outVal)
      if (status === 'fail') {
        setTimeout(() => inRef.current?.focus(), 100)
      }
    }
  }, [phase, ocrData])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const objUrl = URL.createObjectURL(file)
    setPreviewUrl(objUrl)
    setPhase('processing')
    setErrorMsg('')
    try {
      const b64 = await resizeImage(file)
      const { data, error } = await supabase.functions.invoke('ocr-meter', {
        body: { image_base64: b64, media_type: 'image/jpeg' },
      })
      if (!mountedRef.current) return
      if (error) throw new Error(error.message || 'OCR失敗')

      const inVal  = side === 'left' ? data.left_in  : data.right_in
      const outVal = side === 'left' ? data.left_out : data.right_out
      const result = { ...data, inVal, outVal }
      setOcrData(result)
      setEditIn(inVal  !== null && inVal  !== undefined ? String(inVal)  : '')
      setEditOut(outVal !== null && outVal !== undefined ? String(outVal) : '')
      setPhase('confirming')
    } catch (err) {
      if (!mountedRef.current) return
      setErrorMsg(err.message || 'OCR処理に失敗しました')
      setPhase('error')
    }
  }

  function handleApply() {
    onApply({
      inMeter: editIn,
      outMeter: editOut,
      confidence: ocrData?.confidence ?? 0,
    })
  }

  function handleRetake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setOcrData(null)
    setEditIn(''); setEditOut('')
    setPhase('idle')
    if (fileRef.current) fileRef.current.value = ''
    if (galleryRef.current) galleryRef.current.value = ''
  }

  // 3状態ロジック
  const ocrStatus = ocrData ? getOcrStatus(ocrData.inVal, ocrData.outVal) : null

  const inNum  = editIn  !== '' ? Number(editIn)  : null
  const outNum = editOut !== '' ? Number(editOut) : null

  const warnings = ocrData ? validateOcr(
    { ...ocrData, inVal: inNum, outVal: outNum },
    lastIn, lastOut
  ) : []

  // 保存ボタン: IN/OUT両方入力済みで活性
  const isSaveDisabled = !editIn || !editOut

  // フィールド単位の桁数・前回値バリデーション (ブロックしない・警告のみ)
  const inWarning = (() => {
    if (!editIn) return null
    if (editIn.length > 7) return '桁数が多いようです'
    if (lastIn != null && Number(editIn) < lastIn) return `前回(${lastIn.toLocaleString()})より小さい`
    return null
  })()

  const outWarning = (() => {
    if (!editOut) return null
    if (editOut.length > 7) return '桁数が多いようです'
    if (lastOut != null && Number(editOut) < lastOut) return `前回(${lastOut.toLocaleString()})より小さい`
    return null
  })()

  // オーバーレイバッジ: fail時は画像に被せない
  function renderOverlayBadges() {
    if (!showOcrOverlay || !ocrData) return null
    if (ocrStatus === 'fail') return null

    const badgeBase = 'px-3 py-1 rounded-full font-bold text-[15px] text-white border-2'
    const greenBadge = `${badgeBase} bg-emerald-500/85 border-emerald-500`
    const redBadge   = `${badgeBase} bg-red-500/85 border-red-500`

    if (ocrStatus === 'success') {
      return (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 flex gap-2 justify-center items-center px-3 py-2 rounded-b-lg">
          <span className={greenBadge}>IN {ocrData.inVal}</span>
          <span className={greenBadge}>OUT {ocrData.outVal}</span>
        </div>
      )
    }
    // partial
    const hasIn  = ocrData.inVal  !== null && ocrData.inVal  !== undefined
    const hasOut = ocrData.outVal !== null && ocrData.outVal !== undefined
    return (
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 flex gap-2 justify-center items-center px-3 py-2 rounded-b-lg">
        <span className={hasIn  ? greenBadge : redBadge}>{hasIn  ? `IN ${ocrData.inVal}`  : '読取× IN'}</span>
        <span className={hasOut ? greenBadge : redBadge}>{hasOut ? `OUT ${ocrData.outVal}` : '読取× OUT'}</span>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-end justify-center">
      <div className="bg-surface w-full max-w-[520px] rounded-t-2xl p-4 max-h-[92vh] overflow-y-auto">

        {/* ヘッダー: ×はここに集約 */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className="text-slate-400 text-xl px-2 bg-transparent border-none cursor-pointer" aria-label="閉じる">✕</button>
          <span className="font-bold text-[15px]">📷 メーター入力</span>
          <div className="w-8" />
        </div>

        {/* idle: 撮影ボタン */}
        {phase === 'idle' && (
          <div className="text-center py-2">
            <p className="text-[13px] text-muted mb-1">
              メーターパネル全体を撮影してください
            </p>
            <p className="text-[11px] text-accent mb-4">
              ブース {boothCode?.split('-').pop()} → {side === 'left' ? '左側' : '右側'}メーターを読み取ります
            </p>

            {/* メーター領域ガイド枠 */}
            <div className="relative w-full mb-5 flex justify-center">
              <div
                className="relative bg-black/10 rounded"
                style={{ width: '80%', paddingTop: 'calc(80% / 4)' }}
              >
                <div
                  className="absolute inset-0 rounded flex items-center justify-center"
                  style={{ border: '2px solid rgba(255,255,255,0.8)', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }}
                >
                  <span className="text-[11px] text-white/80 font-medium px-2 text-center leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                    メーターをここに合わせてください
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <label className="flex-1 max-w-[160px] cursor-pointer bg-blue-600 text-white font-bold py-4 px-2 rounded-xl text-[15px] flex flex-col items-center gap-1 border-none">
                <span className="text-[28px]">📸</span>
                <span>撮影する</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFile}
                />
              </label>
              <label className="flex-1 max-w-[160px] cursor-pointer bg-surface2 border-2 border-border text-text font-bold py-4 px-2 rounded-xl text-[15px] flex flex-col items-center gap-1">
                <span className="text-[28px]">🖼️</span>
                <span className="text-[13px]">ギャラリー</span>
                <input
                  ref={galleryRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                />
              </label>
            </div>
          </div>
        )}

        {/* processing: スピナー */}
        {phase === 'processing' && (
          <div className="text-center py-6">
            {previewUrl && (
              <div className="relative w-full mb-3">
                <img src={previewUrl} alt="撮影画像" className="w-full h-auto block rounded-lg" />
              </div>
            )}
            <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-muted text-[13px]">Claude Vision で読み取り中...</p>
          </div>
        )}

        {/* error: ネットワーク・API障害 */}
        {phase === 'error' && (
          <div>
            <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-[12px_14px] mb-[14px]">
              <p className="text-red-400 text-[13px]">{errorMsg}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleRetake} className="flex-1 py-3 px-1 rounded-xl bg-surface2 border border-border text-text font-medium text-[13px] cursor-pointer">再撮影</button>
              <button onClick={onClose}      className="flex-1 py-3 px-1 rounded-xl bg-surface2 border border-border text-text font-medium text-[13px] cursor-pointer">キャンセル</button>
            </div>
          </div>
        )}

        {/* confirming: OCR結果確認 */}
        {phase === 'confirming' && ocrData && (
          <div>
            {/* OCRトグル (fail時は不要なので非表示) */}
            {ocrStatus !== 'fail' && (
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setShowOcrOverlay(v => !v)}
                  className="text-[11px] px-[10px] py-[3px] rounded-full border border-border bg-surface2 text-muted cursor-pointer"
                >
                  OCR表示 {showOcrOverlay ? 'ON' : 'OFF'}
                </button>
              </div>
            )}

            {/* 撮影画像 フル幅 + オーバーレイ (fail時はバッジなし) */}
            {previewUrl && (
              <div className="relative w-full mb-3">
                <img src={previewUrl} alt="撮影画像" className="w-full h-auto block rounded-lg" />
                {renderOverlayBadges()}
              </div>
            )}

            {/* ステータス表示 */}
            {ocrStatus === 'fail' ? (
              <div className="flex items-center gap-2 text-xs text-amber-300 px-1 mb-3">
                <span>⚠</span>
                <span>自動で読み取れませんでした。下の欄に手動で入力してください。</span>
              </div>
            ) : (
              <div className={`inline-flex items-center gap-1 text-[12px] font-bold px-[10px] py-1 rounded-full mb-[10px]
                ${ocrStatus === 'success' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-400'}`}>
                {ocrStatus === 'success' ? (() => {
                  const inConf  = ocrData.in_confidence  != null ? ` IN${(ocrData.in_confidence  * 100).toFixed(0)}%` : ''
                  const outConf = ocrData.out_confidence != null ? `/OUT${(ocrData.out_confidence * 100).toFixed(0)}%` : ''
                  return `✓ 認識成功${inConf}${outConf}`
                })() : '⚠ 部分認識'}
              </div>
            )}

            {/* 警告 (IN<OUT等) */}
            {warnings.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl px-[14px] py-[10px] mb-[10px]">
                {warnings.map((w, i) => (
                  <p key={i} className="text-amber-400 text-[12px]">{w}</p>
                ))}
              </div>
            )}

            {/* IN/OUT 入力欄 */}
            <div className="flex gap-3 mb-[14px]">
              <div className="flex-1">
                <div className="text-xs font-bold text-cyan-400 mb-1">
                  <Term id="in">IN</Term>
                </div>
                <input
                  ref={inRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus={ocrStatus === 'fail'}
                  className={`w-full py-3 px-2 text-[18px] text-center rounded-lg border-2 outline-none box-border bg-slate-900 text-white transition-colors focus:border-cyan-500
                    ${editIn ? 'border-slate-600' : ocrStatus === 'fail' ? 'border-cyan-500' : 'border-slate-700'}`}
                  value={editIn}
                  onChange={e => setEditIn(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') outRef.current?.focus() }}
                  placeholder="例: 19091"
                />
                {inWarning && (
                  <div className="text-[10px] text-amber-400 mt-1">⚠ {inWarning}</div>
                )}
                {!editIn && lastIn != null && (
                  <div className="text-[10px] text-slate-500 mt-0.5 text-center">前回 {lastIn.toLocaleString()}</div>
                )}
                {editIn && lastIn != null && !inWarning && (
                  <div className="text-[11px] text-center text-muted mt-1">
                    前回比 {Number(editIn) >= lastIn ? '+' : ''}{(Number(editIn) - lastIn).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-cyan-400 mb-1">
                  <Term id="out">OUT</Term>
                </div>
                <input
                  ref={outRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={`w-full py-3 px-2 text-[18px] text-center rounded-lg border-2 outline-none box-border bg-slate-900 text-white transition-colors focus:border-cyan-500
                    ${editOut ? 'border-slate-600' : 'border-slate-700'}`}
                  value={editOut}
                  onChange={e => setEditOut(e.target.value.replace(/\D/g, ''))}
                  placeholder="例: 12084"
                />
                {outWarning && (
                  <div className="text-[10px] text-amber-400 mt-1">⚠ {outWarning}</div>
                )}
                {!editOut && lastOut != null && (
                  <div className="text-[10px] text-slate-500 mt-0.5 text-center">前回 {lastOut.toLocaleString()}</div>
                )}
                {editOut && lastOut != null && !outWarning && (
                  <div className="text-[11px] text-center text-muted mt-1">
                    前回比 {Number(editOut) >= lastOut ? '+' : ''}{(Number(editOut) - lastOut).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* 保存ボタン: 主アクション */}
            <button
              onClick={handleApply}
              disabled={isSaveDisabled}
              className="w-full p-[14px] rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white disabled:text-slate-500 font-bold text-[15px] border-none cursor-pointer disabled:cursor-not-allowed mb-3 transition-colors"
            >
              💾 保存
            </button>

            {/* 副アクション: テキストリンク */}
            <button
              onClick={handleRetake}
              className="w-full text-cyan-400 text-xs py-1.5 underline bg-transparent border-none cursor-pointer"
            >
              📷 もう一度撮影する
            </button>
            <button
              onClick={onClose}
              className="w-full text-slate-500 text-[11px] py-1 bg-transparent border-none cursor-pointer"
            >
              後で入力(スキップ)
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
