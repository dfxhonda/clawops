import { useEffect, useRef, useState } from 'react'
import { logger } from '../../lib/logger'
// J-PATROL-99_adhoc_ocr_preprocess_all_paths-fix-03 (2026-05-30 ヒロ承認):
// shutter / handleGalleryChange のリサイズ後画像に preprocessForOcr を適用、
// grayscale + コントラスト伸長 + Otsu 二値化で OCR 精度+latency 改善。
import { preprocessForOcr } from '../../lib/ocrPreprocess'

const OCR_MAX_EDGE = 1600

// 長辺 OCR_MAX_EDGE px 以内に縮小した canvas を返す (zoom 中央クロップ対応)。
// video / image どちらの source でも使える共通リサイズ。
function drawResizedCanvas(source, sw, sh, zoom = 1) {
  const cropW = sw / zoom
  const cropH = sh / zoom
  const sx = (sw - cropW) / 2
  const sy = (sh - cropH) / 2
  const scale = Math.min(1, OCR_MAX_EDGE / Math.max(cropW, cropH))
  const w = Math.round(cropW * scale)
  const h = Math.round(cropH * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, sx, sy, cropW, cropH, 0, 0, w, h)
  // J-PATROL-99_adhoc_ocr_preprocess_all_paths-fix-03: in-place で前処理。
  const imageData = ctx.getImageData(0, 0, w, h)
  preprocessForOcr(imageData.data)
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

function canvasToBlob(canvas, quality = 0.9) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
}

function compressFrame(videoEl, zoom = 1) {
  const canvas = drawResizedCanvas(videoEl, videoEl.videoWidth, videoEl.videoHeight, zoom)
  const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1]
  return { canvas, base64 }
}

