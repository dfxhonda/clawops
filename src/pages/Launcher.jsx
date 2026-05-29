import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getModuleTilesForRole,
} from '../shared/auth/roles'
import { useRole } from '../shared/auth/useRole'
import { logout } from '../lib/auth/session'
import DateTime from '../shared/ui/DateTime'
import { supabase } from '../lib/supabase'

export default function Launcher() {
  const navigate = useNavigate()
  const { role, staffName, loading } = useRole()

  async function handleLogout() {
    await logout()
    sessionStorage.removeItem('clawops_staff')
    window.location.replace('/login')
  }

  const now = new Date()
  const [unresolvedCount, setUnresolvedCount] = useState(0)

  useEffect(() => {
    if (!loading && !role) {
      navigate('/login', { replace: true })
    }
  }, [loading, role, navigate])

  useEffect(() => {
    if (!role) return
    supabase
      .from('booth_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false)
      .then(({ count }) => { if (count != null) setUnresolvedCount(count) })
  }, [role])

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

        {/* J-COLLECTION-01: 集金タイル / J-COLLECTION-12 R1: admin/manager のみ表示。staff/patrol は非レンダリング。
            ロールソースは useRole() の role (= useAuth().staffRole) で route guard と同一。 */}
        {(role === 'admin' || role === 'manager') && (
          <button
            type="button"
            data-testid="launcher-tile-collection"
            onClick={() => navigate('/collection/input')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-left active:scale-[0.98] transition-transform min-h-[88px]"
          >
            <span
              className="shrink-0 flex items-center justify-center text-[44px] leading-none"
              style={{ width: 44, height: 44 }}
              aria-hidden
            >
              💴
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold leading-tight text-white">集金</p>
              <p className="text-[13px] text-slate-400 mt-1 leading-snug">金種カウント・売上伝票PDF</p>
            </div>
            <span className="text-slate-500 text-lg shrink-0" aria-hidden>›</span>
          </button>
        )}

        {/* 未対応TODOタイル */}
        <button
          type="button"
          data-testid="launcher-tile-alerts"
          onClick={() => navigate('/clawsupport/alerts')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-left active:scale-[0.98] transition-transform min-h-[88px]"
        >
          <span
            className="shrink-0 flex items-center justify-center text-[44px] leading-none"
            style={{ width: 44, height: 44 }}
            aria-hidden
          >
            📋
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold leading-tight text-white">未対応TODO</p>
              {unresolvedCount > 0 && (
                <span className="shrink-0 min-w-[22px] h-[22px] px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unresolvedCount}
                </span>
              )}
            </div>
            <p className="text-[13px] text-slate-400 mt-1 leading-snug">気づき・アラート一覧</p>
          </div>
          <span className="text-slate-500 text-lg shrink-0" aria-hidden>›</span>
        </button>
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
