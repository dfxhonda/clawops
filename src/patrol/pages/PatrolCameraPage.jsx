import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { callMeterOcr } from '../services/ocrApi'
import { fileToBase64, getPhotoTakenTime } from '../utils/exifReader'
import OcrConfirm from '../components/OcrConfirm'
import LogoutButton from '../../components/LogoutButton'

// 'capture' | 'ocr_loading' | 'confirm' | 'saved'
export default function PatrolCameraPage() {
  const navigate = useNavigate()
  const { staffId } = useAuth()
  const fileInputRef = useRef(null)

  const [phase,     setPhase]     = useState('capture')
  const [imageUrl,  setImageUrl]  = useState(null)
  const [ocrResult, setOcrResult] = useState(null)
  const [takenAt,   setTakenAt]   = useState(null)
  const [ocrError,  setOcrError]  = useState(null)
  const [savedCount, setSavedCount] = useState(0)

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // プレビュー作成
    const url = URL.createObjectURL(file)
    setImageUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url })
    setPhase('ocr_loading')
    setOcrError(null)

    try {
      const [{ base64, mediaType }, exifTime] = await Promise.all([
        fileToBase64(file),
        getPhotoTakenTime(file),
      ])
      setTakenAt(exifTime)
      const result = await callMeterOcr(base64, null, mediaType)
      setOcrResult(result)
      setPhase('confirm')
    } catch (err) {
      setOcrError(err.message || 'OCR処理に失敗しました')
      setPhase('capture')
    }
  }

  function handleRetake() {
    setPhase('capture')
    setOcrResult(null)
    setOcrError(null)
  }

  function handleSaved(count) {
    setSavedCount(count)
    setPhase('saved')
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      {/* ヘッダー */}
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-xl text-muted">←</button>
        <div className="flex-1 text-sm font-bold">📸 OCR撮影</div>
        <LogoutButton />
      </div>

      <div className="flex-1 px-4 py-5">

        {/* 撮影フェーズ */}
        {phase === 'capture' && (
          <div className="space-y-4">
            <div className="text-xs text-muted text-center">
              機械パネルを正面から撮影してください。<br />
              機械コードラベルが写るようにしてください。
            </div>

            {ocrError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-xs">
                ⚠ {ocrError}
              </div>
            )}

            {/* カメラボタン */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 rounded-xl border-2 border-dashed border-accent/40 flex flex-col items-center justify-center gap-3 active:bg-surface transition-colors"
            >
              <span className="text-5xl">📷</span>
              <span className="text-sm font-bold text-accent">カメラで撮影</span>
              <span className="text-xs text-muted">タップしてカメラを起動</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />

            <button
              onClick={() => navigate('/patrol/batch-ocr')}
              className="w-full py-3 rounded-xl bg-surface border border-border text-sm font-bold active:scale-[0.98] transition-all"
            >
              📁 ギャラリーから一括登録
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full py-3 text-muted text-sm"
            >
              手入力モードに切替
            </button>
          </div>
        )}

        {/* OCR処理中 */}
        {phase === 'ocr_loading' && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            {imageUrl && (
              <div className="rounded-xl overflow-hidden border border-border max-h-40 w-full flex items-center justify-center bg-black">
                <img src={imageUrl} alt="" className="max-h-40 object-contain" />
              </div>
            )}
            <div className="animate-spin w-10 h-10 border-2 border-accent border-t-transparent rounded-full" />
            <div className="text-sm text-muted">OCR処理中... (2〜5秒)</div>
          </div>
        )}

        {/* 確認フェーズ */}
        {phase === 'confirm' && ocrResult && (
          <OcrConfirm
            imageUrl={imageUrl}
            ocrResult={ocrResult}
            readTime={takenAt}
            staffId={staffId}
            onRetake={handleRetake}
            onManual={() => navigate('/')}
            onSaved={handleSaved}
          />
        )}

        {/* 保存完了 */}
        {phase === 'saved' && (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <div className="text-5xl">✅</div>
            <div className="text-base font-bold">{savedCount}ブース保存しました</div>
            <button
              onClick={handleRetake}
              className="w-full py-4 rounded-xl bg-accent text-bg font-bold text-sm active:scale-[0.98] transition-all"
            >
              続けて撮影
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-xl bg-surface border border-border text-sm font-bold active:scale-[0.98] transition-all"
            >
              巡回状況に戻る
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
