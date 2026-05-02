import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
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

const NativeCamera = forwardRef(function NativeCamera({ onOcrResult, storagePrefix }, ref) {
  const inputRef = useRef(null)

  useImperativeHandle(ref, () => ({
    trigger: () => inputRef.current?.click(),
  }))

  const handleCapture = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    let photoUrl = null
    let croppedPhotoUrl = null
    let extractedNumber = null

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

      // Supabase Storage upload
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
      } catch (storageErr) {
        console.warn('[NativeCamera] Storage upload failed:', storageErr)
      }

      // Claude Vision OCR
      try {
        const cropB64 = await new Promise(resolve => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(',')[1])
          reader.readAsDataURL(croppedBlob)
        })

        const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
        if (!apiKey) {
          console.warn('[NativeCamera] VITE_ANTHROPIC_API_KEY not set, skipping OCR')
        } else {
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
          const json = await resp.json()
          const text = json.content?.[0]?.text?.replace(/[^0-9]/g, '')
          if (text) extractedNumber = parseInt(text, 10)
        }
      } catch (ocrErr) {
        console.warn('[NativeCamera] OCR failed:', ocrErr)
      }
    } catch (err) {
      console.error('[NativeCamera] handleCapture error:', err)
    }

    onOcrResult?.({ extractedNumber, photoUrl, croppedPhotoUrl })
    if (inputRef.current) inputRef.current.value = ''
  }, [onOcrResult, storagePrefix])

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleCapture}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 16px', borderRadius: 8, border: 'none',
          backgroundColor: '#0f766e', color: '#fff',
          fontSize: 15, fontWeight: 600, cursor: 'pointer',
        }}
      >
        📸 撮影
      </button>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
        💡フラッシュONで撮ると認識精度UP
      </div>
    </div>
  )
})

export default NativeCamera
