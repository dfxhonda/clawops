// SPEC-PWA-SW-UPDATE-FIX-A-01 (D-109): 控えめトースト常駐バナー (甲)。
// 新SW waiting検知時に画面下部に細い帯「更新があります・タップで適用」を常駐表示。
// 巡回メーター入力/棚卸/集金署名などの最中でも自動適用は一切しない (安全tier)。無視可能。
// タップした時だけ applyUpdate() = updateSW(true) を1回呼び、controllerchange待ち→reload で新bundle適用。
import { useEffect, useState } from 'react'
import { subscribeNeedRefresh, applyUpdate } from '../../lib/swRegistration'

export default function SwUpdateBanner() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => subscribeNeedRefresh(setNeedRefresh), [])

  if (!needRefresh) return null

  function handleApply() {
    if (applying) return
    setApplying(true)
    // 明示タップのみ。自動 reload はしない。updateSW(true) 内蔵の controllerchange 待ち→reload に委ねる。
    Promise.resolve(applyUpdate()).catch(() => setApplying(false))
  }

  return (
    <button
      type="button"
      data-testid="sw-update-banner"
      onClick={handleApply}
      disabled={applying}
      className="fixed inset-x-0 bottom-0 z-[100] flex items-center justify-center gap-2 py-1.5 px-4
        bg-blue-600/95 text-white text-xs font-bold shadow-lg backdrop-blur-sm
        active:bg-blue-700 disabled:opacity-70"
      style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
    >
      <span aria-hidden>🔄</span>
      <span>{applying ? '更新を適用中…' : '新しいバージョンがあります・タップで更新'}</span>
    </button>
  )
}
