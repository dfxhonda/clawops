import { useState, useEffect } from 'react'
import { BUILD_SHA } from '../lib/buildInfo'

const STORAGE_KEY = 'clawops_prev_build_sha'
const LABEL_DURATION_MS = 4000

export function usePwaUpdate() {
  const [justUpdated, setJustUpdated] = useState(false)

  useEffect(() => {
    if (BUILD_SHA === 'local') return

    const prev = localStorage.getItem(STORAGE_KEY)
    if (prev !== null && prev !== BUILD_SHA) {
      setJustUpdated(true)
      setTimeout(() => setJustUpdated(false), LABEL_DURATION_MS)
    }
    localStorage.setItem(STORAGE_KEY, BUILD_SHA)
  }, [])

  return { justUpdated }
}
