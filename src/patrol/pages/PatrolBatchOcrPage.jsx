import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { callMeterOcrBatch } from '../services/ocrApi'
import { validateMeterReading, is2BoothType } from '../utils/meterValidation'
import { getBooths, findMachineById } from '../../services/masters'
import { supabase } from '../../lib/supabase'
import OcrBatchList from '../components/OcrBatchList'
import LogoutButton from '../../components/LogoutButton'
import DebugLogBanner from '../components/DebugLogBanner'

// 'pick' | 'processing' | 'review' | 'saved'
export default function PatrolBatchOcrPage() {
  const navigate = useNavigate()
  const { staffId } = useAuth()
  const fileInputRef = useRef(null)

  const [phase,    setPhase]    = useState('pick')
  const [items,    setItems]    = useState([])    // { file, result, takenAt, status, imageUrl, checked }
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [saving,   setSaving]   = useState(false)
  const [saveResult, setSaveResult] = useState(null)
  const [batchError, setBatchError] = useState(null)

  async function handleFilesSelect(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    e.target.value = ''

    // オブジェクトURL作成
    const imageUrls = files.map(f => URL.createObjectURL(f))
    const initial = files.map((f, i) => ({
      file: f,
      imageUrl: imageUrls[i],
      result: null,
      takenAt: null,
      status: 'pending',
      checked: false,
    }))
    setItems(initial)
    setProgress({ done: 0, total: files.length })
    setBatchError(null)
    setPhase('processing')

    // バッチOCR（新API: onProgress なし、全完了後に結果を一括反映）
    let results
    try {
      results = await callMeterOcrBatch(files, 3)
    } catch (err) {
      console.error('[BatchOcr] 処理失敗:', err)
      setBatchError(`OCR処理に失敗しました: ${err?.message || err}\nネットワークと画像形式を確認してください。`)
      setPhase('pick')
      return
    }

    setProgress({ done: results.length, total: files.length })
    setItems(prev =>
      results.map(r => {
        const base = prev[r.index] ?? { imageUrl: '', checked: false }
        // ocrFromFile が exifTime を result に混ぜて返すので分離する
        const { exifTime, ...ocrData } = r.result ?? {}
        const ocrResult = r.status === 'success' ? ocrData : null
        const next = { ...base, file: r.file, result: ocrResult, takenAt: exifTime ?? null, status: r.status }
        if (ocrResult) {
          const is2B = is2BoothType(ocrResult.machine_type_guess)
          const { blocked } = validateMeterReading(ocrResult, null, is2B)
          next.checked = !blocked && (ocrResult.confidence ?? 0) >= 0.8 && !!ocrResult.machine_code
        }
        return next
      })
    )

    setPhase('review')
  }

  function handleCheck(index, val) {
    setItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], checked: val }
      return next
    })
  }

  function handleUpdate(index, result) {
    setItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], result }
      return next
    })
  }

  async function handleSaveAll() {
    const targets = items.filter(it => it.checked && it.result)
    if (!targets.length) return
    setSaving(true)
    let saved = 0
    let failed = 0

    for (const item of targets) {
      try {
        const { result, takenAt } = item
        const mc = result.machine_code
        if (!mc) { failed++; continue }

        const [machine, booths] = await Promise.all([
          findMachineById(mc),
          getBooths(mc),
        ])
        if (!booths.length) { failed++; continue }

        const is2B    = is2BoothType(result.machine_type_guess)
        const storeCode = machine?.store_code || ''
        const readTimeIso = takenAt ? new Date(takenAt).toISOString() : new Date().toISOString()
        const patrolDate  = readTimeIso.slice(0, 10)
        const conf        = result.confidence ?? 0
        const m           = result.meters || {}

        const records = []
        if (is2B && booths.length >= 2) {
          records.push({
            full_booth_code: booths[0].booth_code,
            store_code:      storeCode,
            machine_code:    mc,
            in_meter:        m.left_in  ?? null,
            out_meter:       m.left_out ?? null,
            input_method:    'ocr',
            ocr_confidence:  conf,
            read_time:       readTimeIso,
            patrol_date:     patrolDate,
            created_by:      staffId,
          })
          records.push({
            full_booth_code: booths[1].booth_code,
            store_code:      storeCode,
            machine_code:    mc,
            in_meter:        m.right_in  ?? null,
            out_meter:       m.right_out ?? null,
            input_method:    'ocr',
            ocr_confidence:  conf,
            read_time:       readTimeIso,
            patrol_date:     patrolDate,
            created_by:      staffId,
          })
        } else {
          records.push({
            full_booth_code: booths[0].booth_code,
            store_code:      storeCode,
            machine_code:    mc,
            in_meter:        m.in_meter  ?? null,
            out_meter:       m.out_meter ?? null,
            input_method:    'ocr',
            ocr_confidence:  conf,
            read_time:       readTimeIso,
            patrol_date:     patrolDate,
            created_by:      staffId,
          })
        }

        const { error } = await supabase.from('meter_readings').insert(records)
        if (error) throw error
        saved += records.length
      } catch {
        failed++
      }
    }

    setSaving(false)
    setSaveResult({ saved, failed })
    setPhase('saved')
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      {/* ヘッダー */}
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => phase === 'review' ? setPhase('pick') : navigate('/patrol/camera')}
          className="text-xl text-muted"
        >
          ←
        </button>
        <div className="flex-1 text-sm font-bold">📁 ギャラリー一括登録</div>
        <LogoutButton />
      </div>

      {/* ピックフェーズ */}
      {phase === 'pick' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
          {batchError && (
            <div className="w-full bg-red-900/40 border border-red-500 text-red-200 p-3 rounded-lg whitespace-pre-wrap text-sm">
              {batchError}
              <button
                onClick={() => setBatchError(null)}
                className="ml-2 underline"
              >
                閉じる
              </button>
            </div>
          )}
          <div className="text-5xl">📁</div>
          <div className="text-base font-bold text-center">ギャラリーから複数枚選択</div>
          <div className="text-xs text-muted text-center">
            最大20枚まで同時選択できます。<br />
            撮影日時はEXIFから自動取得されます。
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-4 rounded-xl bg-accent text-bg font-bold text-sm active:scale-[0.98] transition-all"
          >
            画像を選択
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFilesSelect}
          />
          <button onClick={() => navigate('/patrol/camera')} className="text-xs text-muted">
            ← カメラ撮影に戻る
          </button>
        </div>
      )}

      {/* 処理中 */}
      {phase === 'processing' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
          <div className="animate-spin w-12 h-12 border-2 border-accent border-t-transparent rounded-full" />
          <div className="text-base font-bold">OCR処理中...</div>
          <div className="text-sm text-muted">{progress.done} / {progress.total} 枚</div>
          <div className="w-full max-w-xs h-2 rounded-full bg-surface2 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
          {/* 処理済みのサムネイルプレビュー */}
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {items.slice(0, progress.done).map((it, i) => (
              <div key={i} className="w-14 h-14 rounded-lg overflow-hidden border border-border">
                <img src={it.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* レビュー */}
      {phase === 'review' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 text-xs text-muted border-b border-border">
            {items.length}枚のOCR完了 — タップして修正、チェックして保存
          </div>
          <OcrBatchList
            items={items}
            onCheck={handleCheck}
            onUpdate={handleUpdate}
            staffId={staffId}
            onSaveAll={handleSaveAll}
            saving={saving}
          />
        </div>
      )}

      {/* 保存完了 */}
      {phase === 'saved' && saveResult && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div className="text-5xl">✅</div>
          <div className="text-base font-bold text-center">
            {saveResult.saved}ブース保存しました
            {saveResult.failed > 0 && (
              <div className="text-sm text-red-400 mt-1">{saveResult.failed}件はスキップ</div>
            )}
          </div>
          <button
            onClick={() => { setItems([]); setPhase('pick') }}
            className="w-full py-4 rounded-xl bg-accent text-bg font-bold text-sm active:scale-[0.98] transition-all"
          >
            続けて選択
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 rounded-xl bg-surface border border-border text-sm font-bold active:scale-[0.98] transition-all"
          >
            巡回状況に戻る
          </button>
        </div>
      )}
      {/* デバッグログバナー（一時追加 — 確認後削除） */}
      <DebugLogBanner />
    </div>
  )
}
