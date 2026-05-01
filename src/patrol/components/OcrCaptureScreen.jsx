import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import NumpadField from './NumpadField'

const OCR_TIMEOUT_MS = 8000

function getBoothSide(boothCode) {
  const m = boothCode?.match(/-B(\d+)$/)
  if (!m) return 'left'
  return parseInt(m[1], 10) % 2 === 0 ? 'right' : 'left'
}

function preprocessForOCR(canvas) {
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  // Grayscale
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = gray
  }
  // Contrast stretch
  let min = 255, max = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < min) min = d[i]
    if (d[i] > max) max = d[i]
  }
  const range = max - min || 1
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = ((d[i] - min) / range) * 255
  }
  // Threshold
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] > 128 ? 255 : 0
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
}

// MeterGuideFrame: 黄点線枠+4隅コーナー
function MeterGuideFrame() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative" style={{ width: '80%', height: '35%' }}>
        <div className="absolute inset-0 border-2 border-dashed border-yellow-400/70 rounded" />
        {[['top-0 left-0','border-t-2 border-l-2'],['top-0 right-0','border-t-2 border-r-2'],
          ['bottom-0 left-0','border-b-2 border-l-2'],['bottom-0 right-0','border-b-2 border-r-2']].map(([pos, cls]) => (
          <div key={pos} className={`absolute w-4 h-4 border-yellow-400 ${pos} ${cls}`} />
        ))}
      </div>
    </div>
  )
}

export default function OcrCaptureScreen({ boothCode, machineInfo, lastIn, lastOut, onConfirm, onCancel, mode = 'single' }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ocrStatus, setOcrStatus] = useState('idle') // idle | loading | success | failed
  const [inValue, setInValue]   = useState('')
  const [outValue, setOutValue] = useState('')
  const [out2Value, setOut2Value] = useState('')
  const [activeField, setActiveField] = useState('in') // 'in' | 'out' | 'out2'
  const [elapsed, setElapsed] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [capturedImage, setCapturedImage] = useState(null) // 撮影直後の停止画像 (dataURL)。再撮影でクリア
  const timerRef = useRef(null)
  const mountedRef = useRef(true)

  const side = getBoothSide(boothCode)

  // カメラ起動
  useEffect(() => {
    mountedRef.current = true
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => {
        if (mountedRef.current) setErrorMsg('カメラにアクセスできません')
      })
    return () => {
      mountedRef.current = false
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function sendOcr(b64) {
    setOcrStatus('loading')
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
        // 3メーター: A段OUT=left_out, IN=left_in, B段OUT=right_out
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
      setOcrStatus('success')
    } catch (err) {
      clearInterval(timerRef.current)
      if (!mountedRef.current) return
      if (err.message === 'OCR_TIMEOUT') {
        setOcrStatus('failed')
        setErrorMsg('読み取れませんでした。numpadで入力してください。')
      } else {
        setOcrStatus('failed')
        setErrorMsg(err.message || 'OCR失敗')
      }
    }
  }

  function shutter() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    canvas.getContext('2d').drawImage(video, 0, 0)
    preprocessForOCR(canvas)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    // 停止画像として保持(MeterOcr 旧版の previewUrl 相当)。シャッター押した感を出す
    setCapturedImage(dataUrl)
    const b64 = dataUrl.split(',')[1]
    canvas.width = 0; canvas.height = 0
    sendOcr(b64)
  }

  async function handleGalleryPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const img = new Image()
    img.src = URL.createObjectURL(file)
    await new Promise(res => { img.onload = res })
    const canvas = document.createElement('canvas')
    canvas.width = img.width; canvas.height = img.height
    canvas.getContext('2d').drawImage(img, 0, 0)
    preprocessForOCR(canvas)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCapturedImage(dataUrl)
    const b64 = dataUrl.split(',')[1]
    canvas.width = 0; canvas.height = 0
    URL.revokeObjectURL(img.src)
    sendOcr(b64)
  }

  function retake() {
    setCapturedImage(null)
    setOcrStatus('idle')
    setErrorMsg('')
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
          /* 停止画像(撮影直後): 「シャッター押した感」を出す + 再撮影できるように */
          <img src={capturedImage} alt="撮影画像"
            className="w-full h-full object-cover"
            style={{ filter: 'grayscale(80%) contrast(130%)' }}
          />
        ) : errorMsg && !videoRef.current?.srcObject ? (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">{errorMsg}</div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted
            className="w-full h-full object-cover"
            style={{ filter: 'grayscale(80%) contrast(130%)' }}
          />
        )}
        <MeterGuideFrame />

        {/* 閉じるボタン */}
        <button onClick={onCancel}
          className="absolute top-2 right-2 w-9 h-9 bg-black/60 text-white rounded-full flex items-center justify-center text-base font-bold">
          ✕
        </button>

        {/* シャッターボタン (停止画像なし時のみ) */}
        {!capturedImage && ocrStatus !== 'loading' && (
          <button onClick={shutter}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 w-14 h-14 bg-white border-4 border-slate-700 rounded-full active:scale-90 transition-transform"
          />
        )}

        {/* 再撮影ボタン (停止画像あり時) */}
        {capturedImage && ocrStatus !== 'loading' && (
          <button onClick={retake}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 h-10 bg-slate-700/90 text-white rounded-full text-sm font-bold border-2 border-white/30 active:scale-95 transition-transform">
            ↻ 再撮影
          </button>
        )}

        {/* ギャラリーボタン (停止画像なし時のみ) */}
        {!capturedImage && (
        <label className="absolute bottom-3 right-3 w-10 h-10 bg-black/60 text-white rounded-lg flex items-center justify-center cursor-pointer text-lg">
          🖼️
          <input type="file" accept="image/*" onChange={handleGalleryPick} className="hidden" />
        </label>
        )}

        {/* OCR処理中スピナー */}
        {ocrStatus === 'loading' && (
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

        {/* エラー表示 */}
        {ocrStatus === 'failed' && (
          <div className="text-amber-400 text-[11px] mb-1">{errorMsg}</div>
        )}

        {/* OCR成功バッジ */}
        {ocrStatus === 'success' && (
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
