import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const ENGINE_KEY = 'ocr_engine'

function jstDate() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

export function useOCR({ boothCode, orgId }) {
  const [engine, setEngineRaw] = useState(() => localStorage.getItem(ENGINE_KEY) || 'C')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [boundingBox, setBoundingBox] = useState(null)
  const [capturedImageUrl, setCapturedImageUrl] = useState(null)

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

    let photoUrl = null
    try {
      if (blob) {
        const localUrl = URL.createObjectURL(blob)
        setCapturedImageUrl(localUrl)
        photoUrl = await uploadPhoto(blob)
      }

      let value = null
      let bb = null

      if (engine === 'C') {
        const resp = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: imageBase64, media_type: 'image/jpeg' }),
        })
        if (!resp.ok) throw new Error(`OCR API error: ${resp.status}`)
        const data = await resp.json()
        value = data.value
        bb = data.bounding_box ?? null
      } else {
        // T = Tesseract path: fall back to Supabase ocr-meter
        const { data, error: e } = await supabase.functions.invoke('ocr-meter', {
          body: { image_base64: imageBase64, media_type: 'image/jpeg' },
        })
        if (e) throw new Error(e.message)
        // ocr-meter returns left_in/left_out/right_in/right_out; take left_in as fallback
        value = data?.left_in ?? data?.right_in ?? null
      }

      if (bb) setBoundingBox(bb)
      return { value, photoUrl }
    } catch (e) {
      setError(e.message || 'OCR失敗')
      return { value: null, photoUrl }
    } finally {
      setLoading(false)
    }
  }, [engine, boothCode, orgId])  // eslint-disable-line react-hooks/exhaustive-deps

  return { engine, toggleEngine, loading, error, boundingBox, capturedImageUrl, runOCR }
}
