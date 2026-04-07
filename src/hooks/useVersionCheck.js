import { useState, useEffect } from 'react'
import { BUILD_SHA } from '../lib/buildInfo'

const INTERVAL_MS = 10 * 60 * 1000 // 10分

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [latestSha, setLatestSha] = useState(null)

  async function check() {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`)
      if (!res.ok) return
      const data = await res.json()
      if (!data.sha || data.sha === BUILD_SHA) return
      if (sessionStorage.getItem('dismissed-sha') === data.sha) return
      setLatestSha(data.sha)
      setUpdateAvailable(true)
    } catch {
      // オフライン / フェッチ失敗は無視
    }
  }

  function dismiss() {
    sessionStorage.setItem('dismissed-sha', latestSha)
    setUpdateAvailable(false)
  }

  useEffect(() => {
    if (BUILD_SHA === 'local') return // dev モードはスキップ

    check()
    const interval = setInterval(check, INTERVAL_MS)

    function handleVisibility() {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return { updateAvailable, dismiss }
}
