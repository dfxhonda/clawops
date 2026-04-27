import { useEffect, useState } from 'react'

export function useKeyboardHeight() {
  const [kh, setKh] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const handler = () => {
      const h = window.innerHeight - vv.height
      setKh(h > 50 ? h : 0)
    }
    vv.addEventListener('resize', handler)
    vv.addEventListener('scroll', handler)
    handler()
    return () => {
      vv.removeEventListener('resize', handler)
      vv.removeEventListener('scroll', handler)
    }
  }, [])
  return kh
}
