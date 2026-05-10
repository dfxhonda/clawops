import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/ui/PageHeader'
import DateTime from '../../shared/ui/DateTime'
import { getPatrolMachines } from '../../services/patrol'
import { getTodayReadingsMap } from '../../services/patrolCore'
import { fetchStoreMachineDiffs } from '../../services/storeMachineSummary'
import MachineRow from '../../clawsupport/components/MachineRow'
import DiffChip from '../../clawsupport/components/DiffChip'
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
  const [storeInTotal, setStoreInTotal] = useState(null)
  const [storeOutTotal, setStoreOutTotal] = useState(null)
  const [dataLoading, setDataLoading] = useState(true)

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

      <div className="px-5 py-2 shrink-0 flex items-center gap-3">
        <span className="text-base text-muted">管理者編集モード</span>
        {(storeInTotal != null || storeOutTotal != null) && (
          <div data-testid="store-inline-total" className="flex gap-1">
            <DiffChip label="IN" value={storeInTotal} />
            <DiffChip label="OUT" value={storeOutTotal} />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
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
