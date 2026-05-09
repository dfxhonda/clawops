import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/ui/PageHeader'
import DateTime from '../../shared/ui/DateTime'
import { getPatrolMachines } from '../../services/patrol'
import { getTodayReadingsMap } from '../../services/patrolCore'
import { fetchBoothDiffMap } from '../../services/boothHistory'
import { fetchStoreSummary } from '../../services/storeSummary'
import MachineListRow from '../components/MachineListRow'

function fmtMoney(val) {
  if (val == null) return '—'
  return `¥${Math.round(Math.abs(val)).toLocaleString()}`
}

function fmtRate(val) {
  if (val == null) return '—'
  return val <= 1 ? `${(val * 100).toFixed(1)}%` : `${val.toFixed(1)}%`
}

function SummaryChip({ label, value, testId }) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col items-center px-3 py-2 rounded-lg bg-surface border border-border min-w-[80px]"
    >
      <span className="text-base text-muted uppercase tracking-wide leading-none mb-0.5">{label}</span>
      <span className="text-base font-bold font-mono text-text leading-tight">{value}</span>
    </div>
  )
}

export default function PatrolStorePage() {
  const { storeCode } = useParams()
  const navigate = useNavigate()

  const [storeName, setStoreName] = useState(storeCode)
  const [machines, setMachines] = useState([])
  const [todayMap, setTodayMap] = useState({})
  const [diffMap, setDiffMap] = useState({})
  const [summary, setSummary] = useState(null)
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

    const [map, diffs, sum] = await Promise.all([
      getTodayReadingsMap(boothCodes),
      fetchBoothDiffMap(boothCodes, meterUnitPriceMap),
      fetchStoreSummary(machineList),
    ])
    setTodayMap(map)
    setDiffMap(diffs)
    setSummary(sum)
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

      {/* Sticky summary bar */}
      <div
        data-testid="store-summary-bar"
        className="shrink-0 px-4 py-2 border-b border-border bg-bg/95 backdrop-blur-sm sticky top-0 z-10"
      >
        <div className="flex gap-2 overflow-x-auto pb-1">
          <SummaryChip
            testId="summary-chip-payout"
            label="出率"
            value={fmtRate(summary?.avgPayoutRate)}
          />
          <SummaryChip
            testId="summary-chip-underperform"
            label="低調台"
            value={summary?.underperformingCount != null ? String(summary.underperformingCount) : '—'}
          />
        </div>
      </div>

      {/* Progress chip */}
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

      {/* Machine → Booth list */}
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
