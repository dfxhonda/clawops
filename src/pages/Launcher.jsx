import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getModuleTilesForRole,
} from '../shared/auth/roles'
import { MODULE_COLORS } from '../shared/ui/moduleColors'
import { useRole } from '../shared/auth/useRole'
import { useAuth } from '../hooks/useAuth'
import { logout } from '../lib/auth/session'
import DateTime from '../shared/ui/DateTime'
import { supabase } from '../lib/supabase'
import { getCache, clearCache } from '../lib/prefetchCache'

// 未対応TODOインラインリスト用: booth_code 末尾 (例: MNK01-M02-B04 → B04) を取り出し
function boothLabel(boothNumber, boothCode) {
  if (boothNumber != null) return `B${String(boothNumber).padStart(2, '0')}`
  const m = typeof boothCode === 'string' ? boothCode.match(/-(B\d+)$/i) : null
  return m ? m[1] : boothCode
}

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)        return 'たった今'
  if (diff < 3600)      return `${Math.floor(diff / 60)}分前`
  if (diff < 86400)     return `${Math.floor(diff / 3600)}時間前`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}日前`
  return new Date(iso).toLocaleDateString('ja-JP')
}

export default function Launcher() {
  const navigate = useNavigate()
  const { role, staffName, loading } = useRole()
  const { staffId } = useAuth()

  async function handleLogout() {
    await logout()
    sessionStorage.removeItem('clawops_staff')
    window.location.replace('/login')
  }

  const now = new Date()
  const [alerts, setAlerts]         = useState([])
  const [storeMap, setStoreMap]     = useState({})
  const [machineMap, setMachineMap] = useState({})
  const [boothMap, setBoothMap]     = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const [resolvingId, setResolvingId] = useState(null)

  async function handleResolveAlert(alertId) {
    if (resolvingId) return
    setResolvingId(alertId)
    try {
      const { error } = await supabase.from('booth_alerts').update({
        resolved:    true,
        resolved_at: new Date().toISOString(),
        resolved_by: staffId ?? null,
      }).eq('alert_id', alertId)
      if (error) throw error
      setAlerts(prev => prev.filter(a => a.alert_id !== alertId))
      setExpandedId(null)
    } catch (e) {
      console.error('[ERR-LAUNCHER-ALERT-RESOLVE]', e)
    } finally {
      setResolvingId(null)
    }
  }

  useEffect(() => {
    if (!loading && !role) {
      navigate('/login', { replace: true })
    }
  }, [loading, role, navigate])

  // 気づきリストをハブに直表示するため、件数だけでなく上位レコード+ラベルマップを取る
  // SPEC-LOGIN-PREFETCH-ON-STAFF-SELECT-01: staff tap 時に prefetch 済みならキャッシュヒット → 即表示。
  useEffect(() => {
    if (!role) return

    const cached = getCache(staffId)
    if (cached?.ready) {
      const sm = {}; cached.stores.forEach(s => { sm[s.store_code] = s.store_name })
      const mm = {}; cached.machines.forEach(x => { mm[x.machine_code] = x.machine_name || x.machine_code })
      const bm = {}; cached.booths.forEach(x => { bm[x.booth_code] = x.booth_number })
      setStoreMap(sm)
      setMachineMap(mm)
      setBoothMap(bm)
      setAlerts(cached.booth_alerts)
      clearCache()
      return
    }

    supabase
      .from('booth_alerts')
      .select('*, alert_types(label, icon_emoji, color_hex)')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setAlerts(data) })
    supabase.from('stores').select('store_code,store_name').then(({ data }) => {
      if (!data) return
      const m = {}; data.forEach(s => { m[s.store_code] = s.store_name })
      setStoreMap(m)
    })
    supabase.from('machines').select('machine_code,machine_name').then(({ data }) => {
      if (!data) return
      const m = {}; data.forEach(x => { m[x.machine_code] = x.machine_name || x.machine_code })
      setMachineMap(m)
    })
    supabase.from('booths').select('booth_code,booth_number').then(({ data }) => {
      if (!data) return
      const m = {}; data.forEach(x => { m[x.booth_code] = x.booth_number })
      setBoothMap(m)
    })
  }, [role, staffId])

  const unresolvedCount = alerts.length

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
        <p className="text-slate-400 text-base">
          <DateTime value={now} format="date" />　<DateTime value={now} format="time" />
        </p>
        <h1 className="text-2xl font-bold mt-1">こんにちは、{staffName || 'ゲスト'}さん</h1>
      </div>

      <div className="px-4 pb-10 space-y-3">
        {moduleTiles.map(tile => (
          <button
            key={tile.key}
            type="button"
            data-testid={`launcher-tile-${tile.key}`}
            onClick={() => navigate(tile.path)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-left active:scale-[0.98] transition-transform min-h-[88px]"
            style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: MODULE_COLORS[tile.key] ?? '#888899' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold leading-tight text-white">{tile.label}</p>
              <p className="text-base text-slate-400 mt-1 leading-snug">{tile.desc}</p>
            </div>
            <span className="text-slate-500 text-xl shrink-0" aria-hidden>›</span>
          </button>
        ))}

        {/* 集金は J-NAV-ORPHANS-fix-02 でマネサポ「集金」タブ (Hub) に正式移設、Launcher からは再度削除済。
            動線: マネサポ → 集金タブ → 集金帳票 / 集金フラグ編集 / 集金履歴 */}

        {/* 未対応TODO インライン accordion (ad-hoc 2026-05-30 ヒロ Discord 依頼):
            collapsed = 分類 + 店舗名 + 経過時間
            expanded  = 機械名/B番号 + note + ✓対応完了ボタン (即解決、ローカルから除去)
            多ければリスト内スクロール。 */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center gap-2">
            <span className="text-2xl" aria-hidden>📋</span>
            <p className="text-xl font-bold text-white">未対応TODO</p>
            {unresolvedCount > 0 && (
              <span className="shrink-0 min-w-[24px] h-[24px] px-1.5 bg-red-500 text-white text-sm font-bold rounded-full flex items-center justify-center">
                {unresolvedCount}
              </span>
            )}
            <button
              type="button"
              onClick={() => navigate('/clawsupport/alerts')}
              data-testid="launcher-alerts-more"
              className="ml-auto text-base text-blue-400 active:text-blue-300"
            >
              一覧 ›
            </button>
          </div>
          {alerts.length === 0 ? (
            <p className="text-center text-slate-400 text-lg py-5">未対応のアラートはありません 🎉</p>
          ) : (
            <div
              data-testid="launcher-alerts-scroll"
              className="max-h-[52vh] overflow-y-auto divide-y divide-slate-700/70"
            >
              {alerts.map(a => {
                const isOpen = expandedId === a.alert_id
                const isResolving = resolvingId === a.alert_id
                return (
                  <div key={a.alert_id}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(prev => prev === a.alert_id ? null : a.alert_id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left active:bg-slate-700/40"
                      aria-expanded={isOpen}
                    >
                      <span className="text-2xl shrink-0" aria-hidden>{a.alert_types?.icon_emoji ?? '📌'}</span>
                      <span className="text-lg font-bold shrink-0" style={{ color: a.alert_types?.color_hex ?? '#cbd5e1' }}>
                        {a.alert_types?.label ?? a.type_code}
                      </span>
                      <span className="text-lg text-slate-200 truncate flex-1 leading-tight">
                        {storeMap[a.store_code] ?? a.store_code}
                      </span>
                      <span className="text-base text-slate-400 shrink-0">{timeAgo(a.created_at)}</span>
                      <span className="text-slate-500 text-lg shrink-0" aria-hidden>{isOpen ? '▲' : '▼'}</span>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 bg-slate-900/40 text-slate-200">
                        <p className="text-lg leading-snug">
                          {machineMap[a.machine_code] ?? a.machine_code} / {boothLabel(boothMap[a.booth_code], a.booth_code)}
                        </p>
                        {a.note && (
                          <p className="text-lg text-slate-300/90 mt-1 leading-snug whitespace-pre-wrap">
                            {a.note}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => handleResolveAlert(a.alert_id)}
                          disabled={isResolving}
                          data-testid={`launcher-alert-resolve-${a.alert_id}`}
                          className="mt-2 w-full py-3 rounded-xl bg-emerald-600 text-white text-lg font-bold active:bg-emerald-700 disabled:opacity-50"
                        >
                          {isResolving ? '更新中…' : '✓ 対応完了にする'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* OCRテスト ボタンは 2026-05-30 ヒロ ad-hoc 依頼で削除 (/ocr-test ルート自体は残置) */}

      <div className="px-4 pt-2 pb-8 flex justify-center">
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-slate-600 hover:text-slate-400 transition-colors px-4 py-2"
        >
          ログアウト
        </button>
      </div>
    </div>
  )
}
