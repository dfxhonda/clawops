import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/ui/PageHeader'
import DateTime from '../../shared/ui/DateTime'
import { getPatrolMachines } from '../../services/patrol'
import { getTodayReadingsMap } from '../../services/patrolCore'
import { fetchStoreMachineDiffs } from '../../services/storeMachineSummary'
import MachineRow from '../../clawsupport/components/MachineRow'
import StoreTotalsHeader from '../../clawsupport/components/StoreTotalsHeader'
import { computeMachineRankMap } from '../../clawsupport/components/storeTotalsRanking'
import { useAuth } from '../../hooks/useAuth'
import { isAdmin } from '../../services/permissions'
import StorePickerSheet from '../../components/StorePickerSheet'

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

  const [storeName, setStoreName] = useState('')
  const [machines, setMachines] = useState([])
  const [todayMap, setTodayMap] = useState({})
  const [diffMap, setDiffMap] = useState({})
  const [dataLoading, setDataLoading] = useState(!!storeCode)

  useEffect(() => {
    setMachines([])
    setTodayMap({})
    setDiffMap({})
    setDataLoading(!!storeCode)
    if (!storeCode) setStoreName('')
  }, [storeCode])

  const load = useCallback(async () => {
    if (!storeCode) return
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

  // J-PATROL-IN-DAILY-fix-05: 機械単位ベスト3/ワースト3 ランクマップ
  const rankMap = useMemo(() => computeMachineRankMap(machines, diffMap), [machines, diffMap])

  function handleStorePick(code) {
    if (!code) return
    navigate(`/admin/audit/booth-edit/${code}/machines`, { replace: true })
  }

  if (loading) return null
  if (!isAdmin(staffRole)) return <UnauthorizedView />

  return (
    <div className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="admin"
        title={storeCode ? (storeName || storeCode) : '過去メーター編集'}
        variant="compact"
        rightSlot={storeCode ? <DateTime value={new Date()} format="date" /> : null}
        onBack={() => navigate('/admin/audit')}
      />

      {/* J-UI-STORE-PICKER-SHEET-METER-02: persistent store trigger at top of machine list */}
      <div className="px-4 py-2 border-b border-border shrink-0">
        <StorePickerSheet
          value={storeCode ?? null}
          onChange={handleStorePick}
          showAllOption={false}
          placeholder="店舗を選択"
        />
      </div>

      {!storeCode && (
        <div className="flex-1 flex items-center justify-center text-muted text-sm">
          上の店舗ボタンをタップして選択してください
        </div>
      )}

      {storeCode && dataLoading && (
        <div className="flex-1 flex items-center justify-center text-muted text-base">
          読み込み中...
        </div>
      )}

      {storeCode && !dataLoading && (
        <>
          {/* J-PATROL-IN-DAILY-fix-03 ad-hoc (ヒロ Discord IMG_4233):
              管理者編集モードでも巡回画面と同じ 4 列ヘッダ (前IN/今IN/前/日/今/日) で揃える。 */}
          <StoreTotalsHeader
            diffMap={diffMap}
            leftSlot={<span className="text-xs text-muted font-bold">管理者編集モード</span>}
          />
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
                rankMap={rankMap}
                onBoothClick={booth =>
                  navigate(`/admin/audit/booth-edit/${booth.booth_code}`, {
                    state: { machine, booth, storeCode },
                  })
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
