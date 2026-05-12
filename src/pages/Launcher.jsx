import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getModuleTilesForRole,
  LAUNCHER_COMING_SOON_TILES,
} from '../shared/auth/roles'
import { useRole } from '../shared/auth/useRole'
import { logout } from '../lib/auth/session'
import DateTime from '../shared/ui/DateTime'

export default function Launcher() {
  const navigate = useNavigate()
  const { role, staffName, loading } = useRole()

  async function handleLogout() {
    await logout()
    sessionStorage.removeItem('clawops_staff')
    window.location.replace('/login')
  }

  const now = new Date()

  useEffect(() => {
    if (!loading && !role) {
      navigate('/login', { replace: true })
    }
  }, [loading, role, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400">読み込み中...</div>
    )
  }
  if (!role) return null

  const moduleTiles = getModuleTilesForRole(role)

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="px-4 pt-10 pb-6">
        <p className="text-slate-400 text-sm">
          <DateTime value={now} format="date" />　<DateTime value={now} format="time" />
        </p>
        <h1 className="text-xl font-bold mt-1">こんにちは、{staffName || 'ゲスト'}さん</h1>
      </div>

      <div className="px-4 pb-10 space-y-3">
        {moduleTiles.map(tile => (
          <button
            key={tile.key}
            type="button"
            data-testid={`launcher-tile-${tile.key}`}
            onClick={() => navigate(tile.path)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-left active:scale-[0.98] transition-transform min-h-[88px]"
          >
            <span
              className="shrink-0 flex items-center justify-center text-[44px] leading-none"
              style={{ width: 44, height: 44 }}
              aria-hidden
            >
              {tile.emoji}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold leading-tight text-white">{tile.label}</p>
              <p className="text-[13px] text-slate-400 mt-1 leading-snug">{tile.desc}</p>
            </div>
            <span className="text-slate-500 text-lg shrink-0" aria-hidden>›</span>
          </button>
        ))}

        {LAUNCHER_COMING_SOON_TILES.map(tile => (
          <div
            key={tile.key}
            data-testid={`launcher-tile-${tile.key}`}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 text-left min-h-[88px] opacity-70"
            aria-disabled="true"
          >
            <span
              className="shrink-0 flex items-center justify-center text-[44px] leading-none grayscale"
              style={{ width: 44, height: 44 }}
              aria-hidden
            >
              {tile.emoji}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold leading-tight text-slate-300">{tile.label}</p>
              <p className="text-[13px] text-slate-500 mt-1 leading-snug">{tile.desc}</p>
              <p className="text-xs text-amber-400/90 font-semibold mt-1.5">Coming Soon</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4">
        <button
          type="button"
          data-testid="launcher-tile-ocr-test"
          onClick={() => navigate('/ocr-test')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-800/40 border border-dashed border-slate-600 text-left active:scale-[0.98] transition-transform min-h-[88px] opacity-70"
        >
          <span
            className="shrink-0 flex items-center justify-center text-[44px] leading-none"
            style={{ width: 44, height: 44 }}
            aria-hidden
          >
            📷
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold leading-tight text-white">OCRテスト</p>
            <p className="text-[13px] text-slate-400 mt-1 leading-snug">開発用 精度テストページ</p>
          </div>
          <span className="text-slate-500 text-lg shrink-0" aria-hidden>›</span>
        </button>
      </div>

      <div className="px-4 pb-8 flex justify-center">
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors px-4 py-2"
        >
          ログアウト
        </button>
      </div>
    </div>
  )
}