export default function LiveCameraView({ engine, onToggleEngine, onCapture, onQR, onCancel, showGuide: showGuideProp = false }) {
  const videoRef = useRef(null)
  const videoWrapperRef = useRef(null)
  const streamRef = useRef(null)
  const zoomRef = useRef(1)
  const pinchStartRef = useRef(null)
  const galleryInputRef = useRef(null)
  const nativeCamInputRef = useRef(null) // OS純正カメラ起動 (capture=environment、フラッシュ/AF/光学ズーム端末側)
  const [cameraError, setCameraError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1 })
  const [shooting, setShooting] = useState(false)
  const [showGuide, setShowGuide] = useState(showGuideProp)
  const [zoomLevel, setZoomLevel] = useState(1)
  const detectorRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let qrTimer = null

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then(stream => {
        if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream

        const track = stream.getVideoTracks()?.[0]
        if (track?.getCapabilities) {
          const caps = track.getCapabilities()
          if (caps.torch) track.applyConstraints({ advanced: [{ torch: true }] }).catch(() => {})
          if (caps.zoom) {
            setZoomRange({ min: caps.zoom.min, max: caps.zoom.max })
          }
          // best-effort 連続オートフォーカス (Android Chrome対応。iOS SafariはfocusMode非対応で自動AFのため無視される)
          if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
            track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {})
          }
        }

        // BarcodeDetector QR scan loop
        if (typeof BarcodeDetector !== 'undefined' && onQR) {
          try {
            detectorRef.current = new BarcodeDetector({ formats: ['qr_code'] })
            const scanFrame = async () => {
              if (!mountedRef.current) return
              const vid = videoRef.current
              if (vid?.readyState === 4) {
                try {
                  const barcodes = await detectorRef.current.detect(vid)
                  if (barcodes.length > 0 && mountedRef.current) {
                    onQR(barcodes[0].rawValue)
                    return
                  }
                } catch {}
              }
              qrTimer = setTimeout(scanFrame, 500)
            }
            qrTimer = setTimeout(scanFrame, 800)
          } catch {}
        }
      })
      .catch(() => {
        if (mountedRef.current) setCameraError('カメラにアクセスできません')
      })

    return () => {
      mountedRef.current = false
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (qrTimer) clearTimeout(qrTimer)
    }
  }, [onQR])

  async function applyZoom(value) {
    const track = streamRef.current?.getVideoTracks()?.[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ zoom: value }] })
      zoomRef.current = value
      setZoom(value)
    } catch {}
  }

  function handleZoomButton(level) {
    setZoomLevel(level)
    if (videoWrapperRef.current) {
      videoWrapperRef.current.style.transform = `scale(${level})`
      videoWrapperRef.current.style.transformOrigin = 'center center'
    }
  }

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      pinchStartRef.current = {
        dist: Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        ),
        zoom: zoomRef.current,
      }
    }
  }

  function onTouchMove(e) {
    if (e.touches.length !== 2 || !pinchStartRef.current) return
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    )
    const ratio = dist / pinchStartRef.current.dist
    const raw = pinchStartRef.current.zoom * ratio
    const clamped = Math.min(zoomRange.max, Math.max(zoomRange.min, raw))
    applyZoom(clamped)
  }

  async function handleGalleryChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    logger.info('ocr_gallery_pick_started')
    // J-PATROL-OCR-UNIFY-01-fix-01: 原画像をそのまま送ると 5MB 超で Anthropic 400 → ocr-meter 502。
    // カメラ経路(compressFrame)と同じく長辺1600px に縮小してから送る (q0.85)。
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = async () => {
      try {
        const canvas = drawResizedCanvas(img, img.naturalWidth, img.naturalHeight, 1)
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
        const blob = await canvasToBlob(canvas, 0.85)
        canvas.width = 0; canvas.height = 0
        onCapture(base64, blob)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      // フォールバック: 縮小失敗時のみ原画像を送る (従来動作)
      const reader = new FileReader()
      reader.onload = ev => onCapture(ev.target.result.split(',')[1], file)
      reader.readAsDataURL(file)
    }
    img.src = url
  }

  async function shutter() {
    const vid = videoRef.current
    if (!vid || shooting) return
    setShooting(true)
    try {
      const { canvas, base64 } = compressFrame(vid, zoomLevel)
      const blob = await canvasToBlob(canvas)
      canvas.width = 0; canvas.height = 0
      onCapture(base64, blob)
    } finally {
      setShooting(false)
    }
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {cameraError ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 14 }}>
          {cameraError}
        </div>
      ) : (
        <div ref={videoWrapperRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* 3分割ガイド — transform wrapper 内で絶対配置 */}
          {showGuide && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '92%', height: '38%', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
                {[
                  { label: 'A段', color: '#22d3ee' },
                  { label: 'IN',  color: '#0ea5e9' },
                  { label: 'B段', color: '#a78bfa' },
                ].map(col => (
                  <div key={col.label} style={{ border: `2px solid ${col.color}`, borderRadius: 4, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4, opacity: 0.85 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: col.color, background: 'rgba(0,0,0,0.6)', padding: '1px 6px', borderRadius: 3 }}>{col.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)' }}>
        <button
          onClick={onCancel}
          style={{ color: '#fff', background: 'none', border: 'none', fontSize: 28, lineHeight: 1, cursor: 'pointer' }}
        >
          ✕
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowGuide(v => !v)}
            style={{ color: showGuide ? '#000' : '#fff', background: showGuide ? '#fff' : 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            ガイド {showGuide ? 'ON' : 'OFF'}
          </button>
          {engine != null && (
            <button
              onClick={onToggleEngine}
              style={{ color: '#fff', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '4px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {engine}
            </button>
          )}
        </div>
      </div>

      {/* shutter bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, padding: '24px 0 40px', background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 4].map(level => (
            <button
              key={level}
              onClick={() => handleZoomButton(level)}
              style={{ color: zoomLevel === level ? '#000' : '#fff', background: zoomLevel === level ? '#fff' : 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 14, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {level}x
            </button>
          ))}
        </div>
        <button
          onClick={shutter}
          disabled={shooting}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: shooting ? '#888' : '#fff',
            border: '4px solid rgba(255,255,255,0.6)',
            cursor: shooting ? 'default' : 'pointer',
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleGalleryChange}
        />
        <button
          onClick={() => galleryInputRef.current?.click()}
          style={{ color: '#fff', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          ギャラリー
        </button>
        {/* J-PATROL-OCR-CAMERA ③: OS純正カメラ起動 (フラッシュ/AF/光学ズーム端末側)。暗所時の代替撮影。戻り画像は handleGalleryChange の縮小→OCR経路を共用 */}
        <input
          ref={nativeCamInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleGalleryChange}
        />
        <button
          onClick={() => nativeCamInputRef.current?.click()}
          style={{ color: '#000', background: '#f0c040', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          純正(フラッシュ可)
        </button>
      </div>
    </div>
  )
}
