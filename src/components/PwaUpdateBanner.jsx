// SPEC-PWA-SW-CONTROLLERCHANGE-RELOAD-01
// 新版SW検出時に下部固定バナーを表示。[更新]タップでupdateSW()→リロード。
import { useState, useEffect } from 'react'
import { updateSW } from '../lib/swRegistration'

export default function PwaUpdateBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    function handleNeedRefresh() { setShow(true) }
    window.addEventListener('pwa-need-refresh', handleNeedRefresh)
    return () => window.removeEventListener('pwa-need-refresh', handleNeedRefresh)
  }, [])

  if (!show) return null

  return (
    <div
      data-testid="pwa-update-banner"
      className="fixed bottom-0 left-0 right-0 z-[110] flex items-center justify-between gap-3 px-4 py-2.5 bg-surface border-t border-border"
    >
      <span className="text-sm text-text">新しいバージョンがあります</span>
      <button
        data-testid="pwa-update-button"
        onClick={() => updateSW()}
        className="px-4 py-1.5 text-sm font-bold bg-accent text-white rounded-lg shrink-0"
      >
        更新
      </button>
    </div>
  )
}
