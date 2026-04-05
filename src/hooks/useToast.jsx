// ============================================
// useToast: トースト通知の状態管理フック
// 各ページで重複していたパターンを統一
// ============================================
import { useState, useCallback, useRef } from 'react'

/**
 * トースト通知を管理するフック
 *
 * @param {Object} options
 * @param {number} [options.successDuration=3000] - 成功メッセージの表示時間(ms)
 * @param {number} [options.errorDuration=8000]   - エラーメッセージの表示時間(ms)
 *
 * @example
 *   const { toast, showToast, Toast } = useToast()
 *   showToast('保存しました', 'success')
 *   return <Toast />
 */
export function useToast({ successDuration = 3000, errorDuration = 8000 } = {}) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const showToast = useCallback((msg, type = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ msg, type })
    const duration = type === 'error' ? errorDuration : successDuration
    timerRef.current = setTimeout(() => setToast(null), duration)
  }, [successDuration, errorDuration])

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  // レンダリング用コンポーネント
  function Toast() {
    if (!toast) return null
    return (
      <div
        onClick={dismissToast}
        className={`fixed top-16 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl font-bold text-sm shadow-lg cursor-pointer transition-all
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
        {toast.msg}
      </div>
    )
  }

  return { toast, showToast, dismissToast, Toast }
}
