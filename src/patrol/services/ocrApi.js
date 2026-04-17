import { supabase } from '../../lib/supabase'
import { fileToBase64, getPhotoTakenTime } from '../utils/exifReader'

/**
 * 1枚の画像をOCR処理する
 * @param {string} imageBase64 - Base64文字列（data:xxx;base64, プレフィクスなし）
 * @param {string|null} hintMachineType
 * @param {string} mediaType
 * @returns {Promise<{machine_code, machine_type_guess, meters, confidence}>}
 */
export async function callMeterOcr(imageBase64, hintMachineType = null, mediaType = 'image/jpeg') {
  const { data, error } = await supabase.functions.invoke('meter-ocr', {
    body: {
      image_base64:     imageBase64,
      hint_machine_type: hintMachineType,
      media_type:       mediaType,
    },
  })
  if (error) throw error
  return data
}

/**
 * 複数ファイルを並列OCR処理する（同時実行数制限付き）
 * @param {File[]} files
 * @param {function} onProgress - ({ index, total, item }) コールバック
 * @param {number} concurrency
 * @returns {Promise<Array<{file, result, takenAt, status: 'success'|'error', error?}>>}
 */
export async function callMeterOcrBatch(files, onProgress = null, concurrency = 3) {
  const results = new Array(files.length).fill(null)
  const queue = files.map((file, index) => ({ file, index }))
  const total = files.length

  async function worker() {
    while (queue.length > 0) {
      const { file, index } = queue.shift()
      try {
        const { base64, mediaType } = await fileToBase64(file)
        const takenAt = await getPhotoTakenTime(file)

        const result = await callMeterOcr(base64, null, mediaType)
        results[index] = { file, result, takenAt, status: 'success' }
      } catch (err) {
        results[index] = { file, result: null, takenAt: null, status: 'error', error: err }
      }
      if (onProgress) onProgress({ index, total, item: results[index] })
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return results
}
