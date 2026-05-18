import { useEffect, useRef, useState } from 'react'

function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
}

function compressFrame(videoEl) {
  const { videoWidth: sw, videoHeight: sh } = videoEl
  const MAX = 1600
  const scale = Math.min(1, MAX / Math.max(sw, sh))
  const w = Math.round(sw * scale)
  const h = Math.round(sh * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(videoEl, 0, 0, w, h)
  const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1]
  return { canvas, base64 }
}

export default function LiveCameraView({ engine, onToggleEngine, onCapture, onQR, onCancel, showGuide = false }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const zoomRef = useRef(1)
  const pinchStartRef = useRef(null)
  const [cameraError, setCameraError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1 })
  const [shooting, setShooting] = useState(false)
  const [guideOn, setGuideOn] = useState(showGuide)
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
    if (videoRef.current) {
      videoRef.current.style.transform = `scale(${level})`
      videoRef.current.style.transformOrigin = 'center center'
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
        background: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden',
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

      {/* 3分割ガイド */}
      {guideOn && (
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
            onClick={() => setGuideOn(v => !v)}
            style={{ color: guideOn ? '#000' : '#fff', background: guideOn ? '#fff' : 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            ガイド {guideOn ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={onToggleEngine}
            style={{ color: '#fff', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '4px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            {engine}
          </button>
        </div>
      </div>

      {/* shutter bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, padding: '24px 0 40px', background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0.5, 1, 2].map(level => (
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
      </div>
    </div>
  )
}
