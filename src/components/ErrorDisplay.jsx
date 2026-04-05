// ============================================
// ErrorDisplay: 統一エラー表示コンポーネント
// 保存失敗、権限不足、二重送信、在庫不足を統一的に表示
// ============================================
import { useState } from 'react'

const ERROR_TYPES = {
  permission: { icon: '🔒', title: '権限がありません', color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-700' },
  network: { icon: '📡', title: '通信エラー', color: 'text-red-400', bg: 'bg-red-900/30 border-red-700' },
  save_failed: { icon: '💾', title: '保存に失敗しました', color: 'text-red-400', bg: 'bg-red-900/30 border-red-700' },
  duplicate: { icon: '⚠️', title: 'すでに送信済みです', color: 'text-orange-400', bg: 'bg-orange-900/30 border-orange-700' },
  stock_insufficient: { icon: '📦', title: '在庫が不足しています', color: 'text-orange-400', bg: 'bg-orange-900/30 border-orange-700' },
  validation: { icon: '✏️', title: '入力内容を確認してください', color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-700' },
  unknown: { icon: '❌', title: 'エラーが発生しました', color: 'text-red-400', bg: 'bg-red-900/30 border-red-700' },
}

/**
 * エラーメッセージからエラー種別を自動判定
 */
export function classifyError(error) {
  const msg = typeof error === 'string' ? error : error?.message || ''
  if (msg.includes('権限') || msg.includes('permission') || msg.includes('403') || msg.includes('row-level security')) return 'permission'
  if (msg.includes('通信') || msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to fetch')) return 'network'
  if (msg.includes('在庫不足') || msg.includes('Stock not found')) return 'stock_insufficient'
  if (msg.includes('duplicate') || msg.includes('重複') || msg.includes('すでに')) return 'duplicate'
  if (msg.includes('保存') || msg.includes('更新') || msg.includes('追加') || msg.includes('エラー')) return 'save_failed'
  return 'unknown'
}

/**
 * 統一エラー表示コンポーネント
 * @param {string|Error} error - エラーメッセージまたはErrorオブジェクト
 * @param {string} [type] - エラー種別（省略時は自動判定）
 * @param {function} [onRetry] - 再試行ボタンのコールバック
 * @param {function} [onDismiss] - 閉じるボタンのコールバック
 */
export default function ErrorDisplay({ error, type, onRetry, onDismiss }) {
  const [dismissed, setDismissed] = useState(false)
  if (!error || dismissed) return null

  const msg = typeof error === 'string' ? error : error?.message || '不明なエラー'
  const errorType = type || classifyError(error)
  const config = ERROR_TYPES[errorType] || ERROR_TYPES.unknown

  return (
    <div className={`${config.bg} border rounded-xl p-4 mb-4`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${config.color}`}>{config.title}</p>
          <p className="text-muted text-xs mt-1">{msg}</p>
          <div className="flex gap-2 mt-3">
            {onRetry && (
              <button onClick={onRetry}
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold">
                再試行
              </button>
            )}
            {onDismiss ? (
              <button onClick={onDismiss}
                className="text-xs px-3 py-1.5 bg-surface2 hover:bg-surface text-muted rounded-lg">
                閉じる
              </button>
            ) : (
              <button onClick={() => setDismissed(true)}
                className="text-xs px-3 py-1.5 bg-surface2 hover:bg-surface text-muted rounded-lg">
                閉じる
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
