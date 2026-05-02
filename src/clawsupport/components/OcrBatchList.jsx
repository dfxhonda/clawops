import { useState } from 'react'
import { is2BoothType, validateMeterReading } from '../utils/meterValidation'
import OcrConfirm from './OcrConfirm'

/**
 * バッチOCR結果のレビューリスト
 *
 * Props:
 *   items      Array<{file, result, takenAt, status, imageUrl, checked}>
 *   onCheck    fn(index, bool)
 *   onUpdate   fn(index, result)
 *   staffId    string
 *   onSaveAll  fn()
 *   saving     bool
 */
export default function OcrBatchList({ items, onCheck, onUpdate, staffId, onSaveAll, saving }) {
  const [editIndex, setEditIndex] = useState(null)

  const checkedCount = items.filter(it => it.checked).length

  if (editIndex !== null) {
    const item = items[editIndex]
    return (
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setEditIndex(null)} className="text-xl text-muted">←</button>
          <div className="text-sm font-bold">
            {item.result?.machine_code || '機械コード不明'} — 確認・修正
          </div>
        </div>
        <OcrConfirm
          imageUrl={item.imageUrl}
          ocrResult={item.result}
          readTime={item.takenAt}
          staffId={staffId}
          onRetake={() => setEditIndex(null)}
          onManual={() => setEditIndex(null)}
          onSaved={() => {
            onCheck(editIndex, false) // 保存済みはチェック外す
            setEditIndex(null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* リスト */}
      <div className="flex-1 overflow-y-auto">
        {items.map((item, i) => {
          const res = item.result
          const is2B = is2BoothType(res?.machine_type_guess)
          const { warnings, blocked } = res
            ? validateMeterReading(res, null, is2B)
            : { warnings: ['OCR失敗'], blocked: false }
          const needsReview = item.status === 'error' || blocked || (res?.confidence ?? 0) < 0.8 || !res?.machine_code

          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3.5 border-b border-border
                ${needsReview ? 'bg-yellow-500/5' : ''}`}
            >
              {/* チェックボックス */}
              <button
                onClick={() => !needsReview && onCheck(i, !item.checked)}
                className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0
                  ${item.checked ? 'bg-accent border-accent text-bg' : 'border-border'}
                  ${needsReview ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {item.checked && '✓'}
              </button>

              {/* サムネイル */}
              <div className="w-12 h-10 rounded overflow-hidden bg-surface2 shrink-0">
                {item.imageUrl && (
                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                )}
              </div>

              {/* 情報 */}
              <div className="flex-1 min-w-0" onClick={() => setEditIndex(i)}>
                <div className="text-sm font-mono font-bold truncate">
                  {item.status === 'error'
                    ? <span className="text-red-400">エラー</span>
                    : res?.machine_code || <span className="text-yellow-400">コード不明</span>
                  }
                </div>
                <div className="text-[10px] text-muted mt-0.5">
                  {res ? `信頼 ${((res.confidence ?? 0) * 100).toFixed(0)}%` : '取得失敗'}
                  {warnings.length > 0 && (
                    <span className="ml-2 text-yellow-400">{warnings[0]}</span>
                  )}
                </div>
              </div>

              {/* 状態アイコン */}
              <div className="shrink-0 text-base" onClick={() => setEditIndex(i)}>
                {item.status === 'error' ? '❌' :
                  needsReview ? '⚠️' :
                  item.checked ? '✅' : '⬜'}
              </div>
            </div>
          )
        })}
      </div>

      {/* フッター */}
      <div className="shrink-0 px-4 py-4 border-t border-border bg-bg">
        <div className="text-xs text-muted mb-3 text-center">
          チェック済み {checkedCount} / {items.length} 件
        </div>
        <button
          onClick={onSaveAll}
          disabled={saving || checkedCount === 0}
          className="w-full py-4 rounded-xl bg-accent text-bg font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          {saving ? '保存中...' : `チェック済み ${checkedCount} 件を保存`}
        </button>
      </div>
    </div>
  )
}
