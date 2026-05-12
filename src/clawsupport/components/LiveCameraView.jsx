import { useEffect, useRef, useState } from 'react'

function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8))
}

function compressFrame(videoEl) {
  const { videoWidth: sw, videoHeight: sh } = videoEl
  const MAX = 800
  const scale = Math.min(1, MAX / Math.max(sw, sh))
  const w = Math.round(sw * scale)
  const h = Math.round(sh * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(videoEl, 0, 0, w, h)
  const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
  return { canvas, base64 }
}

export default function LiveCameraView({ engine, onToggleEngine, onCapture, onQR, onCancel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const zoomRef = useRef(1)
  const pinchStartRef = useRef(null)
  const [cameraError, setCameraError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1 })
  const [shooting, setShooting] = useState(false)
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

  async function shutter() {
    const vid = videoRef.current
    if (!vid || shooting) return
    setShooting(true)
    try {
      const { canvas, base64 } = compressFrame(vid)
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
        background: '#000', display: 'flex', flexDirection: 'column',
      }}
    >
      {cameraError ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 14 }}>
          {cameraError}
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ flex: 1, objectFit: 'cover', width: '100%' }}
        />
      )}

      {/* top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)' }}>
        <button
          onClick={onCancel}
          style={{ color: '#fff', background: 'none', border: 'none', fontSize: 28, lineHeight: 1, cursor: 'pointer' }}
        >
          ✕
        </button>
        <button
          onClick={onToggleEngine}
          style={{ color: '#fff', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '4px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {engine}
        </button>
      </div>

      {/* shutter bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 0 40px', background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }}>
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
      </div>
    </div>
  )
}
