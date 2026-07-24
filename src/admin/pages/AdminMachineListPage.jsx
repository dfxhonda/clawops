import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/ui/PageHeader'
import DateTime from '../../shared/ui/DateTime'
import { getPatrolMachines } from '../../services/patrol'
import { getTodayReadingsMap } from '../../services/patrolCore'
import { fetchStoreMachineDiffs } from '../../services/storeMachineSummary'
import MachineRow from '../../clawsupport/components/MachineRow'
import StoreTotalsHeader from '../../clawsupport/components/StoreTotalsHeader'
import BoothFlatRows from '../../clawsupport/components/MachineRowExpandedBoothList'
import { computeMachineRankMap } from '../../clawsupport/components/storeTotalsRanking'
import { computeColumnDates, mapSummaryToDateAxis, sourceArrayFor, NEWEST } from '../../clawsupport/components/patrolViewModes'
import { useAuth } from '../../hooks/useAuth'
import { isAdmin } from '../../services/permissions'
import StorePickerSheet from '../../components/StorePickerSheet'

// SPEC-METER-EDIT-BOOTH-VIEW-PORT-01 (D-118): changer 判定 (PatrolStorePage と同一)。machine_models は array/object 両形あり。
const isChanger = m => (Array.isArray(m.machine_models) ? m.machine_models[0]?.type_id : m.machine_models?.type_id) === 'changer'

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
  const [view, setView] = useState('booth')              // D1: 'machine' | 'booth'、初期 booth
  const [boothOrder, setBoothOrder] = useState('machine') // D2: 'machine' | 'ranking'、初期 machine

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

  // SPEC-PATROL-HISTORY-HEATMAP-05 F2: 店舗共通日付軸(巡回側と同一ロジック)
  const dateAxis = useMemo(() => computeColumnDates(diffMap), [diffMap])

  // D-118 D3: ブースビューのフラットブース行 (PatrolStorePage と同一)。changer 除外。mode は本画面 IN 固定 (D8)。
  //   機械順 = 機械順→各機械のブース順でフラット化 (帳簿重要順を保持)。ランキング = 現 IN の今回値で機械跨ぎ降順。
  const nonChangerMachines = useMemo(() => machines.filter(m => !isChanger(m)), [machines])
  const boothFlat = useMemo(() => {
    const entries = nonChangerMachines.flatMap(m => (m.booths ?? []).map(b => ({ booth: b, machine: m })))
    if (boothOrder !== 'ranking') return entries
    const valueOf = (bc) => {
      const summary = diffMap[bc]
      if (!summary) return null
      const mapped = dateAxis ? mapSummaryToDateAxis(summary, dateAxis) : summary
      return sourceArrayFor(mapped, 'IN')[NEWEST] ?? null
    }
    return [...entries].sort((a, b) => {
      const va = valueOf(a.booth.booth_code)
      const vb = valueOf(b.booth.booth_code)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      return vb - va
    })
  }, [nonChangerMachines, diffMap, dateAxis, boothOrder])

  // SPEC-PATROL-HISTORY-HEATMAP-05 F1: unified横スクロール — ロード完了時に最右(最新)列へ自動スクロール
  const scrollRef = useRef(null)
  useEffect(() => {
    if (dataLoading) return
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [dataLoading])

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
        hideHome={true}
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
          {/* 入力済みブース数 (スクロール外固定) */}
          {Object.keys(todayMap).length > 0 && (
            <div className="px-4 py-1 shrink-0 border-b border-border">
              <span className="text-xs text-muted">入力済み {Object.keys(todayMap).length} / {machines.reduce((s, m) => s + m.booths.length, 0)} ブース</span>
            </div>
          )}
          {/* D-118: 2ビュータブ(機械/ブース) + ブースビュー並び順トグル。巡回(PatrolStorePage)を移植。mode(IN/Ave/OUT)は本specの対象外=IN固定(D8)。 */}
          <div className="shrink-0 px-4 py-1.5 flex items-center gap-2 border-b border-border flex-wrap">
            <div role="tablist" data-testid="meteredit-view-toggle" className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface/60 p-0.5">
              <button
                type="button" role="tab" aria-selected={view === 'machine'} data-testid="meteredit-view-tab-machine"
                onClick={() => setView('machine')}
                className={`min-h-[44px] px-2.5 rounded text-xs font-bold leading-tight ${view === 'machine' ? 'bg-emerald-600 text-white' : 'text-muted active:bg-surface'}`}
              >機械</button>
              <button
                type="button" role="tab" aria-selected={view === 'booth'} data-testid="meteredit-view-tab-booth"
                onClick={() => setView('booth')}
                className={`min-h-[44px] px-2.5 rounded text-xs font-bold leading-tight ${view === 'booth' ? 'bg-emerald-600 text-white' : 'text-muted active:bg-surface'}`}
              >ブース</button>
            </div>
            {view === 'booth' && (
              <div role="tablist" data-testid="meteredit-booth-order-toggle" className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface/60 p-0.5">
                <button
                  type="button" role="tab" aria-selected={boothOrder === 'machine'} data-testid="meteredit-booth-order-machine"
                  onClick={() => setBoothOrder('machine')}
                  className={`min-h-[44px] px-2.5 rounded text-xs font-bold leading-tight ${boothOrder === 'machine' ? 'bg-emerald-600 text-white' : 'text-muted active:bg-surface'}`}
                >機械順</button>
                <button
                  type="button" role="tab" aria-selected={boothOrder === 'ranking'} data-testid="meteredit-booth-order-ranking"
                  onClick={() => setBoothOrder('ranking')}
                  className={`min-h-[44px] px-2.5 rounded text-xs font-bold leading-tight ${boothOrder === 'ranking' ? 'bg-emerald-600 text-white' : 'text-muted active:bg-surface'}`}
                >ランキング</button>
              </div>
            )}
          </div>
          {/* SPEC-PATROL-HISTORY-CROSS-FREEZE-02 (D-110): PatrolStorePage と同一の単一 overflow-auto + table(table-fixed) 十字フリーズ構造。
              共通コンポーネント(StoreTotalsHeader/MachineRow)を両ページ同構造で使い、片割れ回帰(HEATMAP-05)を構造的に潰す。 */}
          <div className="flex-1 min-h-0 overflow-auto" ref={scrollRef}>
            <table className="table-fixed border-collapse text-text" style={{ width: 664 }}>
              <colgroup>
                <col style={{ width: 160 }} />
                <col style={{ width: 64 }} />
                {Array.from({ length: 10 }, (_, i) => <col key={i} style={{ width: 44 }} />)}
              </colgroup>
              <StoreTotalsHeader
                diffMap={diffMap}
                dateAxis={dateAxis}
              />
              <tbody>
                {view === 'machine' ? (
                  // D7: 機械ビューは従来どおり (全機械 MachineRow、既存挙動不変)
                  machines.length === 0 ? (
                    <tr><td colSpan={12} className="text-center text-muted text-base py-12 px-4">機械データがありません</td></tr>
                  ) : (
                    machines.map(machine => (
                      <MachineRow
                        key={machine.machine_code}
                        machine={machine}
                        todayMap={todayMap}
                        diffMap={diffMap}
                        rankMap={rankMap}
                        dateAxis={dateAxis}
                        onBoothClick={booth =>
                          navigate(`/admin/audit/booth-edit/${booth.booth_code}`, {
                            state: { machine, booth, storeCode },
                          })
                        }
                      />
                    ))
                  )
                ) : (
                  // D6: ブースビュー = BoothFlatRows (changer除外・mode既定IN=D8・accumMap既定{}=D9)。
                  boothFlat.length === 0 ? (
                    <tr><td colSpan={12} className="text-center text-muted text-base py-12 px-4">ブースデータがありません</td></tr>
                  ) : (
                    <BoothFlatRows
                      entries={boothFlat}
                      todayMap={todayMap}
                      diffMap={diffMap}
                      dateAxis={dateAxis}
                      onBoothClick={booth =>
                        navigate(`/admin/audit/booth-edit/${booth.booth_code}`, {
                          state: {
                            machine: boothFlat.find(e => e.booth.booth_code === booth.booth_code)?.machine,
                            booth, storeCode,
                          },
                        })
                      }
                    />
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
