// MeterOcr: カメラ撮影 → Claude Vision OCR → 確認 → 適用
// booth_code 末尾の奇数ブース(B01,B03)=左、偶数ブース(B02,B04)=右
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

function getBoothSide(boothCode) {
  const match = boothCode?.match(/-B(\d+)$/)
  if (!match) return 'left'
  return parseInt(match[1], 10) % 2 === 0 ? 'right' : 'left'
}

// iPhoneの写真を1024px以下にリサイズしてbase64返す
function resizeImage(file, maxPx = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas初期化失敗')); return }
      ctx.drawImage(img, 0, 0, w, h)
      const b64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
      // iOS Safariでピクセルバッファを解放
      canvas.width = 0; canvas.height = 0
      resolve(b64)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('画像読み込み失敗'))
    }
    img.src = url
  })
}

const OCR_CONFIDENCE_THRESHOLD = 0.65

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
      setEditIn(inVal  !== null ? String(inVal)  : '')
      setEditOut(outVal !== null ? String(outVal) : '')
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

  const warnings = ocrData ? validateOcr(
    { ...ocrData, inVal: editIn !== '' ? Number(editIn) : null, outVal: editOut !== '' ? Number(editOut) : null },
    lastIn, lastOut
  ) : []
  const hasBlockingWarning = warnings.some(w => w.includes('IN < OUT'))

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center">
      <div className="bg-surface w-full max-w-lg rounded-t-2xl p-4 max-h-[90vh] overflow-y-auto">

        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base">📷 カメラで読取</h3>
          <button onClick={onClose} className="text-muted text-xl px-2">✕</button>
        </div>

        {/* idle: 撮影ボタン */}
        {phase === 'idle' && (
          <div className="text-center py-4">
            <p className="text-sm text-muted mb-1">
              メーターパネル全体を撮影してください
            </p>
            <p className="text-xs text-accent mb-5">
              ブース {boothCode?.split('-').pop()} → {side === 'left' ? '左側' : '右側'}メーターを読み取ります
            </p>
            <div className="flex gap-3 justify-center">
              <label className="flex-1 max-w-[160px] cursor-pointer bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 rounded-xl text-base transition-colors flex flex-col items-center gap-1">
                <span className="text-2xl">📸</span>
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
              <label className="flex-1 max-w-[160px] cursor-pointer bg-surface2 border-2 border-border hover:border-accent active:bg-surface3 text-text font-bold py-4 rounded-xl text-base transition-colors flex flex-col items-center gap-1">
                <span className="text-2xl">🖼️</span>
                <span className="text-sm">ギャラリー</span>
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
          <div className="text-center py-8">
            {previewUrl && (
              <img src={previewUrl} alt="撮影画像" className="w-full rounded-lg mb-4 max-h-48 object-contain" />
            )}
            <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-muted text-sm">Claude Vision で読み取り中...</p>
          </div>
        )}

        {/* error */}
        {phase === 'error' && (
          <div>
            <div className="bg-accent2/15 border border-accent2 rounded-xl p-3.5 mb-4">
              <p className="text-accent2 text-sm">{errorMsg}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleRetake}
                className="flex-1 bg-surface2 border border-border text-text font-medium py-3 rounded-xl">
                再撮影
              </button>
              <button onClick={onClose}
                className="flex-1 bg-surface2 border border-border text-muted font-medium py-3 rounded-xl">
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* confirming: OCR結果確認 */}
        {phase === 'confirming' && ocrData && (
          <div>
            {previewUrl && (
              <img src={previewUrl} alt="撮影画像" className="w-full rounded-lg mb-3 max-h-40 object-contain" />
            )}

            {/* 信頼度バッジ */}
            <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full mb-3
              ${ocrData.confidence >= OCR_CONFIDENCE_THRESHOLD ? 'bg-accent3/20 text-accent3' : 'bg-accent/20 text-accent'}`}>
              信頼度: {(ocrData.confidence * 100).toFixed(0)}%
              {ocrData.confidence < OCR_CONFIDENCE_THRESHOLD && ' ⚠️'}
            </div>

            {/* 警告 */}
            {warnings.length > 0 && (
              <div className="bg-accent2/15 border border-accent2 rounded-xl p-3 mb-3">
                {warnings.map((w, i) => (
                  <p key={i} className="text-accent2 text-xs">{w}</p>
                ))}
              </div>
            )}

            {/* OCR結果 (編集可能) */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <div className="text-xs text-muted mb-1">IN</div>
                <input
                  className="w-full p-3 text-lg text-center rounded-lg border-2 border-border bg-surface2 text-text outline-none focus:border-accent"
                  type="number" inputMode="numeric"
                  value={editIn}
                  onChange={e => setEditIn(e.target.value)}
                  placeholder="読取失敗"
                />
                {lastIn !== null && editIn !== '' && (
                  <div className="text-xs text-center text-muted mt-1">
                    前回比 {Number(editIn) >= lastIn ? '+' : ''}{(Number(editIn) - lastIn).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted mb-1">OUT</div>
                <input
                  className="w-full p-3 text-lg text-center rounded-lg border-2 border-border bg-surface2 text-text outline-none focus:border-accent"
                  type="number" inputMode="numeric"
                  value={editOut}
                  onChange={e => setEditOut(e.target.value)}
                  placeholder="読取失敗"
                />
                {lastOut !== null && editOut !== '' && (
                  <div className="text-xs text-center text-muted mt-1">
                    前回比 {Number(editOut) >= lastOut ? '+' : ''}{(Number(editOut) - lastOut).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* ボタン */}
            <button
              onClick={handleApply}
              disabled={(!editIn && !editOut) || hasBlockingWarning}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl mb-2 transition-colors"
            >
              ✅ この値を適用
            </button>
            <div className="flex gap-2">
              <button onClick={handleRetake}
                className="flex-1 bg-surface2 border border-border text-text font-medium py-3 rounded-xl text-sm">
                📸 再撮影
              </button>
              <button onClick={onClose}
                className="flex-1 bg-surface2 border border-border text-muted font-medium py-3 rounded-xl text-sm">
                キャンセル
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
