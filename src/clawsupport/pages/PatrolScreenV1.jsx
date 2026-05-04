import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/ui/PageHeader'
import { getPatrolMachines, getTodayReadings } from '../../services/patrol'
import LogoutButton from '../../components/LogoutButton'

function formatTime(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit',
  })
}

export default function PatrolScreenV1() {
  const { storeCode } = useParams()
  const navigate = useNavigate()

  const [storeName, setStoreName] = useState(storeCode)
  const [machines, setMachines] = useState([])
  const [todayMap, setTodayMap] = useState({})
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)

  async function load(code, name) {
    const machineList = await getPatrolMachines(code)
    const boothCodes = machineList.flatMap(m => m.booths.map(b => b.booth_code))
    const todayReadings = await getTodayReadings(boothCodes)
    setMachines(machineList)
    setTodayMap(todayReadings)
    if (name) setStoreName(name)
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const { data: store } = await supabase
        .from('stores')
        .select('store_name')
        .eq('store_code', storeCode)
        .single()
      const name = store?.store_name ?? storeCode
      setStoreName(name)
      await load(storeCode, name)
      intervalRef.current = setInterval(() => load(storeCode), 30000)
    }
    init()
    return () => clearInterval(intervalRef.current)
  }, [storeCode]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalCount = machines.reduce((n, m) => n + m.booths.length, 0)
  const doneCount = Object.keys(todayMap).length

  function navigateToBooth(machine, booth) {
    navigate('/patrol/input', {
      state: {
        booth,
        machine,
        machines,
        storeCode,
        storeName,
      },
    })
  }

  const progressLabel = totalCount > 0
    ? `${doneCount}/${totalCount} ブース`
    : ''

  return (
    <div className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="clawsupport"
        title={storeName}
        subtitle={progressLabel}
        onBack={() => navigate(`/clawsupport/store/${storeCode}`)}
        rightSlot={
          <LogoutButton className="h-10 px-3 text-xs text-muted bg-surface border border-border rounded-xl active:opacity-70" />
        }
      />

      {/* 進捗バー */}
      {totalCount > 0 && (
        <div className="shrink-0 px-5 pb-3">
          {doneCount >= totalCount ? (
            <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-sm">
              ✅ 本日の巡回完了！
            </div>
          ) : (
            <>
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>{doneCount} / {totalCount} ブース完了</span>
                <span>{totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}%</span>
              </div>
              <div className="h-1 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : '0%' }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* 機械リスト */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-8">
        {loading && (
          <div className="flex items-center justify-center py-16 text-muted text-sm">
            読み込み中...
          </div>
        )}

        {!loading && machines.length === 0 && (
          <div className="flex items-center justify-center py-16 text-muted text-sm">
            登録された機械がありません
          </div>
        )}

        <div className="space-y-3 pt-1">
          {machines.map(machine => {
            const doneMachine = machine.booths.filter(b => !!todayMap[b.booth_code]).length
            const totalMachine = machine.booths.length
            const allDone = doneMachine >= totalMachine && totalMachine > 0

            return (
              <div
                key={machine.machine_code}
                className="bg-surface border border-border rounded-xl overflow-hidden"
              >
                {/* 機械ヘッダー */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-border">
                  <span className="text-sm font-bold flex-1 min-w-0 truncate text-text">
                    {machine.machine_name}
                  </span>
                  <span className="text-xs text-muted font-mono shrink-0">{machine.machine_code}</span>
                  <span className={`text-xs shrink-0 ${allDone ? 'text-emerald-400' : 'text-muted'}`}>
                    {doneMachine}/{totalMachine}
                  </span>
                </div>

                {/* ブース行 */}
                {machine.booths.map(booth => {
                  const reading = todayMap[booth.booth_code]
                  const isDone = !!reading
                  return (
                    <button
                      key={booth.booth_code}
                      onClick={() => navigateToBooth(machine, booth)}
                      className={`w-full flex items-center gap-3 px-4 py-3 border-t border-border text-left transition-colors active:bg-surface ${
                        isDone ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      <span className="text-base w-5 shrink-0">{isDone ? '✅' : '⬜'}</span>
                      <span className="text-sm font-medium text-text">
                        B{String(booth.booth_number).padStart(2, '0')}
                      </span>
                      {isDone ? (
                        <span className="ml-auto text-xs text-emerald-400">
                          {formatTime(reading.read_time)} 入力済み
                        </span>
                      ) : (
                        <span className="ml-auto text-xs text-muted">未入力</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
