import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import NumpadField from './NumpadField'

const OCR_TIMEOUT_MS = 8000
const MIN_CROP_RATIO = 0.05

function getBoothSide(boothCode) {
  const m = boothCode?.match(/-B(\d+)$/)
  if (!m) return 'left'
  return parseInt(m[1], 10) % 2 === 0 ? 'right' : 'left'
}

// 画像をクロップして base64 返す（img タグ経由 → EXIF 補正済み）
function cropImageToB64(imgEl, cropRatio) {
  const { x, y, w, h } = cropRatio
  const nw = imgEl.naturalWidth
  const nh = imgEl.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width  = Math.round(nw * w)
  canvas.height = Math.round(nh * h)
  canvas.getContext('2d').drawImage(
    imgEl,
    Math.round(nw * x), Math.round(nh * y), canvas.width, canvas.height,
    0, 0, canvas.width, canvas.height
  )
  const b64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
  canvas.width = 0; canvas.height = 0
  return b64
}

// 画像表示領域を計算（object-fit:contain のレターボックス込み）
function calcDispRect(imgEl, containerEl) {
  if (!imgEl || !containerEl || !imgEl.naturalWidth) return null
  const nw = imgEl.naturalWidth, nh = imgEl.naturalHeight
  const cw = containerEl.clientWidth, ch = containerEl.clientHeight
  const scale = Math.min(cw / nw, ch / nh)
  return {
    offsetX: (cw - nw * scale) / 2,
    offsetY: (ch - nh * scale) / 2,
    displayW: nw * scale,
    displayH: nh * scale,
  }
}

