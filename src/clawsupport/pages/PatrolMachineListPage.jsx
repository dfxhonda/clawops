import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/ui/PageHeader'
import DateTime from '../../shared/ui/DateTime'
import { getPatrolMachines } from '../../services/patrol'
import { getTodayReadingsMap } from '../../services/patrolCore'
import { fetchBoothDiffMap } from '../../services/boothHistory'
import MachineListRow from '../components/MachineListRow'

export default function PatrolMachineListPage() {
  const { storeCode } = useParams()
  const navigate = useNavigate()

  const [storeName, setStoreName] = useState(storeCode)
  const [machines, setMachines] = useState([])
  const [todayMap, setTodayMap] = useState({})
  const [diffMap, setDiffMap] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [{ data: store }, machineList] = await Promise.all([
      supabase.from('stores').select('store_name').eq('store_code', storeCode).single(),
      getPatrolMachines(storeCode),
    ])
    setStoreName(store?.store_name ?? storeCode)
    setMachines(machineList)

    const boothCodes = machineList.flatMap(m => m.booths.map(b => b.booth_code))
    const meterUnitPriceMap = {}
    for (const m of machineList) {
      const mup = m.machine_models?.meter_unit_price ?? 100
      for (const b of m.booths) meterUnitPriceMap[b.booth_code] = mup
    }

    const [map, diffs] = await Promise.all([
      getTodayReadingsMap(boothCodes),
      fetchBoothDiffMap(boothCodes, meterUnitPriceMap),
    ])
    setTodayMap(map)
    setDiffMap(diffs)
    setLoading(false)
  }, [storeCode])

  useEffect(() => { load() }, [load])

  const doneCnt  = Object.keys(todayMap).length
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

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        {machines.length === 0 && (
          <p className="text-center text-muted text-base py-12">機械データがありません</p>
        )}
        {machines.map(machine => (
          <div key={machine.machine_code}>
            <p className="text-base text-muted font-bold uppercase tracking-wide px-1 py-1.5">
              {machine.machine_name}
            </p>
            <div className="space-y-1">
              {machine.booths.map(booth => (
                <MachineListRow
                  key={booth.booth_code}
                  booth={booth}
                  done={!!todayMap[booth.booth_code]}
                  diff={diffMap[booth.booth_code] ?? null}
                  onClick={() =>
                    navigate(`/clawsupport/booth/${booth.booth_code}`, {
                      state: { machine, booth, storeCode },
                    })
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
