import { useCallback, useEffect, useRef, useState } from 'react'

const RATE_LIMIT_MS = 300
const SUCCESS_RESET_MS = 3000

export function useSaveState() {
  const [state, setState] = useState({ status: 'idle', errCode: null, errMessage: null })
  const lastLoadAt = useRef(0)
  const successTimer = useRef(null)

  useEffect(() => () => {
    if (successTimer.current) clearTimeout(successTimer.current)
  }, [])

  const setLoading = useCallback(() => {
    const now = Date.now()
    if (now - lastLoadAt.current < RATE_LIMIT_MS) return false
    lastLoadAt.current = now
    if (successTimer.current) { clearTimeout(successTimer.current); successTimer.current = null }
    setState({ status: 'loading', errCode: null, errMessage: null })
    return true
  }, [])

  const setError = useCallback((errCode, errMessage) => {
    setState({ status: 'error', errCode: errCode ?? null, errMessage: errMessage ?? null })
  }, [])

  const setSuccess = useCallback(() => {
    setState({ status: 'success', errCode: null, errMessage: null })
    successTimer.current = setTimeout(() => {
      setState(s => s.status === 'success' ? { status: 'idle', errCode: null, errMessage: null } : s)
    }, SUCCESS_RESET_MS)
  }, [])

  const reset = useCallback(() => {
    if (successTimer.current) { clearTimeout(successTimer.current); successTimer.current = null }
    setState({ status: 'idle', errCode: null, errMessage: null })
  }, [])

  return [state, { setLoading, setError, setSuccess, reset }]
}
