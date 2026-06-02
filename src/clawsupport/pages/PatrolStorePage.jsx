import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePatrolListScrollStore } from '../../stores/patrolListScrollStore'
import { PageHeader } from '../../shared/ui/PageHeader'
import DateTime from '../../shared/ui/DateTime'
import { getPatrolMachines } from '../../services/patrol'
import { getTodayReadingsMap } from '../../services/patrolCore'
import { fetchStoreMachineDiffs } from '../../services/storeMachineSummary'
import MachineRow from '../components/MachineRow'
import StoreTotalsHeader from '../components/StoreTotalsHeader'
import { computeMachineRankMap } from '../components/storeTotalsRanking'
import { getStoreCache, setStoreCache } from '../state/patrolStoreCache'

export default function PatrolStorePage() {
  const { storeCode } = useParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isBeta = pathname.startsWith('/clawsupport/beta/')

  // 巡回ブースリストの展開状態 + 復帰時スクロール先 (保存ボタン「リストに戻る」用)
  const expandedByStore = usePatrolListScrollStore(s => s.expandedByStore)
  const focusBoothByStore = usePatrolListScrollStore(s => s.focusBoothByStore)
  const toggleExpanded = usePatrolListScrollStore(s => s.toggleExpanded)
  const ensureExpanded = usePatrolListScrollStore(s => s.ensureExpanded)
  const clearFocusBooth = usePatrolListScrollStore(s => s.clearFocusBooth)
  const expandedSet = expandedByStore[storeCode] ?? []

  // SPEC-PATROL-SAVE-LATENCY-FIX-01: PatrolBoothInputPage から戻った時、
  // module-level cache (patrolStoreCache) からハイドレートして 4 RT 再 fetch を回避。
  // 保存成功時は cache.patchBoothSummary で対象 booth だけ差し替え済みのため、
  // この再マウントは即座に最新表示できる。初回マウントだけ cache miss → load() フル fetch。
  const cached = getStoreCache(storeCode)
  const [storeName, setStoreName] = useState(cached?.storeName ?? storeCode)
  const [machines, setMachines] = useState(cached?.machines ?? [])
  const [todayMap, setTodayMap] = useState(cached?.todayMap ?? {})
  const [diffMap, setDiffMap] = useState(cached?.diffMap ?? {})
  const [loading, setLoading] = useState(!cached)
  const [viewMode, setViewMode] = useState('IN')

  const load = useCallback(async () => {
    const [{ data: store }, machineList] = await Promise.all([
      supabase.from('stores').select('store_name').eq('store_code', storeCode).single(),
      getPatrolMachines(storeCode),
    ])
    const resolvedName = store?.store_name ?? storeCode
    setStoreName(resolvedName)
    setMachines(machineList)

    const boothCodes = machineList.flatMap(m => m.booths.map(b => b.booth_code))
    const [map, { diffMap: diffs }] = await Promise.all([
      getTodayReadingsMap(boothCodes),
      fetchStoreMachineDiffs(machineList),
    ])
    setTodayMap(map)
    setDiffMap(diffs)
    setLoading(false)
    // SPEC-FIX-01: 取得結果を module-level cache に保存、次回 mount で即ハイドレート。
    setStoreCache(storeCode, { storeName: resolvedName, machines: machineList, todayMap: map, diffMap: diffs })
  }, [storeCode])

  useEffect(() => {
    // 初回マウントで cache hit なら fetch をスキップ (PatrolBoothInputPage からの戻り)。
    // cache miss なら load() 実行 (Launcher / store list からの初回到達)。
    if (!cached) load()
    // storeCode 変更時は cached も切り替わるので再評価される。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeCode])

  // 全ブースのフラット順 (保存して次ブース算出用)
  const boothList = useMemo(
    () => machines.flatMap(m => (m.booths ?? []).map(b => ({ booth: b, machine: m }))),
    [machines],
  )

  // J-PATROL-IN-DAILY-fix-05: 機械単位ベスト3/ワースト3 ランクマップ
  // SPEC-PATROL-VIEW-MODE-SWITCH-01: viewMode に応じて対象列が切り替わる
  const rankMap = useMemo(() => computeMachineRankMap(machines, diffMap, viewMode), [machines, diffMap, viewMode])

  // 「保存してリストに戻る」復帰時: 次ブースの machine を展開し、その位置へスクロール
  useEffect(() => {
    if (loading) return
    const fb = focusBoothByStore[storeCode]
    if (!fb) return
    const m = machines.find(mm => (mm.booths ?? []).some(b => b.booth_code === fb))
    if (m && (m.booths?.length ?? 0) > 1) ensureExpanded(storeCode, m.machine_code)
    const t = setTimeout(() => {
      const el =
        document.querySelector(`[data-testid="booth-row-${fb}"]`) ||
        (m ? document.querySelector(`[data-testid="machine-row-${m.machine_code}"]`) : null)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      clearFocusBooth(storeCode)
    }, 120)
    return () => clearTimeout(t)
  }, [loading, machines, focusBoothByStore, storeCode]) // eslint-disable-line react-hooks/exhaustive-deps

  const doneCnt = Object.keys(todayMap).length
  const totalCnt = machines.reduce((s, m) => s + m.booths.length, 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-base">
        読み込み中...
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="clawsupport"
        title={storeName}
        variant="compact"
        rightSlot={<DateTime value={new Date()} format="date" />}
        onBack={() => navigate('/clawsupport')}
      />

      <StoreTotalsHeader
        diffMap={diffMap}
        mode={viewMode}
        onModeChange={setViewMode}
        leftSlot={
          totalCnt > 0 && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${
                doneCnt >= totalCnt
                  ? 'text-emerald-400 border-emerald-400/40'
                  : doneCnt > 0
                  ? 'text-amber-400 border-amber-400/40'
                  : 'text-muted border-border'
              }`}
            >
              {doneCnt}/{totalCnt} ブース完了
            </span>
          )
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2 space-y-2">
        {machines.length === 0 && (
          <p className="text-center text-muted text-base py-12">機械データがありません</p>
        )}
        {/* J-CHANGER-01: 両替機 (machine_models.type_id='changer') を店舗ハブ最上位に固定表示。
            ブース層スキップ、タップで /clawsupport/changer/:machineCode へ直行。 */}
        {machines
          .filter(m => ((Array.isArray(m.machine_models) ? m.machine_models[0]?.type_id : m.machine_models?.type_id) === 'changer'))
          .map(machine => (
            <button
              key={machine.machine_code}
              type="button"
              data-testid={`changer-tile-${machine.machine_code}`}
              onClick={() => navigate(`/clawsupport/changer/${machine.machine_code}`, { state: { storeName, storeCode } })}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-900/20 border-2 border-amber-600/60 hover:border-amber-500 text-left active:scale-[0.98] transition-transform"
            >
              <span className="text-2xl shrink-0">🪙</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-text">{machine.machine_name}</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-300">両替機</span>
                </div>
                <p className="text-xs text-muted mt-0.5">{(Array.isArray(machine.machine_models) ? machine.machine_models[0]?.model_name : machine.machine_models?.model_name) ?? machine.machine_code}</p>
              </div>
              <span className="text-amber-400 text-lg shrink-0" aria-hidden>›</span>
            </button>
          ))}
        {machines
          .filter(m => ((Array.isArray(m.machine_models) ? m.machine_models[0]?.type_id : m.machine_models?.type_id) !== 'changer'))
          .map(machine => (
            <MachineRow
              key={machine.machine_code}
              machine={machine}
              todayMap={todayMap}
              diffMap={diffMap}
              rankMap={rankMap}
              mode={viewMode}
              expanded={expandedSet.includes(machine.machine_code)}
              onToggleExpand={() => toggleExpanded(storeCode, machine.machine_code)}
              onBoothClick={booth =>
                navigate(`/clawsupport/${isBeta ? 'beta/' : ''}booth/${booth.booth_code}`, {
                  state: {
                    machine, booth, storeCode,
                    boothList,
                    boothIndex: boothList.findIndex(x => x.booth.booth_code === booth.booth_code),
                  },
                })
              }
            />
          ))}
      </div>
    </div>
  )
}
