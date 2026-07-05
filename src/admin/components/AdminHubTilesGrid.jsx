// J-ADMIN-NAV-BADGE-01 2026-05-30 司令塔Opus spec
// マネサポ Hub タイルグリッド共通化、impl=false タイルは「準備中」灰バッジ + opacity-50 +
// タップで「現在開発中です」トースト (2秒自動消去、画面遷移なし)。
// 既存 4 ハブ (Masters / Audit / Reports / Settings) で共通使用、コード重複を排除。

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AdminHubTilesGrid({ tiles, testid, tileTestidPrefix = 'hub-tile-' }) {
  const navigate = useNavigate()
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div data-testid={testid} className="p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {tiles.map(t => {
          const isComingSoon = !t.impl
          return (
            <button
              key={t.path}
              data-testid={`${tileTestidPrefix}${t.label}`}
              onClick={() => isComingSoon ? setToast('現在開発中です') : navigate(t.path)}
              aria-disabled={isComingSoon || undefined}
              className={`relative rounded-xl p-4 min-h-[100px] w-full text-center border transition-colors cursor-pointer ${
                isComingSoon
                  ? 'bg-surface border-border opacity-50'
                  : 'bg-surface hover:bg-surface/80 active:ring-2 active:ring-blue-500 border-border'
              }`}
            >
              {/* SPEC-ADMIN-REPORTS-BADGE-CLEANUP-01: 実装済 = 通常状態なのでバッジなし。
                  例外の準備中 (impl:false) のみ灰バッジで明示。 */}
              {isComingSoon && (
                <span className="absolute top-2 right-2 rounded-full text-xs font-bold px-2 py-0.5 bg-gray-600 text-gray-200">
                  準備中
                </span>
              )}
              <p className="text-base font-bold text-text whitespace-nowrap mt-3">{t.label}</p>
              <p className="text-sm text-muted mt-1 line-clamp-2">{t.desc}</p>
            </button>
          )
        })}
      </div>

      {toast && (
        <div
          data-testid="hub-coming-soon-toast"
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-8 z-50 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg pointer-events-none"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
