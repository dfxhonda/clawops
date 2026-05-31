// J-STOCK-OCR-COUNT-TEST-01 (司令塔Opus spec): カメラ/ギャラリー撮影 + OCR + 数値修正 UI。
// 注: 当初 useOCR (clawsupport/hooks/useOCR.js) を import 流用予定だったが eslint boundaries で
//     tanasupport → clawsupport の cross-module dep が禁止のため (.dependency-cruiser/eslint-plugin-boundaries)、
//     ocr-meter Edge Function 呼び出しを本ファイル内に inline 再実装。タイムアウト 6s を踏襲。
//     これは spec implementation_notes 1_decisions_not_in_spec / 4_deviations_from_spec に該当。
import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

const OCR_TIMEOUT_MS = 6000

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result || '')
      const i = s.indexOf(',')
      resolve(i >= 0 ? s.slice(i + 1) : s)
    }
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

async function callOcrMeter(imageBase64) {
  const ocrPromise = supabase.functions.invoke('ocr-meter', {
    body: { image_base64: imageBase64, media_type: 'image/jpeg' },
  })
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('OCR_TIMEOUT_6S')), OCR_TIMEOUT_MS)
  )
  const { data, error } = await Promise.race([ocrPromise, timeoutPromise])
  if (error) throw new Error(error.message || 'OCR invoke error')
  const meters = data?.meters ?? []
  const first = meters[0]
  return { value: first?.value ?? null, confidence: first?.confidence ?? null, meters }
}

export default function OcrCountCapture({ onLog }) {
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [ocrValue, setOcrValue] = useState(null)
  const [ocrConfidence, setOcrConfidence] = useState(null)
  const [confirmed, setConfirmed] = useState('')
  const [phase, setPhase] = useState('idle')   // idle | running | done | error
  const [errMsg, setErrMsg] = useState(null)

  async function handleFile(file) {
    if (!file) return
    setPhase('running'); setErrMsg(null); setOcrValue(null); setOcrConfidence(null); setConfirmed('')
    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)
    try {
      const base64 = await blobToBase64(file)
      const res = await callOcrMeter(base64)
      setOcrValue(res.value)
      setOcrConfidence(res.confidence)
      setConfirmed(res.value != null ? String(res.value) : '')
      setPhase('done')
    } catch (e) {
      const msg = e?.message === 'OCR_TIMEOUT_6S' ? 'OCR タイムアウト (6s) — 手入力してください' : String(e?.message || e)
      setPhase('error'); setErrMsg(msg)
    }
  }

  function appendDigit(d) {
    if (d === 'C') { setConfirmed(''); return }
    if (d === '←') { setConfirmed(s => s.slice(0, -1)); return }
    if (confirmed.length >= 4) return
    setConfirmed(s => (s + d).replace(/^0+(?=\d)/, ''))
  }

  function record() {
    const conf = Number(confirmed)
    if (!Number.isFinite(conf)) return
    onLog({
      ts: Date.now(),
      ocr_value: ocrValue,
      confirmed_value: conf,
      confidence: ocrConfidence,
      correct: ocrValue != null && Number(ocrValue) === conf,
    })
    setPreview(null); setOcrValue(null); setOcrConfidence(null); setConfirmed(''); setPhase('idle')
  }

  function retry() {
    setPreview(null); setOcrValue(null); setOcrConfidence(null); setConfirmed(''); setPhase('idle'); setErrMsg(null)
  }

  const numpadDisabled = phase === 'idle' || phase === 'running'
  const canRecord = phase === 'done' && confirmed !== '' && Number.isFinite(Number(confirmed))

  return (
    <div data-testid="ocr-count-capture" className="flex flex-col gap-2">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={e => handleFile(e.target.files?.[0])}
        style={{ display: 'none' }}
        data-testid="ocr-count-camera-input"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={e => handleFile(e.target.files?.[0])}
        style={{ display: 'none' }}
        data-testid="ocr-count-gallery-input"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          data-testid="ocr-count-camera-btn"
          className="flex-1 min-h-[44px] rounded-lg bg-emerald-600 text-white font-bold text-sm"
        >
          📷 撮影する
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          data-testid="ocr-count-gallery-btn"
          className="flex-1 min-h-[44px] rounded-lg bg-surface border border-border text-text font-bold text-sm"
        >
          🖼 ギャラリー
        </button>
      </div>

      {preview && (
        <div className="rounded-lg overflow-hidden border border-border bg-black">
          <img src={preview} alt="preview" style={{ width: '100%', maxHeight: '40vh', objectFit: 'contain' }} />
        </div>
      )}

      {phase === 'running' && (
        <p data-testid="ocr-count-running" className="text-xs text-amber-300">読み取り中...</p>
      )}
      {phase === 'error' && (
        <p data-testid="ocr-count-error" className="text-xs text-rose-300">{errMsg || 'OCR 失敗'}</p>
      )}
      {phase === 'done' && (
        <div className="flex items-baseline gap-3">
          <span className="text-xs text-muted">読み取り結果:</span>
          <span data-testid="ocr-count-result" className="text-2xl font-mono font-bold text-text">
            {ocrValue != null ? ocrValue : '?'}
          </span>
          <span className="text-xs text-muted">個</span>
          {ocrConfidence != null && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300">
              信頼度 {Math.round(Number(ocrConfidence) * 100)}%
            </span>
          )}
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg p-2 mt-1">
        <p className="text-xs text-muted mb-1">確定値 (タップで修正)</p>
        <div className="bg-bg border border-border rounded px-3 py-2 text-2xl font-mono font-bold text-text text-right min-h-[44px]">
          {confirmed || '—'}
        </div>
        <div className="grid grid-cols-3 gap-1 mt-2">
          {['1','2','3','4','5','6','7','8','9','C','0','←'].map(k => (
            <button
              key={k}
              type="button"
              disabled={numpadDisabled}
              onClick={() => appendDigit(k)}
              data-testid={`ocr-count-key-${k}`}
              className="min-h-[44px] rounded bg-bg border border-border text-text font-mono text-base font-bold disabled:opacity-30"
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={record}
          disabled={!canRecord}
          data-testid="ocr-count-record-btn"
          className="flex-1 min-h-[44px] rounded-lg bg-emerald-600 text-white font-bold text-sm disabled:opacity-30"
        >
          記録する
        </button>
        <button
          type="button"
          onClick={retry}
          data-testid="ocr-count-retry-btn"
          className="flex-1 min-h-[44px] rounded-lg bg-surface border border-border text-text font-bold text-sm"
        >
          もう一枚
        </button>
      </div>
    </div>
  )
}
