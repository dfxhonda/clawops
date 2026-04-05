// ============================================
// useAsync: 非同期処理の状態管理を統一するフック
// loading / error / data を一箇所で管理
// ============================================
import { useState, useCallback, useRef } from 'react'
import { classifyError } from '../components/ErrorDisplay'

/**
 * 非同期関数の実行状態を管理するフック
 *
 * @example
 *   const { execute, loading, error, clearError } = useAsync()
 *   async function handleSave() {
 *     const result = await execute(() => saveReading(data))
 *     if (result) showToast('保存完了')
 *   }
 */
export function useAsync() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const lastFnRef = useRef(null)

  const execute = useCallback(async (asyncFn) => {
    lastFnRef.current = asyncFn
    setLoading(true)
    setError(null)
    try {
      const result = await asyncFn()
      setLoading(false)
      return result
    } catch (e) {
      const msg = e?.message || '不明なエラー'
      setError({ message: msg, type: classifyError(msg) })
      setLoading(false)
      return null
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  /** 最後に実行した非同期関数を再実行する */
  const retry = useCallback(() => {
    if (lastFnRef.current) return execute(lastFnRef.current)
    return Promise.resolve(null)
  }, [execute])

  /**
   * ErrorDisplay に渡す props を生成する
   * @example <ErrorDisplay {...errorProps} />
   */
  const errorProps = error ? { error: error.message, type: error.type, onRetry: retry, onDismiss: clearError } : null

  return { loading, error, execute, clearError, retry, errorProps }
}

/**
 * 初回マウント時に非同期データを取得するフック
 *
 * @example
 *   const { data, loading, error } = useAsyncData(
 *     () => getStores(),
 *     []  // deps
 *   )
 */
export function useAsyncData(asyncFn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // deps で再実行
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => {
    let cancelled = false
    ;(async () => {
      try {
        const result = await asyncFn()
        if (!cancelled) { setData(result); setLoading(false) }
      } catch (e) {
        if (!cancelled) {
          setError({ message: e?.message || '不明なエラー', type: classifyError(e) })
          setLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  })

  return { data, loading, error }
}
