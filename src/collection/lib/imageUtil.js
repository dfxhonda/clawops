// J-COLLECTION-05: 画像クライアント圧縮 / URL→DataURL fetch ユーティリティ
// canvas-based リサイズ + JPEG エンコード。新規deps不要。

export function compressImage(file, { maxWidth = 800, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxWidth / img.naturalWidth)
      const w = Math.max(1, Math.round(img.naturalWidth * scale))
      const h = Math.max(1, Math.round(img.naturalHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
    img.src = url
  })
}

// 画像URL → dataURL (PDFのaddImage埋込用)
export async function fetchAsDataURL(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`image fetch ${res.status}`)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('FileReader failed'))
    r.readAsDataURL(blob)
  })
}
