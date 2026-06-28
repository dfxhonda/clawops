// SPEC-IOS-KEYBOARD-VIEWPORT-ANCHOR-FIX-01
// iOS Safari がテキストinput focus時に visual viewport の offsetTop を増加させる。
// overflow:hidden は document.scrollTop をブロックするが visual viewport offset は防げない。
// このフックで offsetTop を購読し PageHeader の translateY で追従させ画面外消失を防ぐ。
import { useState, useEffect } from 'react'

export function useVisualViewportOffset() {
  const [offsetTop, setOffsetTop] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return
    const vv = window.visualViewport
    const update = () => setOffsetTop(vv.offsetTop)
    vv.addEventListener('scroll', update)
    vv.addEventListener('resize', update)
    return () => {
      vv.removeEventListener('scroll', update)
      vv.removeEventListener('resize', update)
    }
  }, [])

  return offsetTop
}
