import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePatrolListScrollStore } from '../../stores/patrolListScrollStore'
import { PageHeader } from '../../shared/ui/PageHeader'
import DateTime from '../../shared/ui/DateTime'
import { getPatrolMachines } from '../../services/patrol'
import { getTodayReadingsMap } from '../../services/patrolCore'
import { fetchStoreMachineDiffs } from '../../services/storeMachineSummary'
import DiffChip from '../components/DiffChip'
import MachineRow from '../components/MachineRow'

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

  const [storeName, setStoreName] = useState(storeCode)
  const [machines, setMachines] = useState([])
  const [todayMap, setTodayMap] = useState({})
  const [diffMap, setDiffMap] = useState({})
  const [storeInTotal, setStoreInTotal] = useState(null)
  const [storeOutTotal, setStoreOutTotal] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [{ data: store }, machineList] = await Promise.all([
      supabase.from('stores').select('store_name').eq('store_code', storeCode).single(),
      getPatrolMachines(storeCode),
    ])
    setStoreName(store?.store_name ?? storeCode)
    setMachines(machineList)

    const boothCodes = machineList.flatMap(m => m.booths.map(b => b.booth_code))
    const [map, { diffMap: diffs, storeInTotal: inT, storeOutTotal: outT }] = await Promise.all([
      getTodayReadingsMap(boothCodes),
      fetchStoreMachineDiffs(machineList),
    ])
    setTodayMap(map)
    setDiffMap(diffs)
    setStoreInTotal(inT)
    setStoreOutTotal(outT)
    setLoading(false)
  }, [storeCode])

  useEffect(() => { load() }, [load])

  // 全ブースのフラット順 (保存して次ブース算出用)
  const boothList = useMemo(
    () => machines.flatMap(m => (m.booths ?? []).map(b => ({ booth: b, machine: m }))),
    [machines],
  )

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

      <div
        data-testid="store-inline-total"
        className="shrink-0 px-4 py-2 flex gap-2 items-center border-b border-border"
      >
        <DiffChip label="IN" value={storeInTotal} />
        <DiffChip label="OUT" value={storeOutTotal} />
      </div>

      {totalCnt > 0 && (
        <div className="px-5 py-2 shrink-0">
          <span
            className={`text-base px-3 py-1 rounded-full border ${
              doneCnt >= totalCnt
                ? 'text-emerald-400 border-emerald-400/40'
                : doneCnt > 0
                ? 'text-amber-400 border-amber-400/40'
                : 'text-muted border-border'
            }`}
          >
            {doneCnt}/{totalCnt} ブース完了
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
        {machines.length === 0 && (
          <p className="text-center text-muted text-base py-12">機械データがありません</p>
        )}
        {/* J-CHANGER-01: 両替機 (machine_models.type_id='changer') を店舗ハブ最上位に固定表示。
            ブース層スキップ、タップで /clawsupport/changer/:machineCode へ直行。 */}
        {machines
          .filter(m => m.machine_models?.[0]?.type_id === 'changer')
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
                <p className="text-xs text-muted mt-0.5">{machine.machine_models?.[0]?.model_name ?? machine.machine_code}</p>
              </div>
              <span className="text-amber-400 text-lg shrink-0" aria-hidden>›</span>
            </button>
          ))}
        {machines
          .filter(m => m.machine_models?.[0]?.type_id !== 'changer')
          .map(machine => (
            <MachineRow
              key={machine.machine_code}
              machine={machine}
              todayMap={todayMap}
              diffMap={diffMap}
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
