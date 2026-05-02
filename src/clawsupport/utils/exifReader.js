import EXIF from 'exif-js'

/**
 * 画像ファイルからEXIF撮影日時を取得してISO文字列で返す
 * @param {File} file
 * @returns {Promise<string|null>} ISO文字列 or null
 */
export function getPhotoTakenTime(file) {
  return new Promise((resolve) => {
    EXIF.getData(file, function () {
      const dateTime = EXIF.getTag(this, 'DateTimeOriginal')
      if (!dateTime) return resolve(null)
      // '2026:04:16 14:30:22' → ISO形式
      // 日付部の : を - に変換してISOフォーマットへ
      const parts = dateTime.split(' ')
      if (parts.length < 2) return resolve(null)
      const datePart = parts[0].replace(/:/g, '-')
      const timePart = parts[1]
      try {
        const iso = new Date(`${datePart}T${timePart}`).toISOString()
        resolve(iso)
      } catch {
        resolve(null)
      }
    })
  })
}

/**
 * FileをBase64文字列に変換（data:xxx;base64, プレフィクスなし）
 * @param {File} file
 * @returns {Promise<{base64: string, mediaType: string}>}
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      const comma = result.indexOf(',')
      const base64 = comma >= 0 ? result.slice(comma + 1) : result
      const mediaType = file.type || 'image/jpeg'
      resolve({ base64, mediaType })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
