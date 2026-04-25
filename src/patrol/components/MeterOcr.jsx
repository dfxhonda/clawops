// MeterOcr: カメラ撮影 → Claude Vision OCR → 確認 → 適用
// booth_code 末尾の奇数ブース(B01,B03)=左、偶数ブース(B02,B04)=右
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

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
  if (ocr.confidence < OCR_CONFIDENCE_THRESHOLD) {
    warnings.push(`読み取り信頼度が低い（${(ocr.confidence * 100).toFixed(0)}%）`)
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

  const side = getBoothSide(boothCode)

  // アンマウント時フラグ + previewUrl の revoke
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    }
  }, [])

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
  const hasBlockingWarning = warnings.some(w => w.includes('IN < OUT'))

  // fail状態 or IN < OUT警告 → 適用ボタン無効
  const isApplyDisabled = ocrStatus === 'fail' || hasBlockingWarning || (!editIn && !editOut)

  // 信頼度バッジ文字列
  function getConfidenceBadgeText() {
    if (!ocrData) return ''
    const conf = ocrData.confidence ?? 0
    const pct  = (conf * 100).toFixed(0)
    if (ocrStatus === 'success') {
      const inConf  = ocrData.in_confidence  != null ? ` IN${(ocrData.in_confidence  * 100).toFixed(0)}%` : ''
      const outConf = ocrData.out_confidence != null ? `/OUT${(ocrData.out_confidence * 100).toFixed(0)}%` : ''
      return `✓ 認識成功${inConf}${outConf}`
    }
    if (ocrStatus === 'partial') {
      return `⚠ 部分認識 ${pct}%`
    }
    return `✗ 読取失敗 ${pct}%`
  }

  // オーバーレイバッジのレンダリング
  function renderOverlayBadges() {
    if (!showOcrOverlay || !ocrData) return null

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
    if (ocrStatus === 'partial') {
      const hasIn  = ocrData.inVal  !== null && ocrData.inVal  !== undefined
      const hasOut = ocrData.outVal !== null && ocrData.outVal !== undefined
      return (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 flex gap-2 justify-center items-center px-3 py-2 rounded-b-lg">
          <span className={hasIn  ? greenBadge : redBadge}>{hasIn  ? `IN ${ocrData.inVal}`  : '読取× IN'}</span>
          <span className={hasOut ? greenBadge : redBadge}>{hasOut ? `OUT ${ocrData.outVal}` : '読取× OUT'}</span>
        </div>
      )
    }
    // fail
    return (
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 flex gap-2 justify-center items-center px-3 py-2 rounded-b-lg">
        <span className={redBadge}>読取失敗</span>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-end justify-center">
      <div className="bg-surface w-full max-w-[520px] rounded-t-2xl p-4 max-h-[92vh] overflow-y-auto">

        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <span className="font-bold text-[15px]">📷 カメラで読取</span>
          <button onClick={onClose} className="text-muted text-xl px-2 bg-transparent border-none cursor-pointer">✕</button>
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

        {/* error */}
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
            {/* OCRトグル */}
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowOcrOverlay(v => !v)}
                className="text-[11px] px-[10px] py-[3px] rounded-full border border-border bg-surface2 text-muted cursor-pointer"
              >
                OCR表示 {showOcrOverlay ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* 撮影画像 フル幅 + オーバーレイ */}
            {previewUrl && (
              <div className="relative w-full mb-3">
                <img src={previewUrl} alt="撮影画像" className="w-full h-auto block rounded-lg" />
                {renderOverlayBadges()}
              </div>
            )}

            {/* 信頼度バッジ */}
            <div className={`inline-flex items-center gap-1 text-[12px] font-bold px-[10px] py-1 rounded-full mb-[10px]
              ${ocrStatus === 'success' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-400'}`}>
              {getConfidenceBadgeText()}
            </div>

            {/* 警告 */}
            {warnings.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/40 rounded-xl px-[14px] py-[10px] mb-[10px]">
                {warnings.map((w, i) => (
                  <p key={i} className="text-red-400 text-[12px]">{w}</p>
                ))}
              </div>
            )}

            {/* fail時の救済フロー */}
            {ocrStatus === 'fail' && (
              <div className="bg-red-500/[0.08] border border-red-500/30 rounded-xl px-[14px] py-3 mb-[10px]">
                <div className="text-red-400 font-bold text-[13px] mb-2">読み取りに失敗しました。次の操作を選択してください：</div>
                <div className="flex gap-2">
                  <button onClick={handleRetake} className="flex-1 py-[10px] px-1 rounded-[10px] bg-transparent border border-blue-400 text-blue-400 font-semibold text-[12px] cursor-pointer">📸 再撮影</button>
                  <button
                    onClick={() => {
                      setEditIn(''); setEditOut('')
                      // フォーカスを手動入力フィールドへ（UIは以下フィールドに残る）
                    }}
                    className="flex-1 py-[10px] px-1 rounded-[10px] bg-transparent border border-violet-400 text-violet-400 font-semibold text-[12px] cursor-pointer"
                  >
                    ✏️ 手動入力
                  </button>
                  <button onClick={onClose} className="flex-1 py-[10px] px-1 rounded-[10px] bg-transparent border border-[#9ca3af] text-[#9ca3af] font-semibold text-[12px] cursor-pointer">スキップ</button>
                </div>
              </div>
            )}

            {/* OCR結果 (編集可能) */}
            <div className="flex gap-3 mb-[14px]">
              <div className="flex-1">
                <div className="text-[11px] text-muted mb-1">IN</div>
                <input
                  className={`w-full py-3 px-2 text-[18px] text-center rounded-lg border-2 outline-none box-border
                    ${ocrStatus !== 'fail' && !editIn && ocrData.inVal === null
                      ? 'border-red-500 bg-surface2 text-red-400'
                      : 'border-border bg-surface2 text-text focus:border-accent'}`}
                  type="number" inputMode="numeric"
                  value={editIn}
                  onChange={e => setEditIn(e.target.value)}
                  placeholder="読取失敗"
                />
                {lastIn !== null && editIn !== '' && (
                  <div className="text-[11px] text-center text-muted mt-1">
                    前回比 {Number(editIn) >= lastIn ? '+' : ''}{(Number(editIn) - lastIn).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="text-[11px] text-muted mb-1">OUT</div>
                <input
                  className={`w-full py-3 px-2 text-[18px] text-center rounded-lg border-2 outline-none box-border
                    ${ocrStatus !== 'fail' && !editOut && ocrData.outVal === null
                      ? 'border-red-500 bg-surface2 text-red-400'
                      : 'border-border bg-surface2 text-text focus:border-accent'}`}
                  type="number" inputMode="numeric"
                  value={editOut}
                  onChange={e => setEditOut(e.target.value)}
                  placeholder="読取失敗"
                />
                {lastOut !== null && editOut !== '' && (
                  <div className="text-[11px] text-center text-muted mt-1">
                    前回比 {Number(editOut) >= lastOut ? '+' : ''}{(Number(editOut) - lastOut).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* ボタン */}
            <button
              onClick={handleApply}
              disabled={isApplyDisabled}
              className="w-full p-[14px] rounded-xl bg-blue-600 disabled:bg-[#444] text-white disabled:text-[#888] font-bold text-[15px] border-none cursor-pointer disabled:cursor-not-allowed mb-2 disabled:opacity-50"
            >
              ✅ この値を適用
            </button>
            <div className="flex gap-2">
              <button onClick={handleRetake} className="flex-1 py-3 px-1 rounded-xl bg-surface2 border border-border text-text font-medium text-[13px] cursor-pointer">📸 再撮影</button>
              <button onClick={onClose}      className="flex-1 py-3 px-1 rounded-xl bg-surface2 border border-border text-text font-medium text-[13px] cursor-pointer">キャンセル</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