export default function OcrCaptureScreen({ boothCode, machineInfo, lastIn, lastOut, onConfirm, onCancel, mode = 'single' }) {
  const [phase, setPhase] = useState('idle') // idle | cropping | processing | confirming
  const [imageSrc, setImageSrc] = useState(null)
  const [dispRect, setDispRect] = useState(null)
  // cropRect: x,y,w,h すべて自然サイズに対する比率 (0-1)
  const [cropRect, setCropRect] = useState({ x: 0.05, y: 0.30, w: 0.90, h: 0.35 })
  const [ocrStatus, setOcrStatus] = useState(null) // null | 'success' | 'failed'
  const [errorMsg, setErrorMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [inValue, setInValue]   = useState('')
  const [outValue, setOutValue] = useState('')
  const [out2Value, setOut2Value] = useState('')
  const [activeField, setActiveField] = useState('in')

  const cameraRef  = useRef(null)
  const galleryRef = useRef(null)
  const imgRef     = useRef(null)
  const containerRef = useRef(null)
  const timerRef   = useRef(null)
  const mountedRef = useRef(true)
  const dragRef    = useRef(null) // { type, startX, startY, startRect }
  const cropRectRef = useRef(cropRect)

  const side = getBoothSide(boothCode)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearInterval(timerRef.current)
    }
  }, [])

  // cropRect → ref 同期（touch handler がクロージャ内で最新値を使えるように）
  useEffect(() => { cropRectRef.current = cropRect }, [cropRect])

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (imageSrc) URL.revokeObjectURL(imageSrc)
    const url = URL.createObjectURL(file)
    setImageSrc(url)
    setPhase('cropping')
    setDispRect(null)
    e.target.value = ''
  }

  function onImageLoad() {
    setDispRect(calcDispRect(imgRef.current, containerRef.current))
  }

  // ── Touch: クロップ枠操作 ─────────────────────────────────────
  function onCropTouchStart(e, type) {
    e.stopPropagation()
    const t = e.touches[0]
    dragRef.current = { type, startX: t.clientX, startY: t.clientY, startRect: { ...cropRectRef.current } }
  }

  function onContainerTouchMove(e) {
    if (!dragRef.current || !dispRect) return
    const t = e.touches[0]
    const dx = (t.clientX - dragRef.current.startX) / dispRect.displayW
    const dy = (t.clientY - dragRef.current.startY) / dispRect.displayH
    const r = dragRef.current.startRect
    const { type } = dragRef.current
    let { x, y, w, h } = r

    if (type === 'move') {
      x = Math.max(0, Math.min(1 - w, r.x + dx))
      y = Math.max(0, Math.min(1 - h, r.y + dy))
    } else if (type === 'tl') {
      const nx = Math.max(0, Math.min(r.x + r.w - MIN_CROP_RATIO, r.x + dx))
      const ny = Math.max(0, Math.min(r.y + r.h - MIN_CROP_RATIO, r.y + dy))
      w = r.w + (r.x - nx); h = r.h + (r.y - ny); x = nx; y = ny
    } else if (type === 'tr') {
      const ny = Math.max(0, Math.min(r.y + r.h - MIN_CROP_RATIO, r.y + dy))
      w = Math.max(MIN_CROP_RATIO, Math.min(1 - r.x, r.w + dx))
      h = r.h + (r.y - ny); y = ny
    } else if (type === 'bl') {
      const nx = Math.max(0, Math.min(r.x + r.w - MIN_CROP_RATIO, r.x + dx))
      w = r.w + (r.x - nx); h = Math.max(MIN_CROP_RATIO, Math.min(1 - r.y, r.h + dy)); x = nx
    } else if (type === 'br') {
      w = Math.max(MIN_CROP_RATIO, Math.min(1 - r.x, r.w + dx))
      h = Math.max(MIN_CROP_RATIO, Math.min(1 - r.y, r.h + dy))
    }
    setCropRect({ x, y, w, h })
  }

  function onContainerTouchEnd() { dragRef.current = null }

  // ── OCR 送信 ──────────────────────────────────────────────────
  async function doOcr() {
    const img = imgRef.current
    if (!img) return
    setPhase('processing')
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(n => n + 1), 1000)

    try {
      const b64 = cropImageToB64(img, cropRectRef.current)
      const { data, error } = await Promise.race([
        supabase.functions.invoke('ocr-meter', { body: { image_base64: b64, media_type: 'image/jpeg' } }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('OCR_TIMEOUT')), OCR_TIMEOUT_MS)),
      ])
      clearInterval(timerRef.current)
      if (!mountedRef.current) return
      if (error) throw new Error(error.message || 'OCR失敗')

      if (mode === 'three') {
        setOutValue(data.left_out  != null ? String(data.left_out)  : '')
        setInValue(data.left_in    != null ? String(data.left_in)   : '')
        setOut2Value(data.right_out != null ? String(data.right_out) : '')
        setActiveField(data.left_in != null ? 'in' : 'out')
      } else {
        const inn = side === 'left' ? data.left_in  : data.right_in
        const out = side === 'left' ? data.left_out : data.right_out
        setInValue(inn  != null ? String(inn)  : '')
        setOutValue(out != null ? String(out)  : '')
        setActiveField(inn != null ? 'in' : 'out')
      }
      setOcrStatus('success')
    } catch (err) {
      clearInterval(timerRef.current)
      if (!mountedRef.current) return
      setOcrStatus('failed')
      setErrorMsg(err.message === 'OCR_TIMEOUT' ? '読み取れませんでした。手入力してください。' : err.message || 'OCR失敗')
    }
    setPhase('confirming')
  }

  function retake() {
    setCropRect({ x: 0.05, y: 0.30, w: 0.90, h: 0.35 })
    setOcrStatus(null); setErrorMsg('')
    setInValue(''); setOutValue(''); setOut2Value('')
    setActiveField('in')
    setPhase('idle')
  }

  function getActiveValue() {
    if (activeField === 'in')   return inValue
    if (activeField === 'out2') return out2Value
    return outValue
  }
  function setActiveValue(v) {
    if (activeField === 'in')        setInValue(v)
    else if (activeField === 'out2') setOut2Value(v)
    else                             setOutValue(v)
  }

  const inDiff  = inValue  && lastIn  != null ? Number(inValue)  - lastIn  : null
  const outDiff = outValue && lastOut != null ? Number(outValue) - lastOut : null
  const canConfirm = mode === 'three'
    ? (inValue || outValue || out2Value)
    : (inValue && outValue)

  function handleConfirm() {
    if (imageSrc) URL.revokeObjectURL(imageSrc)
    onConfirm({ inMeter: inValue || null, outMeter: outValue || null, outMeter2: out2Value || null })
  }

  // ── クロップ枠オーバーレイ ───────────────────────────────────
  function renderCropOverlay() {
    if (!dispRect) return null
    const { offsetX, offsetY, displayW, displayH } = dispRect
    const px = {
      l: offsetX + cropRect.x * displayW,
      t: offsetY + cropRect.y * displayH,
      w: cropRect.w * displayW,
      h: cropRect.h * displayH,
    }
    const HANDLE = 30
    const dimStyle = { position: 'absolute', background: 'rgba(0,0,0,0.55)' }
    const corners = [
      ['tl', px.l - HANDLE / 2,        px.t - HANDLE / 2],
      ['tr', px.l + px.w - HANDLE / 2, px.t - HANDLE / 2],
      ['bl', px.l - HANDLE / 2,        px.t + px.h - HANDLE / 2],
      ['br', px.l + px.w - HANDLE / 2, px.t + px.h - HANDLE / 2],
    ]
    return (
      <>
        {/* 暗幕4辺 */}
        <div style={{ ...dimStyle, top: offsetY,          left: offsetX,        width: displayW,                    height: px.t - offsetY }} />
        <div style={{ ...dimStyle, top: px.t + px.h,     left: offsetX,        width: displayW,                    height: offsetY + displayH - (px.t + px.h) }} />
        <div style={{ ...dimStyle, top: px.t,            left: offsetX,        width: px.l - offsetX,              height: px.h }} />
        <div style={{ ...dimStyle, top: px.t,            left: px.l + px.w,    width: offsetX + displayW - (px.l + px.w), height: px.h }} />
        {/* 枠線 + 中央ドラッグ */}
        <div
          onTouchStart={e => onCropTouchStart(e, 'move')}
          style={{ position: 'absolute', left: px.l, top: px.t, width: px.w, height: px.h,
            border: '2px solid #facc15', boxSizing: 'border-box' }}
        />
        {/* コーナーハンドル */}
        {corners.map(([type, l, t]) => (
          <div key={type}
            onTouchStart={e => onCropTouchStart(e, type)}
            style={{ position: 'absolute', left: l, top: t, width: HANDLE, height: HANDLE,
              background: '#facc15', borderRadius: 4 }}
          />
        ))}
      </>
    )
  }

  // ── レンダリング ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ touchAction: 'none' }}>

      {/* ─── idle: カメラ / ギャラリー 選択 ─── */}
      {phase === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <button onClick={onCancel}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 text-white rounded-full text-lg font-bold flex items-center justify-center">
            ✕
          </button>
          <p className="text-white text-lg font-bold">メーター撮影</p>
          <p className="text-slate-400 text-sm text-center leading-relaxed">
            撮影後にクロップ枠をメーター部分に合わせます
          </p>
          <div className="flex gap-4 w-full max-w-xs">
            <button onClick={() => cameraRef.current?.click()}
              className="flex-1 flex flex-col items-center gap-2 bg-blue-600 text-white font-bold py-7 rounded-2xl active:scale-95 transition-transform">
              <span className="text-4xl">📷</span>
              <span className="text-sm">撮影する</span>
            </button>
            <button onClick={() => galleryRef.current?.click()}
              className="flex-1 flex flex-col items-center gap-2 bg-slate-700 text-white font-bold py-7 rounded-2xl active:scale-95 transition-transform">
              <span className="text-4xl">🖼️</span>
              <span className="text-sm">ギャラリー</span>
            </button>
          </div>
          {/* iOS Safari: input 自身に display:none (親 div に入れると change 未発火) */}
          <input ref={cameraRef}  type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />
          <input ref={galleryRef} type="file" accept="image/*"                       style={{ display: 'none' }} onChange={handleFileChange} />
        </div>
      )}

      {/* ─── cropping: クロップ枠調整 ─── */}
      {phase === 'cropping' && (
        <div className="flex-1 flex flex-col">
          <div
            ref={containerRef}
            className="flex-1 relative overflow-hidden"
            onTouchMove={onContainerTouchMove}
            onTouchEnd={onContainerTouchEnd}
            onTouchCancel={onContainerTouchEnd}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="crop target"
              onLoad={onImageLoad}
              className="w-full h-full"
              style={{ objectFit: 'contain', display: 'block' }}
            />
            {renderCropOverlay()}
          </div>
          <div className="flex-shrink-0 bg-black/90 px-4 py-3 flex flex-col gap-2">
            <p className="text-slate-400 text-[11px] text-center">
              黄色い枠をドラッグしてメーター部分に合わせてください
            </p>
            <div className="flex gap-3">
              <button onClick={retake}
                className="flex-1 py-3 rounded-xl bg-slate-700 text-white text-sm font-bold">
                ← 撮り直し
              </button>
              <button onClick={doOcr}
                className="flex-[2] py-3 rounded-xl bg-cyan-600 text-white font-bold text-sm">
                📖 読み取る
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── processing: OCR中 ─── */}
      {phase === 'processing' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white">
          <button onClick={onCancel}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full text-lg font-bold flex items-center justify-center">
            ✕
          </button>
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">読み取り中... {elapsed}s</p>
          {elapsed >= 5 && (
            <p className="text-amber-400 text-xs">あと{Math.max(0, 8 - elapsed)}秒で手入力モード</p>
          )}
        </div>
      )}

      {/* ─── confirming: 値確認 ─── */}
      {phase === 'confirming' && (
        <div className="flex-1 flex flex-col">
          <div className="flex-shrink-0 bg-slate-800 px-3 py-2">
            {/* ステータスバッジ */}
            {ocrStatus === 'success' && (
              <div className="text-emerald-400 text-[11px] mb-1">✓ 読み取り成功 — 値を確認して確定</div>
            )}
            {ocrStatus === 'failed' && (
              <div className="text-amber-400 text-[11px] mb-1">⚠ {errorMsg}</div>
            )}

            {/* 値カード */}
            {mode === 'three' ? (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { label: 'A段OUT', value: outValue,  field: 'out',  last: lastOut, diff: outDiff },
                  { label: 'IN',     value: inValue,   field: 'in',   last: lastIn,  diff: inDiff },
                  { label: 'B段OUT', value: out2Value, field: 'out2', last: null,    diff: null },
                ].map(({ label, value, field, last, diff }) => (
                  <button key={field} onClick={() => setActiveField(field)}
                    className={`rounded-lg p-2 text-center border-2 transition-colors ${
                      activeField === field ? 'border-cyan-400 bg-slate-700' : 'border-slate-600 bg-slate-900'
                    }`}>
                    <div className="text-[9px] text-slate-400 mb-0.5">{label}</div>
                    <div className="text-base font-mono font-bold text-white">{value || '------'}</div>
                    {last != null && <div className="text-[9px] text-slate-500">前回 {last.toLocaleString()}</div>}
                    {diff != null && <div className={`text-[9px] font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{diff >= 0 ? '+' : ''}{diff}</div>}
                  </button>
                ))}
              </div>
            ) : (
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
                    {diff != null && <div className={`text-[10px] font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{diff >= 0 ? '+' : ''}{diff}</div>}
                  </button>
                ))}
              </div>
            )}

            <button onClick={handleConfirm} disabled={!canConfirm}
              className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${
                canConfirm ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'
              }`}>
              ✓ 確定
            </button>
            <button onClick={retake} className="w-full text-cyan-400 text-xs py-1.5 mt-1 bg-transparent border-none cursor-pointer">
              ↻ 再撮影
            </button>
          </div>

          {/* Numpad */}
          <div className="flex-1">
            <NumpadField
              value={getActiveValue()}
              onChange={setActiveValue}
              alwaysOpen={true}
              max={999999}
              onClose={handleConfirm}
            />
          </div>
        </div>
      )}

    </div>
  )
}
