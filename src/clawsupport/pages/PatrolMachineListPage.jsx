import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/ui/PageHeader'
import DateTime from '../../shared/ui/DateTime'
import { getPatrolMachines } from '../../services/patrol'
import { getTodayReadingsMap } from '../../services/patrolCore'

export default function PatrolMachineListPage() {
  const { storeCode } = useParams()
  const navigate = useNavigate()

  const [storeName, setStoreName] = useState(storeCode)
  const [machines, setMachines] = useState([])
  const [todayMap, setTodayMap] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [{ data: store }, machineList] = await Promise.all([
      supabase.from('stores').select('store_name').eq('store_code', storeCode).single(),
      getPatrolMachines(storeCode),
    ])
    setStoreName(store?.store_name ?? storeCode)
    setMachines(machineList)

    const boothCodes = machineList.flatMap(m => m.booths.map(b => b.booth_code))
    const map = await getTodayReadingsMap(boothCodes)
    setTodayMap(map)
    setLoading(false)
  }, [storeCode])

  useEffect(() => { load() }, [load])

  const doneCnt  = Object.keys(todayMap).length
  const totalCnt = machines.reduce((s, m) => s + m.booths.length, 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">
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

      {/* 進捗チップ */}
      {totalCnt > 0 && (
        <div className="px-5 py-2 shrink-0">
          <span
            className={`text-xs px-3 py-1 rounded-full border ${
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

      {/* 機械 → ブース リスト */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        {machines.length === 0 && (
          <p className="text-center text-muted text-sm py-12">機械データがありません</p>
        )}
        {machines.map(machine => (
          <div key={machine.machine_code}>
            <p className="text-xs text-muted font-bold uppercase tracking-wide px-1 py-1.5">
              {machine.machine_name}
            </p>
            <div className="space-y-1">
              {machine.booths.map(booth => {
                const done = !!todayMap[booth.booth_code]
                return (
                  <button
                    key={booth.booth_code}
                    data-testid={`booth-row-${booth.booth_code}`}
                    onClick={() =>
                      navigate(`/clawsupport/booth/${booth.booth_code}`, {
                        state: { machine, booth, storeCode },
                      })
                    }
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border text-left active:scale-[0.98] transition-transform"
                  >
                    <span
                      className={`text-lg shrink-0 ${done ? 'text-emerald-400' : 'text-muted/30'}`}
                    >
                      {done ? '✓' : '○'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-text text-sm font-bold">
                        ブース {booth.booth_number}
                      </p>
                      {done && (
                        <p className="text-emerald-400/70 text-xs mt-0.5">入力済み</p>
                      )}
                    </div>
                    <span className="text-muted text-lg shrink-0">›</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
