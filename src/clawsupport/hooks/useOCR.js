import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const ENGINE_KEY = 'ocr_engine'
const OCR_TIMEOUT_MS = 8000
const HALFWAY_MS = 5000

function jstDate() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

export function useOCR({ boothCode, orgId }) {
  const [engine, setEngineRaw] = useState(() => localStorage.getItem(ENGINE_KEY) || 'C')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [boundingBox, setBoundingBox] = useState(null)
  const [capturedImageUrl, setCapturedImageUrl] = useState(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [showHalfwayBadge, setShowHalfwayBadge] = useState(false)

  function toggleEngine() {
    const next = engine === 'C' ? 'T' : 'C'
    localStorage.setItem(ENGINE_KEY, next)
    setEngineRaw(next)
  }

  async function uploadPhoto(blob) {
    if (!orgId || !boothCode) return null
    const path = `${orgId}/${boothCode}/${jstDate()}.jpg`
    const { data, error: e } = await supabase.storage
      .from('meter-photos')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
    if (e) return null
    const { data: { publicUrl } } = supabase.storage.from('meter-photos').getPublicUrl(data.path)
    return publicUrl
  }

  const runOCR = useCallback(async (imageBase64, blob) => {
    setLoading(true)
    setError(null)
    setBoundingBox(null)
    setCapturedImageUrl(null)
    setElapsedMs(0)
    setShowHalfwayBadge(false)

    let photoUrl = null
    try {
      if (blob) {
        const localUrl = URL.createObjectURL(blob)
        setCapturedImageUrl(localUrl)
        photoUrl = await uploadPhoto(blob)
      }

      if (engine === 'C') {
        const start = Date.now()
        let halfwayShown = false
        const tickTimer = setInterval(() => {
          const e = Date.now() - start
          setElapsedMs(e)
          if (e >= HALFWAY_MS && !halfwayShown) {
            halfwayShown = true
            setShowHalfwayBadge(true)
          }
        }, 100)

        let data
        try {
          const resp = await Promise.race([
            fetch('/api/ocr', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image_base64: imageBase64, media_type: 'image/jpeg' }),
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('OCR_TIMEOUT_8S')), OCR_TIMEOUT_MS)
            ),
          ])
          if (!resp.ok) {
            const errorBody = await resp.json().catch(() => ({}))
            const errMsg = errorBody.error || `HTTP ${resp.status}`
            setError(errMsg)
            return { error: errMsg, detail: errorBody.anthropic_detail || '', meters: [], value: null, photoUrl }
          }
          data = await resp.json()
        } catch (err) {
          if (err.message === 'OCR_TIMEOUT_8S') {
            setError('OCR_TIMEOUT_8S')
            return { meters: [], value: null, photoUrl, timeout: true }
          }
          throw err
        } finally {
          clearInterval(tickTimer)
          setShowHalfwayBadge(false)
        }

        const ocrMeters = data.meters || []
        const value = ocrMeters.find(m => m.type === 'in')?.value ?? ocrMeters[0]?.value ?? data.value ?? null
        const bb = ocrMeters[0]?.bounding_box ?? data.bounding_box ?? null
        if (bb) setBoundingBox(bb)
        return { meters: ocrMeters, value, photoUrl }
      } else {
        // T = Tesseract path
        const { data, error: e } = await supabase.functions.invoke('ocr-meter', {
          body: { image_base64: imageBase64, media_type: 'image/jpeg' },
        })
        if (e) throw new Error(e.message)
        const value = data?.left_in ?? data?.right_in ?? null
        const meters = value != null ? [{ value, type: 'unknown' }] : []
        return { meters, value, photoUrl }
      }
    } catch (e) {
      setError(e.message || 'OCR失敗')
      return { meters: [], value: null, photoUrl }
    } finally {
      setLoading(false)
    }
  }, [engine, boothCode, orgId])  // eslint-disable-line react-hooks/exhaustive-deps

  return { engine, toggleEngine, loading, error, boundingBox, capturedImageUrl, elapsedMs, showHalfwayBadge, runOCR }
}
