import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import NumpadField from './NumpadField'
import {
  computeCenterCrop,
  preprocessForOcr,
  DEFAULT_CROP_RATIO_X,
  DEFAULT_CROP_RATIO_Y,
} from '../../lib/ocrPreprocess'

const OCR_TIMEOUT_MS = 8000

// MeterGuideFrame と shutter() のクロップ範囲は同じ値を使う（WYSIWYG）。
// ユーザーがこの黄色い枠にメーターを合わせれば、OCR にもこの範囲だけが送られる。
const FRAME_RATIO_X = DEFAULT_CROP_RATIO_X
const FRAME_RATIO_Y = DEFAULT_CROP_RATIO_Y

function getBoothSide(boothCode) {
  const m = boothCode?.match(/-B(\d+)$/)
  if (!m) return 'left'
  return parseInt(m[1], 10) % 2 === 0 ? 'right' : 'left'
}

// 撮影画像から固定枠で中央クロップしつつ前処理し、JPEG dataURL を返す。
// canvas は使い捨て。
function captureAndPreprocess(source, srcWidth, srcHeight) {
  const { sx, sy, sw, sh } = computeCenterCrop(srcWidth, srcHeight, FRAME_RATIO_X, FRAME_RATIO_Y)
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)
  const img = ctx.getImageData(0, 0, sw, sh)
  preprocessForOcr(img.data)
  ctx.putImageData(img, 0, 0)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  canvas.width = 0
  canvas.height = 0
  return dataUrl
}

function MeterGuideFrame() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="relative"
        style={{ width: `${FRAME_RATIO_X * 100}%`, height: `${FRAME_RATIO_Y * 100}%` }}
      >
        <div className="absolute inset-0 border-2 border-dashed border-yellow-400/70 rounded" />
        {[['top-0 left-0','border-t-2 border-l-2'],['top-0 right-0','border-t-2 border-r-2'],
          ['bottom-0 left-0','border-b-2 border-l-2'],['bottom-0 right-0','border-b-2 border-r-2']].map(([pos, cls]) => (
          <div key={pos} className={`absolute w-4 h-4 border-yellow-400 ${pos} ${cls}`} />
        ))}
      </div>
    </div>
  )
}

