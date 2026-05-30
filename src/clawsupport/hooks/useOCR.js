import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

// J-PATROL-99_adhoc_ocr_5s_timeout-fix-02 (2026-05-30 ヒロ承認):
// 8s → 5s に短縮。ヒロ要件「可否関わらず5秒で判断」、5s 経過後は手入力フォールバック。
// J-PATROL-99_adhoc_ocr_timeout_6s-fix-11 (2026-05-30 ヒロ承認、選択肢 b):
// 5s → 6s に緩和。cold start 1s margin を確保し正常応答が timeout 化する確率を下げる。
const OCR_TIMEOUT_MS = 6000

function jstDate() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

export function useOCR({ boothCode, orgId }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Storage upload は OCR 経路から独立、呼出側 (handleOCRUse 等) が任意のタイミングで発火する。
  // 戻り値の uploadStorage プロパティ経由か、フック戻り値の uploadPhoto で呼べる。
  const uploadPhoto = useCallback(async (blob) => {
    if (!orgId || !boothCode || !blob) return { url: null, path: null, uploadError: null }
    const path = `${orgId}/${boothCode}/${jstDate()}_${Date.now()}.jpg`
    const { data, error: e } = await supabase.storage
      .from('meter-photos')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
    if (e) return { url: null, path: null, uploadError: e?.message }
    const { data: signedData, error: signErr } = await supabase.storage
      .from('meter-photos')
      .createSignedUrl(data.path, 60 * 60 * 24 * 365)
    return { url: signedData?.signedUrl ?? null, path: data.path, uploadError: signErr?.message ?? null }
  }, [boothCode, orgId])

  // J-PATROL-99_adhoc_ocr_haiku_lazy_upload-fix-12 (2026-05-30 ヒロ承認):
  // 旧 (fix-07 並列): uploadPhoto と invoke を Promise.race で並列発火、OCR 成功後に最大 1s
  //     upload 完了を待ち合わせる構造。iOS Safari 同時接続/連結伝送状況によっては
  //     OCR critical path を阻害し timeout を誘発する事例観察。
  // 新 (lazy): runOCR は OCR invoke のみ。upload は完全遅延、戻り値 uploadStorage(blob) factory
  //     を呼ぶことで任意のタイミング (= 通常「使う」ボタン押下後) に発火させる。
  //     OCR 計算経路は OCR invoke + timeout 6s だけになり、iPhone 弱電波でも 5-7s に収まる。
  const runOCR = useCallback(async (imageBase64, blob) => {
    setLoading(true)
    setError(null)

    try {
      const ocrPromise = supabase.functions.invoke('ocr-meter', {
        body: { image_base64: imageBase64, media_type: 'image/jpeg' },
      })
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OCR_TIMEOUT_6S')), OCR_TIMEOUT_MS)
      )

      let data, invokeError
      try {
        const result = await Promise.race([ocrPromise, timeoutPromise])
        data = result.data
        invokeError = result.error
      } catch (err) {
        if (err.message === 'OCR_TIMEOUT_6S' || err.message === 'OCR_TIMEOUT_5S' || err.message === 'OCR_TIMEOUT_8S') {
          return {
            meters: [], value: null,
            photoUrl: null, storagePath: null,
            timeout: true,
            uploadError: null,
            uploadStorage: () => uploadPhoto(blob),
          }
        }
        throw err
      }

      if (invokeError) throw new Error(invokeError.message)

      const meters = data?.meters ?? []
      const inLike = m => ['in','yen1000_in','yen500_in','yen100_in','change_in'].includes(m.type) ||
                          /IN/i.test(m.label || '')
      const value = meters.find(inLike)?.value ?? null
      return {
        meters, value,
        // 後方互換: photoUrl/storagePath/uploadError は initial null。
        // 呼出側は uploadStorage() factory を呼んで上書きする。
        photoUrl: null, storagePath: null, uploadError: null,
        uploadStorage: () => uploadPhoto(blob),
      }
    } catch (e) {
      setError(e.message || 'OCR失敗')
      return {
        meters: [], value: null,
        photoUrl: null, storagePath: null, uploadError: null,
        uploadStorage: () => uploadPhoto(blob),
      }
    } finally {
      setLoading(false)
    }
  }, [uploadPhoto])

  // engine: null = single engine (ocr-meter Supabase Edge Function)
  return { engine: null, toggleEngine: () => {}, loading, error, runOCR, uploadPhoto }
}
