import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import * as Sentry from '@sentry/react'
import { supabase } from '../../lib/supabase'

function otsuThreshold(imageData) {
  const histogram = new Array(256).fill(0)
  const data = imageData.data
  const total = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    histogram[gray]++
  }
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * histogram[i]
  let sumB = 0, wB = 0, max = 0, threshold = 0
  for (let t = 0; t < 256; t++) {
    wB += histogram[t]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += t * histogram[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > max) { max = between; threshold = t }
  }
  return threshold
}

const NativeCamera = forwardRef(function NativeCamera({ onOcrResult, storagePrefix, onStatusChange }, ref) {
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  useImperativeHandle(ref, () => ({
    trigger: () => cameraInputRef.current?.click(),
    triggerCamera: () => cameraInputRef.current?.click(),
    triggerGallery: () => galleryInputRef.current?.click(),
  }))

  const handleCapture = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const inputEl = e.target
    const ocrAttemptedAt = new Date().toISOString()

    Sentry.captureMessage('ocr.file_received', { level: 'info', extra: { size: file.size, type: file.type } })
    onStatusChange?.({ phase: 'binarizing' })

    let photoUrl = null
    let croppedPhotoUrl = null
    let extractedNumber = null
    let ocrRawText = null

    try {
      const img = await createImageBitmap(file)
      const cropHeight = Math.floor(img.height / 3)

      const cropCanvas = document.createElement('canvas')
      cropCanvas.width = img.width
      cropCanvas.height = cropHeight
      const cropCtx = cropCanvas.getContext('2d')
      cropCtx.drawImage(img, 0, 0, img.width, cropHeight, 0, 0, img.width, cropHeight)

      const imageData = cropCtx.getImageData(0, 0, cropCanvas.width, cropCanvas.height)
      const threshold = otsuThreshold(imageData)
      for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = Math.round(0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2])
        const val = gray > threshold ? 255 : 0
        imageData.data[i] = imageData.data[i + 1] = imageData.data[i + 2] = val
      }
      cropCtx.putImageData(imageData, 0, 0)

      const croppedBlob = await new Promise(resolve => cropCanvas.toBlob(resolve, 'image/jpeg', 0.85))
      Sentry.captureMessage('ocr.binarization_done', { level: 'info' })

      onStatusChange?.({ phase: 'uploading' })
      try {
        const ts = Date.now()
        const base = storagePrefix || `meter-captures/unknown/unknown/${new Date().toISOString().slice(0, 10)}`
        const origPath = `${base}/${ts}.jpg`
        const cropPath = `${base}/${ts}_crop.jpg`

        await Promise.all([
          supabase.storage.from('meter-captures').upload(origPath, file, { contentType: 'image/jpeg', upsert: true }),
          supabase.storage.from('meter-captures').upload(cropPath, croppedBlob, { contentType: 'image/jpeg', upsert: true }),
        ])

        photoUrl = supabase.storage.from('meter-captures').getPublicUrl(origPath).data.publicUrl
        croppedPhotoUrl = supabase.storage.from('meter-captures').getPublicUrl(cropPath).data.publicUrl
        Sentry.captureMessage('ocr.storage_upload_success', { level: 'info', extra: { origPath } })
      } catch (storageErr) {
        Sentry.captureException(storageErr, { tags: { ocr_step: 'storage_upload' } })
        console.warn('[NativeCamera] Storage upload failed:', storageErr)
      }

      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
      if (!apiKey) {
        Sentry.captureMessage('ocr.api_key_missing', { level: 'warning' })
        onStatusChange?.({ phase: 'failed', detail: 'APIキー未設定' })
      } else {
        onStatusChange?.({ phase: 'calling_api' })
        Sentry.captureMessage('ocr.api_call_started', { level: 'info', extra: { model: 'claude-haiku-4-5-20251001' } })
        try {
          const cropB64 = await new Promise(resolve => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result.split(',')[1])
            reader.readAsDataURL(croppedBlob)
          })

          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
              'anthropic-dangerous-client-side-key-warning': 'true',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 64,
              messages: [{
                role: 'user',
                content: [
                  { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: cropB64 } },
                  { type: 'text', text: 'この画像のメーター数値を読み取って、数字だけを返してください。数字以外は一切出力しないこと。' },
                ],
              }],
            }),
          })

          if (!resp.ok) {
            const errText = await resp.text()
            Sentry.captureException(new Error(`Anthropic ${resp.status}: ${errText}`), { tags: { ocr_step: 'api_response' } })
            onStatusChange?.({ phase: 'failed', detail: `HTTP ${resp.status}` })
          } else {
            const json = await resp.json()
            ocrRawText = json.content?.[0]?.text || null
            Sentry.captureMessage('ocr.api_call_success', { level: 'info', extra: { raw: ocrRawText } })
            const digits = ocrRawText?.replace(/[^0-9]/g, '') || ''
            if (digits) {
              extractedNumber = parseInt(digits, 10)
              Sentry.captureMessage('ocr.value_extracted', { level: 'info', extra: { extractedNumber } })
              onStatusChange?.({ phase: 'success', number: extractedNumber })
            } else {
              Sentry.captureMessage('ocr.value_empty', { level: 'warning', extra: { raw: ocrRawText } })
              onStatusChange?.({ phase: 'failed', detail: '数値抽出不可' })
            }
          }
        } catch (ocrErr) {
          Sentry.captureException(ocrErr, { tags: { ocr_step: 'api_call' } })
          console.warn('[NativeCamera] OCR failed:', ocrErr)
          onStatusChange?.({ phase: 'failed', detail: ocrErr.message })
        }
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { ocr_step: 'binarization' } })
      console.error('[NativeCamera] handleCapture error:', err)
      onStatusChange?.({ phase: 'failed', detail: err.message })
    }

    onOcrResult?.({ extractedNumber, photoUrl, croppedPhotoUrl, ocrRawText, ocrAttemptedAt })
    inputEl.value = ''
  }, [onOcrResult, storagePrefix, onStatusChange])

  return (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleCapture}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleCapture}
      />
    </>
  )
})

export default NativeCamera