// フェーズ定義:
//   idle       — ライブカメラ表示中、シャッター待ち
//   cropping   — 撮影直後、前処理済み画像を表示中（OCR送信前の確認）
//   processing — OCR Edge Function 呼び出し中
//   confirming — OCR 完了（成功 or タイムアウト）、値確認中
export default function OcrCaptureScreen({ boothCode, machineInfo, lastIn, lastOut, onConfirm, onCancel, mode = 'single' }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [phase, setPhase] = useState('idle') // idle | cropping | processing | confirming
  const [ocrError, setOcrError] = useState('') // confirming フェーズ時のエラー文言（空なら成功）
  const [inValue, setInValue]   = useState('')
  const [outValue, setOutValue] = useState('')
  const [out2Value, setOut2Value] = useState('')
  const [activeField, setActiveField] = useState('in') // 'in' | 'out' | 'out2'
  const [elapsed, setElapsed] = useState(0)
  const [capturedImage, setCapturedImage] = useState(null) // 前処理済み停止画像 (dataURL)
  const [cameraError, setCameraError] = useState('')
  const timerRef = useRef(null)
  const mountedRef = useRef(true)

  const side = getBoothSide(boothCode)

  useEffect(() => {
    mountedRef.current = true
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        // フラッシュ強制 ON（torch 対応端末のみ。iOS Safari 等の非対応端末は黙ってスキップ）
        const track = stream.getVideoTracks()?.[0]
        if (track && typeof track.applyConstraints === 'function') {
          track.applyConstraints({ advanced: [{ torch: true }] }).catch(() => {})
        }
      })
      .catch(() => {
        if (mountedRef.current) setCameraError('カメラにアクセスできません')
      })
    return () => {
      mountedRef.current = false
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function sendOcr(b64) {
    setPhase('processing')
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(n => n + 1), 1000)

    const invokePromise = supabase.functions.invoke('ocr-meter', {
      body: { image_base64: b64, media_type: 'image/jpeg' },
    })
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OCR_TIMEOUT')), OCR_TIMEOUT_MS)
    )
    try {
      const { data, error } = await Promise.race([invokePromise, timeoutPromise])
      clearInterval(timerRef.current)
      if (!mountedRef.current) return
      if (error) throw new Error(error.message || 'OCR失敗')

      if (mode === 'three') {
        const a = data.left_out != null ? String(data.left_out) : ''
        const inn = data.left_in != null ? String(data.left_in) : ''
        const b = data.right_out != null ? String(data.right_out) : ''
        setOutValue(a); setInValue(inn); setOut2Value(b)
        setActiveField(inn ? 'in' : 'out')
      } else {
        const inn = (side === 'left' ? data.left_in : data.right_in)
        const out = (side === 'left' ? data.left_out : data.right_out)
        setInValue(inn != null ? String(inn) : '')
        setOutValue(out != null ? String(out) : '')
        setActiveField(inn ? 'in' : 'out')
      }
      setOcrError('')
      setPhase('confirming')
    } catch (err) {
      clearInterval(timerRef.current)
      if (!mountedRef.current) return
      setOcrError(err.message === 'OCR_TIMEOUT'
        ? '読み取れませんでした。numpadで入力してください。'
        : (err.message || 'OCR失敗'))
      setPhase('confirming')
    }
  }

  function shutter() {
    const video = videoRef.current
    if (!video) return
    const dataUrl = captureAndPreprocess(
      video,
      video.videoWidth || 1280,
      video.videoHeight || 720,
    )
    setCapturedImage(dataUrl)
    setPhase('cropping')
    const b64 = dataUrl.split(',')[1]
    sendOcr(b64)
  }

  async function handleGalleryPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const img = new Image()
    img.src = URL.createObjectURL(file)
    await new Promise(res => { img.onload = res })
    const dataUrl = captureAndPreprocess(img, img.width, img.height)
    setCapturedImage(dataUrl)
    setPhase('cropping')
    const b64 = dataUrl.split(',')[1]
    URL.revokeObjectURL(img.src)
    sendOcr(b64)
  }

  function retake() {
    setCapturedImage(null)
    setPhase('idle')
    setOcrError('')
    setInValue(''); setOutValue(''); setOut2Value('')
    setActiveField('in')
  }

  function getActiveValue() {
    if (activeField === 'in') return inValue
    if (activeField === 'out2') return out2Value
    return outValue
  }
  function setActiveValue(v) {
    if (activeField === 'in') setInValue(v)
    else if (activeField === 'out2') setOut2Value(v)
    else setOutValue(v)
  }

  const inDiff  = inValue  && lastIn  != null ? Number(inValue)  - lastIn  : null
  const outDiff = outValue && lastOut != null ? Number(outValue) - lastOut : null

  function handleConfirm() {
    onConfirm({ inMeter: inValue || null, outMeter: outValue || null, outMeter2: out2Value || null })
  }

  const canConfirm = mode === 'three'
    ? (inValue || outValue || out2Value)
    : (inValue && outValue)

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col" style={{ touchAction: 'none' }}>

      {/* 上1/3: ライブカメラ または 撮影後停止画像 */}
      <div className="relative flex-shrink-0" style={{ height: '33.33vh' }}>
        {capturedImage ? (
          /* cropping / processing / confirming: 撮影済み停止画像 */
          <img src={capturedImage} alt="撮影画像"
            className="w-full h-full object-cover"
            style={{ filter: 'grayscale(80%) contrast(130%)' }}
          />
        ) : cameraError ? (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">{cameraError}</div>
        ) : (
          /* idle: ライブカメラ */
          <video ref={videoRef} autoPlay playsInline muted
            className="w-full h-full object-cover"
            style={{ filter: 'grayscale(80%) contrast(130%)' }}
          />
        )}
        {/* 撮影前の構図ガイド（撮影後は capturedImage 自体がクロップ結果なので非表示） */}
        {!capturedImage && !cameraError && <MeterGuideFrame />}

        {/* 閉じるボタン */}
        <button onClick={onCancel}
          className="absolute top-2 right-2 w-9 h-9 bg-black/60 text-white rounded-full flex items-center justify-center text-base font-bold">
          ✕
        </button>

        {/* シャッターボタン (idle 時のみ) */}
        {phase === 'idle' && (
          <button onClick={shutter} aria-label="シャッター"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 w-14 h-14 bg-white border-4 border-slate-700 rounded-full active:scale-90 transition-transform"
          />
        )}

        {/* 再撮影ボタン (cropping / confirming 時) */}
        {(phase === 'cropping' || phase === 'confirming') && (
          <button onClick={retake}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 h-10 bg-slate-700/90 text-white rounded-full text-sm font-bold border-2 border-white/30 active:scale-95 transition-transform">
            ↻ 再撮影
          </button>
        )}

        {/* ギャラリーボタン (idle 時のみ) */}
        {phase === 'idle' && (
          <label className="absolute bottom-3 right-3 w-10 h-10 bg-black/60 text-white rounded-lg flex items-center justify-center cursor-pointer text-lg">
            🖼️
            <input type="file" accept="image/*" onChange={handleGalleryPick} style={{ display: 'none' }} />
          </label>
        )}

        {/* OCR処理中スピナー */}
        {phase === 'processing' && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-white text-xs">読み取り中... {elapsed}s</span>
            {elapsed >= 5 && (
              <span className="text-amber-400 text-xs">あと{8 - elapsed}秒で手入力モード</span>
            )}
          </div>
        )}
      </div>

      {/* 中段: 値表示 + 確定 */}
      <div className="bg-slate-800 px-3 py-2 flex-shrink-0">
        {mode === 'three' ? (
          /* 3メーター表示 */
          <div className="grid grid-cols-3 gap-2 mb-2">
            {[
              { label: 'A段OUT', value: outValue, field: 'out', last: lastOut, diff: outDiff },
              { label: 'IN',     value: inValue,  field: 'in',  last: lastIn,  diff: inDiff },
              { label: 'B段OUT', value: out2Value, field: 'out2', last: null, diff: null },
            ].map(({ label, value, field, last, diff }) => (
              <button key={field} onClick={() => setActiveField(field)}
                className={`rounded-lg p-2 text-center border-2 transition-colors ${
                  activeField === field ? 'border-cyan-400 bg-slate-700' : 'border-slate-600 bg-slate-900'
                }`}>
                <div className="text-[9px] text-slate-400 mb-0.5">{label}</div>
                <div className="text-base font-mono font-bold text-white">{value || '------'}</div>
                {last != null && <div className="text-[9px] text-slate-500">前回 {last.toLocaleString()}</div>}
                {diff != null && <div className={`text-[9px] font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {diff >= 0 ? '+' : ''}{diff}
                </div>}
              </button>
            ))}
          </div>
        ) : (
          /* シングル表示 */
          <div className="flex gap-2 mb-2">
            {[
              { label: 'IN',  value: inValue,  field: 'in',  last: lastIn,  diff: inDiff },
              { label: 'OUT', value: outValue, field: 'out', last: lastOut, diff: outDiff },
            ].map(({ label, value, field, last, diff }) => (
              <button key={field} onClick={() => setActiveField(field)}
                className={`flex-1 rounded-lg p-2 text-center border-2 transition-colors ${
                  activeField === field ? 'border-cyan-400 bg-slate-700' : 'border-slate-600 bg-slate-900'
                }`}>
                <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
                <div className="text-xl font-mono font-bold text-white">{value || '------'}</div>
                {last != null && <div className="text-[10px] text-slate-500">前回 {last.toLocaleString()}</div>}
                {diff != null && <div className={`text-[10px] font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {diff >= 0 ? '+' : ''}{diff}
                </div>}
              </button>
            ))}
          </div>
        )}

        {/* confirming フェーズ: エラー or 成功バッジ */}
        {phase === 'confirming' && ocrError && (
          <div className="text-amber-400 text-[11px] mb-1">{ocrError}</div>
        )}
        {phase === 'confirming' && !ocrError && (
          <div className="text-emerald-400 text-[11px] mb-1">✓ 読み取り成功 — 値を確認して確定ボタン</div>
        )}

        {/* 確定ボタン */}
        <button onClick={handleConfirm} disabled={!canConfirm}
          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${
            canConfirm ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'
          }`}>
          ✓ 確定
        </button>
      </div>

      {/* 下1/3: Numpad 常時表示 */}
      <div className="flex-shrink-0" style={{ height: '33.33vh' }}>
        <NumpadField
          value={getActiveValue()}
          onChange={setActiveValue}
          alwaysOpen={true}
          max={999999}
          onClose={handleConfirm}
        />
      </div>

    </div>
  )
}
