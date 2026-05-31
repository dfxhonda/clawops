import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/ui/PageHeader'
import DateTime from '../../shared/ui/DateTime'
import { getPatrolMachines } from '../../services/patrol'
import { getTodayReadingsMap } from '../../services/patrolCore'
import { fetchStoreMachineDiffs } from '../../services/storeMachineSummary'
import MachineRow from '../../clawsupport/components/MachineRow'
import StoreTotalsHeader from '../../clawsupport/components/StoreTotalsHeader'
import { useAuth } from '../../hooks/useAuth'
import { isAdmin } from '../../services/permissions'

function UnauthorizedView() {
  const navigate = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => navigate('/clawsupport', { replace: true }), 1500)
    return () => clearTimeout(t)
  }, [navigate])
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div data-testid="unauthorized-toast" className="text-amber-400 text-base font-bold px-4 py-3 border border-amber-400/40 rounded-xl">
        権限なし
      </div>
    </div>
  )
}

export default function AdminMachineListPage() {
  const { storeCode } = useParams()
  const navigate = useNavigate()
  const { staffRole, loading } = useAuth()

  const [storeName, setStoreName] = useState(storeCode)
  const [machines, setMachines] = useState([])
  const [todayMap, setTodayMap] = useState({})
  const [diffMap, setDiffMap] = useState({})
  const [dataLoading, setDataLoading] = useState(true)

  const load = useCallback(async () => {
    const [{ data: store }, machineList] = await Promise.all([
      supabase.from('stores').select('store_name').eq('store_code', storeCode).single(),
      getPatrolMachines(storeCode),
    ])
    setStoreName(store?.store_name ?? storeCode)
    setMachines(machineList)

    const boothCodes = machineList.flatMap(m => m.booths.map(b => b.booth_code))
    const [map, { diffMap: diffs }] = await Promise.all([
      getTodayReadingsMap(boothCodes),
      fetchStoreMachineDiffs(machineList),
    ])
    setTodayMap(map)
    setDiffMap(diffs)
    setDataLoading(false)
  }, [storeCode])

  useEffect(() => {
    if (isAdmin(staffRole)) load()
  }, [load, staffRole])

  if (loading) return null
  if (!isAdmin(staffRole)) return <UnauthorizedView />

  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-base">
        読み込み中...
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="admin"
        title={storeName}
        variant="compact"
        rightSlot={<DateTime value={new Date()} format="date" />}
        onBack={() => navigate(`/admin/store-list`)}
      />

      {/* J-PATROL-IN-DAILY-fix-03 ad-hoc (ヒロ Discord IMG_4233):
          管理者編集モードでも巡回画面と同じ 4 列ヘッダ (前IN/今IN/前/日/今/日) で揃える。
          旧 IN/OUT DiffChip ('IN +3,085 OUT +196') は廃止。 */}
      <StoreTotalsHeader
        diffMap={diffMap}
        leftSlot={<span className="text-xs text-muted font-bold">管理者編集モード</span>}
      />
      {/* タップ済進捗をヘッダに統合できないので 1 行で残す (役立ち情報) */}
      {/* 不要なら削除可、ヒロ判断 */}
      {Object.keys(todayMap).length > 0 && (
        <div className="px-4 py-1 shrink-0">
          <span className="text-xs text-muted">入力済み {Object.keys(todayMap).length} / {machines.reduce((s, m) => s + m.booths.length, 0)} ブース</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2 space-y-2">
        {machines.length === 0 && (
          <p className="text-center text-muted text-base py-12">機械データがありません</p>
        )}
        {machines.map(machine => (
          <MachineRow
            key={machine.machine_code}
            machine={machine}
            todayMap={todayMap}
            diffMap={diffMap}
            onBoothClick={booth =>
              navigate(`/admin/booth-edit/${booth.booth_code}`, {
                state: { machine, booth, storeCode },
              })
            }
          />
        ))}
      </div>
    </div>
  )
}
