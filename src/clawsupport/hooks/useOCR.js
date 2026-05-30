import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

// J-PATROL-99_adhoc_ocr_5s_timeout-fix-02 (2026-05-30 ヒロ承認):
// 8s → 5s に短縮。ヒロ要件「可否関わらず5秒で判断」、5s 経過後は手入力フォールバック。
// 通常 typical 3-7s なので一定割合で正常応答が timeout 化するが、UX 上は許容前提。
const OCR_TIMEOUT_MS = 5000

function jstDate() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

export function useOCR({ boothCode, orgId }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function uploadPhoto(blob) {
    if (!orgId || !boothCode) return { url: null, path: null, uploadError: null }
    const path = `${orgId}/${boothCode}/${jstDate()}_${Date.now()}.jpg`
    const { data, error: e } = await supabase.storage
      .from('meter-photos')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
    if (e) return { url: null, path: null, uploadError: e?.message }
    const { data: signedData, error: signErr } = await supabase.storage
      .from('meter-photos')
      .createSignedUrl(data.path, 60 * 60 * 24 * 365)
    return { url: signedData?.signedUrl ?? null, path: data.path, uploadError: signErr?.message ?? null }
  }

  const runOCR = useCallback(async (imageBase64, blob) => {
    setLoading(true)
    setError(null)

    let photoUrl = null
    let uploadError = null
    let storagePath = null
    try {
      if (blob) {
        const up = await uploadPhoto(blob)
        photoUrl = up.url
        storagePath = up.path ?? null
        uploadError = up.uploadError
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OCR_TIMEOUT_8S')), OCR_TIMEOUT_MS)
      )

      let data, invokeError
      try {
        const result = await Promise.race([
          supabase.functions.invoke('ocr-meter', {
            body: { image_base64: imageBase64, media_type: 'image/jpeg' },
          }),
          timeoutPromise,
        ])
        data = result.data
        invokeError = result.error
      } catch (err) {
        if (err.message === 'OCR_TIMEOUT_8S') {
          return { meters: [], value: null, photoUrl, storagePath, timeout: true, uploadError }
        }
        throw err
      }

      if (invokeError) throw new Error(invokeError.message)

      const meters = data?.meters ?? []
      const inLike = m => ['in','yen1000_in','yen500_in','yen100_in','change_in'].includes(m.type) ||
                          /IN/i.test(m.label || '')
      const value = meters.find(inLike)?.value ?? null
      return { meters, value, photoUrl, storagePath, uploadError }
    } catch (e) {
      setError(e.message || 'OCR失敗')
      return { meters: [], value: null, photoUrl, storagePath, uploadError }
    } finally {
      setLoading(false)
    }
  }, [boothCode, orgId])  // eslint-disable-line react-hooks/exhaustive-deps

  // engine: null = single engine (ocr-meter Supabase Edge Function)
  return { engine: null, toggleEngine: () => {}, loading, error, runOCR }
}
