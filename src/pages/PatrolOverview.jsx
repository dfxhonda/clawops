import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllStores } from '../services/masters'
import { getPatrolMachines, getTodayReadings, getTodayLockerLogs } from '../services/patrol'
import { logout } from '../lib/auth/session'

function isGacha(machine) {
  return (
    machine.machine_name?.includes('ガチャ') ||
    machine.machine_name?.toLowerCase().includes('gacha') ||
    machine.machine_types?.category === 'gacha'
  )
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

export default function PatrolOverview() {
  const navigate = useNavigate()
  const [stores, setStores] = useState([])
  const [selStore, setSelStore] = useState(() => sessionStorage.getItem('patrol_overview_store') || '')
  const [machines, setMachines] = useState([])
  const [todayMap, setTodayMap] = useState({})
  const [lockerLogsMap, setLockerLogsMap] = useState({})
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef(null)

  // 店舗一覧取得
  useEffect(() => {
    getAllStores().then(setStores)
  }, [])

  // 店舗選択 → sessionStorage 保存
  function handleStoreChange(code) {
    setSelStore(code)
    sessionStorage.setItem('patrol_overview_store', code)
  }

  // データ読み込み
  async function load() {
    if (!selStore) return
    setLoading(true)
    try {
      const machineList = await getPatrolMachines(selStore)
      const allBoothCodes = machineList.flatMap(m => m.booths.map(b => b.booth_code))
      const [todayReadings, lockerMaps] = await Promise.all([
        getTodayReadings(allBoothCodes),
        Promise.all(
          machineList.map(m =>
            isGacha(m) && m.machine_lockers.length > 0
              ? getTodayLockerLogs(m.machine_code).then(r => [m.machine_code, r])
              : Promise.resolve([m.machine_code, {}])
          )
        ),
      ])
      setMachines(machineList)
      setTodayMap(todayReadings)
      setLockerLogsMap(Object.fromEntries(lockerMaps))
    } finally {
      setLoading(false)
    }
  }

  // 店舗変更 or マウント時にロード + 30秒自動更新
  useEffect(() => {
    if (!selStore) {
      setMachines([])
      setTodayMap({})
      setLockerLogsMap({})
      return
    }
    load()
    intervalRef.current = setInterval(load, 30000)
    return () => {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [selStore]) // eslint-disable-line react-hooks/exhaustive-deps

  function navigateToBooth(machine, booth) {
    const gacha = isGacha(machine)
    navigate('/patrol/input', {
      state: {
        booth,
        machine,
        storeCode: selStore,
        storeName: stores.find(s => s.store_code === selStore)?.store_name || '',
        lockers: gacha ? machine.machine_lockers : [],
        isGacha: gacha,
      },
    })
  }

  // 進捗計算
  const totalBoothCount = machines.reduce((n, m) => n + m.booths.length, 0)
  const completedCount = machines.reduce(
    (n, m) => n + m.booths.filter(b => !!todayMap[b.booth_code]).length,
    0
  )
  const allDone = totalBoothCount > 0 && completedCount >= totalBoothCount

  const todayLabel = new Date().toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  return (
    <div className="h-dvh flex flex-col bg-bg text-text">

      {/* ━━━ ヘッダー ━━━ */}
      <div className="shrink-0 flex items-center gap-2 px-3 pt-3 pb-2">
        <button onClick={() => navigate(-1)} className="text-2xl text-muted leading-none px-1">←</button>
        <h1 className="flex-1 font-bold text-base">巡回状況</h1>
        <button
          onClick={() => navigate('/admin')}
          className="h-9 px-3 flex items-center gap-1 rounded-xl bg-surface border border-border text-[11px] font-bold text-muted active:bg-surface2 transition-colors"
        >
          ⚙️ 管理
        </button>
        <button
          onClick={load}
          disabled={!selStore || loading}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-muted active:bg-surface2 transition-colors text-base disabled:opacity-40"
          title="更新"
        >
          🔄
        </button>
        <button
          onClick={async () => {
            if (!window.confirm('ログアウトしますか？')) return
            await logout()
            navigate('/login', { replace: true })
          }}
          className="text-[10px] text-muted hover:text-accent2"
        >
          ログアウト
        </button>
      </div>

      {/* ━━━ 店舗セレクター + 日付 ━━━ */}
      <div className="shrink-0 px-4 py-2 flex items-center gap-3">
        <select
          value={selStore}
          onChange={e => handleStoreChange(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm outline-none focus:border-accent [color-scheme:dark]"
        >
          <option value="">店舗を選択…</option>
          {stores.map(s => (
            <option key={s.store_code} value={s.store_code}>
              {s.store_name}
            </option>
          ))}
        </select>
        <span className="shrink-0 text-xs text-muted">{todayLabel}</span>
      </div>

      {/* ━━━ 進捗バー ━━━ */}
      {selStore && (
        <div className="shrink-0 px-4 pb-2">
          {allDone ? (
            <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent3/20 border border-accent3/40 text-accent3 font-bold text-sm">
              ✅ 本日の巡回完了！
            </div>
          ) : (
            <div>
              <div className="flex justify-between text-xs text-muted mb-1.5">
                <span>{completedCount} / {totalBoothCount} ブース完了</span>
                {totalBoothCount > 0 && (
                  <span>{Math.round((completedCount / totalBoothCount) * 100)}%</span>
                )}
              </div>
              <div className="h-2 rounded-full bg-surface2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent3 transition-all duration-500"
                  style={{ width: totalBoothCount > 0 ? `${(completedCount / totalBoothCount) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ━━━ メインスクロール ━━━ */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">

        {/* ローディング */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-muted text-sm">読み込み中...</p>
            </div>
          </div>
        )}

        {/* 店舗未選択 */}
        {!selStore && !loading && (
          <div className="flex items-center justify-center py-20 text-muted text-sm">
            店舗を選択してください
          </div>
        )}

        {/* 機械一覧 */}
        {!loading && selStore && machines.length === 0 && (
          <div className="flex items-center justify-center py-20 text-muted text-sm">
            登録された機械がありません
          </div>
        )}

        {!loading && machines.map(machine => {
          const gacha = isGacha(machine)
          const lockerLogs = lockerLogsMap[machine.machine_code] || {}

          return (
            <div
              key={machine.machine_code}
              className="bg-surface border border-border rounded-xl overflow-hidden mb-4"
            >
              {/* 機械ヘッダー */}
              <div className="bg-surface2 px-4 py-2.5 flex items-center gap-2">
                <span className="font-bold text-sm flex-1 min-w-0 truncate">
                  {machine.machine_name}
                </span>
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  gacha
                    ? 'bg-accent4/20 text-accent4'
                    : 'bg-accent/20 text-accent'
                }`}>
                  {gacha ? 'ガチャ' : 'クレーン'}
                </span>
                <span className="shrink-0 text-[10px] text-muted font-mono">
                  {machine.machine_code}
                </span>
              </div>

              {/* ブース行 */}
              {machine.booths.map(booth => {
                const reading = todayMap[booth.booth_code]
                const isDone = !!reading
                return (
                  <button
                    key={booth.booth_code}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-t border-border text-left transition-colors
                      ${isDone ? 'bg-accent3/10' : 'hover:bg-surface2'}`}
                    onClick={() => navigateToBooth(machine, booth)}
                  >
                    <span className="text-base w-5">{isDone ? '✅' : '⬜'}</span>
                    <span className="flex-1 text-sm font-medium">
                      B{String(booth.booth_number).padStart(2, '0')}
                    </span>
                    {isDone ? (
                      <span className="text-xs text-accent3">
                        {formatTime(reading.read_time)} 入力済み
                      </span>
                    ) : (
                      <span className="text-xs text-muted">未入力</span>
                    )}
                  </button>
                )
              })}

              {/* ロッカー行（ガチャのみ） */}
              {gacha && machine.machine_lockers.map(locker => {
                const lockerDone = !!lockerLogs[locker.locker_id]
                return (
                  <div
                    key={locker.locker_id}
                    className={`flex items-center gap-3 px-4 py-3 border-t border-border
                      ${lockerDone ? 'bg-accent3/5' : ''}`}
                  >
                    <span className="text-base w-5">{lockerDone ? '✅' : '🔐'}</span>
                    <span className="flex-1 text-sm text-muted">
                      ロッカー{locker.locker_number}
                      （{locker.slot_count}スロット・{locker.lock_type === 'key' ? '鍵式' : '暗証番号'}）
                    </span>
                    {lockerDone
                      ? <span className="text-xs text-accent3">補充済み</span>
                      : <span className="text-xs text-muted">未補充</span>
                    }
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
