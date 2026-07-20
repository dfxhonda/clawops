import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePatrolListScrollStore } from '../../stores/patrolListScrollStore'
import { PageHeader } from '../../shared/ui/PageHeader'
import DateTime from '../../shared/ui/DateTime'
import { getPatrolMachines } from '../../services/patrol'
import { fetchStoreBaselineRows } from '../../services/boothHistory'
import { buildPrevFromRows } from '../../services/prevBaseline'
import { fetchCollectionBaseline } from '../../services/collectionBaseline'
import MachineRow from '../components/MachineRow'
import StoreTotalsHeader from '../components/StoreTotalsHeader'
import { computeMachineRankMap } from '../components/storeTotalsRanking'
import {
  computeColumnDates,
  VIEW_MODES,
  VIEW_MODE_ORDER,
} from '../components/patrolViewModes'
// SPEC-LF1-STORE-LOCAL-CACHE-01 + SPEC-LF1-HISTORY-FIX-01:
import {
  getPatrolRecordsByStore,
  putPatrolRecord,
  putStoreMeta,
  getStoreMeta,
  putBaselineRows,
  reconcileSyncedByBaseline,
  sweepBaselineOrphans,
} from '../../lib/localStore/patrolRecords'
import { computeLocalStoreView } from '../state/localStoreView'
import { setPrevHold, clearPrevHold } from '../state/patrolPrevHold'
import { uploadStoreRecords } from '../../services/storeSync'
import { notifyLfChange } from '../../hooks/useUnsentBanner'
import { useAuth } from '../../hooks/useAuth'
import { logger } from '../../lib/logger'

export default function PatrolStorePage() {
  const { storeCode } = useParams()
  const navigate = useNavigate()
  const { staffId } = useAuth()

  // 巡回ブースリストの展開状態 + 復帰時スクロール先 (保存ボタン「リストに戻る」用)
  const expandedByStore = usePatrolListScrollStore(s => s.expandedByStore)
  const focusBoothByStore = usePatrolListScrollStore(s => s.focusBoothByStore)
  const toggleExpanded = usePatrolListScrollStore(s => s.toggleExpanded)
  const ensureExpanded = usePatrolListScrollStore(s => s.ensureExpanded)
  const clearFocusBooth = usePatrolListScrollStore(s => s.clearFocusBooth)
  const setExpandedForStore = usePatrolListScrollStore(s => s.setExpandedForStore)
  const expandedSet = expandedByStore[storeCode] ?? []

  const [storeName, setStoreName] = useState(storeCode)
  const [machines, setMachines] = useState([])
  const [todayMap, setTodayMap] = useState({})
  const [diffMap, setDiffMap] = useState({})
  // SPEC-PATROL-ACCUM-COL-S2-SUPPLY-01 (D-097): 集金軸の累計/baseline 供給 (日付軸 diffMap とは別レーン)。表示は S3。
  const [accumMap, setAccumMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('IN')
  const [syncing, setSyncing] = useState(false)
  const [changerExpanded, setChangerExpanded] = useState(false)

  // SPEC-LF1: IDB → 描画。
  const hydrateFromIdb = useCallback(async () => {
    const meta = await getStoreMeta(storeCode)
    const records = await getPatrolRecordsByStore(storeCode)
    // SPEC-LF1-HISTORY-FIX-01: hit gate は 'meta あり AND server baseline あり' を要求。
    //   AC-02 / DIAG h1: 今日 save 1 件しかない状態で hit してしまうと baseline 不在で全列 '-'。
    //   baseline = synced=true の record が 1 件でもあれば 'server baseline 取得済' と判断。
    const hasBaseline = records.some(r => r.synced === true)
    if (!meta || records.length === 0 || !hasBaseline) return false
    setStoreName(meta.storeName ?? storeCode)
    setMachines(meta.machines ?? [])
    const { diffMap: d, todayMap: t } = computeLocalStoreView(records)
    setDiffMap(d)
    setTodayMap(t)
    setLoading(false)
    return true
  }, [storeCode])

  // SPEC-LF1-HISTORY-FIX-01 (approach A):
  // - fetchStoreBaselineRows で booth ごと 5 行 raw を 1 windowed query で取得 (AC-09)
  // - putBaselineRows で synced=true として idempotent put (localId=reading_id で重複なし)
  // - 取得後 IDB から refreshed records を読み computeLocalStoreView (server+local 統合)
  // - 失敗は ERR-LF1-BASELINE-FETCH log のみで silent swallow 回避、既存 IDB データで継続。
  const refreshBaselineAndRender = useCallback(async () => {
    let machineList = []
    let resolvedName = storeCode
    try {
      const [{ data: store }, ml] = await Promise.all([
        supabase.from('stores').select('store_name').eq('store_code', storeCode).single(),
        getPatrolMachines(storeCode),
      ])
      resolvedName = store?.store_name ?? storeCode
      machineList = ml ?? []
      await putStoreMeta(storeCode, { storeName: resolvedName, machines: machineList })
      const boothCodes = machineList.flatMap(m => m.booths.map(b => b.booth_code))
      const rows = await fetchStoreBaselineRows(boothCodes)
      await putBaselineRows(rows)
      // FIX_A: iOS kill でmarkRecordSynced未実行になったレコードをbaseline照合で自動回復。
      const reconciled = await reconcileSyncedByBaseline(rows)
      if (reconciled > 0) notifyLfChange()
      // SPEC-LF1-BASELINE-AUTHORITATIVE-SWEEP-01: baseline を権威として、server 削除済みの
      // 幽霊 synced 行 / localId!=reading_id の legacy 重複を booth 単位で掃除する。
      // reconcile の後に実行 (tab-kill 回復で synced 化した行を評価対象へ含める為)。
      // fire-and-forget: sweep 例外は history 描画/upload を絶対に壊さない。
      try {
        const byBooth = new Map()
        for (const row of rows) {
          if (!row.booth_code) continue
          if (!byBooth.has(row.booth_code)) byBooth.set(row.booth_code, [])
          byBooth.get(row.booth_code).push(row)
        }
        let swept = 0
        for (const [bCode, bRows] of byBooth) {
          swept += await sweepBaselineOrphans(bRows, { boothCode: bCode })
        }
        if (swept > 0) notifyLfChange()
      } catch (err) {
        logger.warn?.('ERR-LF1-BASELINE-SWEEP', { storeCode, message: err?.message })
      }
      // SPEC-PATROL-SWIPE-LATENCY-FIX-03: tier-0 memory hold — one prev per booth from rows already in hand。
      // SPEC-PATROL-PRIZE-PREFILL-REPLACE-VISIBLE-FIX-01 (D-094): rows は patrol+replace 混在になったので、
      // 単純な first-occurrence ではなく buildPrevFromRows で booth ごとに景品=最新any/メーター=patrol を合成する。
      try {
        const byBooth = {}
        for (const row of rows) {
          if (!row.booth_code) continue
          ;(byBooth[row.booth_code] ??= []).push(row)
        }
        const prevMap = {}
        for (const bc of Object.keys(byBooth)) {
          const prev = buildPrevFromRows(byBooth[bc])
          if (prev) prevMap[bc] = prev
        }
        setPrevHold(storeCode, prevMap)
      } catch (err) {
        logger.warn?.('ERR-LF1-PREVHOLD-SET', { storeCode, message: err?.message })
      }
    } catch (err) {
      logger.warn?.('ERR-LF1-BASELINE-FETCH', { storeCode, message: err?.message })
    }
    // IDB から再読込し、統合 view を描画。失敗してもここで止めず existing state を保持。
    const records = await getPatrolRecordsByStore(storeCode)
    const meta = await getStoreMeta(storeCode)
    setStoreName(meta?.storeName ?? resolvedName)
    setMachines(meta?.machines ?? machineList)
    const { diffMap: d, todayMap: t } = computeLocalStoreView(records)
    setDiffMap(d)
    setTodayMap(t)
    setLoading(false)
  }, [storeCode])

  useEffect(() => {
    let cancel = false
    async function init() {
      // 1) instant render from IDB if baseline 既存 (subsequent open)
      const hit = await hydrateFromIdb()
      if (cancel) return
      // 2) AC-06 freshness: always refresh baseline so other-day/other-device 変更が反映される。
      //    cache hit でも background で refresh (初回は loading 状態で待つ)。
      if (!hit) {
        await refreshBaselineAndRender()
      } else {
        // hit=true (instant render 済) は background refresh、最後に setDiffMap で update。
        refreshBaselineAndRender().catch(err =>
          logger.warn?.('ERR-LF1-BASELINE-BG-REFRESH', { storeCode, message: err?.message })
        )
      }
    }
    init()
    return () => { cancel = true }
  }, [hydrateFromIdb, refreshBaselineAndRender, storeCode])

  // SPEC-PATROL-ACCUM-COL-S2-SUPPLY-01 (D-097): 入店時 (storeCode 変化=入店/スワイプ先店舗) に集金累計 baseline を 1 回だけ RPC fetch。
  // per-swipe の往復再fetch はしない (deps=[storeCode] のみ)。RPC 失敗時も accumMap 空で継続 (巡回本体をブロックしない)。
  useEffect(() => {
    let alive = true
    fetchCollectionBaseline(storeCode).then(m => { if (alive) setAccumMap(m) })
    return () => { alive = false }
  }, [storeCode])

  // SPEC-LF1-STOREPAGE-STALE-FIX-01
  useEffect(() => {
    function handler() { hydrateFromIdb() }
    window.addEventListener('clawops-lf1-changed', handler)
    return () => window.removeEventListener('clawops-lf1-changed', handler)
  }, [hydrateFromIdb])

  // SPEC-LF1: 店舗離脱 (unmount) で auto-sync。fire-and-forget。
  // ref で staffId を保持してクロージャ陳腐化を回避。
  const staffIdRef = useRef(staffId)
  staffIdRef.current = staffId
  // SPEC-PATROL-ACCUM-COL-S3-DISPLAY-01 (D-098): 退店 upload 後の累計引き直しで、店スワイプ中の別店取り違えを防ぐ現在店 ref。
  const storeCodeRef = useRef(storeCode)
  storeCodeRef.current = storeCode
  useEffect(() => {
    return () => {
      const sCode = storeCode
      if (!sCode) return
      // SPEC-PATROL-SWIPE-LATENCY-FIX-03: tier-0 hold を store 退出時に解放 (unbounded growth 防止)
      clearPrevHold(sCode)
      // 非同期で実行、navigation を絶対にブロックしない
      uploadStoreRecords(sCode, { staff: { staffId: staffIdRef.current } })
        .then(res => {
          if (res.uploaded > 0 || res.failed > 0) {
            notifyLfChange()
            // SPEC-PATROL-ACCUM-COL-S3-DISPLAY-01 (D-098): 退店 upload 成功後も累計引き直し (次回入店整合、best-effort)。
            // 現在店が sCode のままの時のみ setAccumMap (別店へスワイプ済みなら破棄=取り違え防止)。navigation はブロックしない。
            fetchCollectionBaseline(sCode)
              .then(m => { if (storeCodeRef.current === sCode) setAccumMap(m) })
              .catch(() => {})
          }
        })
        .catch(err => logger.warn?.('ERR-LF1-AUTO-SYNC', { storeCode: sCode, message: err?.message }))
    }
  }, [storeCode])

  // 全ブースのフラット順 (保存して次ブース算出用)
  const boothList = useMemo(
    () => machines.flatMap(m => (m.booths ?? []).map(b => ({ booth: b, machine: m }))),
    [machines],
  )

  const rankMap = useMemo(
    () => computeMachineRankMap(machines, diffMap, viewMode),
    [machines, diffMap, viewMode],
  )

  // SPEC-PATROL-HISTORY-HEATMAP-02 F1: 店舗共通日付軸
  const dateAxis = useMemo(() => computeColumnDates(diffMap), [diffMap])

  // SPEC-PATROL-HISTORY-HEATMAP-02 F2: 一体横スクロール — ロード完了時に最右端へ自動スクロール
  const unifiedScrollRef = useRef(null)
  useEffect(() => {
    if (loading) return
    if (unifiedScrollRef.current) {
      unifiedScrollRef.current.scrollLeft = unifiedScrollRef.current.scrollWidth
    }
  }, [loading])

  // F6: 全展開/折畳み — 複数ブース機械だけ対象
  const isChanger = m => (Array.isArray(m.machine_models) ? m.machine_models[0]?.type_id : m.machine_models?.type_id) === 'changer'
  const changerMachines = machines.filter(isChanger)
  const nonChangerMachines = machines.filter(m => !isChanger(m))

  const multiBoothCodes = useMemo(
    () => nonChangerMachines.filter(m => (m.booths ?? []).length > 1).map(m => m.machine_code),
    [machines], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const allExpanded = multiBoothCodes.length > 0 && multiBoothCodes.every(mc => expandedSet.includes(mc))
  function handleExpandAllToggle() {
    setExpandedForStore(storeCode, allExpanded ? [] : multiBoothCodes)
  }

  const changerBoothCodes = new Set(changerMachines.flatMap(m => m.booths.map(b => b.booth_code)))
  const doneCnt = Object.keys(todayMap).filter(bc => !changerBoothCodes.has(bc)).length
  const totalCnt = nonChangerMachines.reduce((s, m) => s + m.booths.length, 0)

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

  // とりま保存 button: 手動で当店の未送信を upload。
  async function handleManualUpload() {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await uploadStoreRecords(storeCode, { staff: { staffId }, skipProbe: false })
      if (res.uploaded > 0 || res.failed > 0) {
        notifyLfChange()
        await hydrateFromIdb()
        // SPEC-PATROL-ACCUM-COL-S3-DISPLAY-01 (D-098): 全台サーバー保存(とりま保存)成功後、その場で累計を引き直して累計列を最新化。
        // 保存後も同じ店の画面に残って入替検討する用途 (ヒロ確定 B案)。fetchCollectionBaseline は失敗時 {} を返し巡回をブロックしない。
        const accum = await fetchCollectionBaseline(storeCode)
        setAccumMap(accum)
      }
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-base">
        読み込み中...
      </div>
    )
  }

  return (
    <div className="h-svh flex flex-col bg-bg text-text">
      <PageHeader
        module="clawsupport"
        title={storeName}
        variant="compact"
        onBack={() => navigate('/clawsupport')}
      />

      {/* SPEC-PATROL-STORE-HEADER-2ROW-01: 完了バッジ/とりま保存/日付を2段目操作バーへ移動、店名フル表示 */}
      <div className="shrink-0 flex items-center gap-2 px-5 pb-2">
        {totalCnt > 0 && (
          <span
            data-testid="patrol-store-done-badge"
            className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${
              doneCnt >= totalCnt
                ? 'text-emerald-400 border-emerald-400/40'
                : doneCnt > 0
                ? 'text-amber-400 border-amber-400/40'
                : 'text-muted border-border'
            }`}
          >
            {doneCnt}/{totalCnt} 完了
          </span>
        )}
        <button
          type="button"
          data-testid="patrol-store-manual-upload"
          onClick={handleManualUpload}
          disabled={syncing}
          className="text-[11px] min-h-[44px] px-3 py-1 rounded-md bg-emerald-600/90 text-white font-bold disabled:opacity-50"
        >
          {syncing ? '送信中...' : 'とりま保存'}
        </button>
        <DateTime value={new Date()} format="date" />
      </div>

      {/* SPEC-PATROL-HISTORY-HEATMAP-04 F2: 両替機セクション — デフォルト折畳み、バッジタップで展開 */}
      {changerMachines.length > 0 && (
        <div className="shrink-0 border-b border-border">
          <button
            type="button"
            data-testid="changer-section-toggle"
            onClick={() => setChangerExpanded(e => !e)}
            className="w-full flex items-center gap-2 px-4 py-1.5 text-left"
          >
            <span className="text-base">🪙</span>
            <span className="text-sm font-bold text-amber-300">両替機 {changerMachines.length}台</span>
            <span className="ml-auto text-muted text-xs">{changerExpanded ? '▲' : '▼'}</span>
          </button>
          {changerExpanded && (
            <div className="px-4 pb-2 flex flex-col gap-1.5">
              {changerMachines.map(machine => (
                <button
                  key={machine.machine_code}
                  type="button"
                  data-testid={`changer-tile-${machine.machine_code}`}
                  onClick={() => navigate(`/clawsupport/changer/${machine.machine_code}`, { state: { storeName, storeCode } })}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-900/20 border-2 border-amber-600/60 hover:border-amber-500 text-left active:scale-[0.98] transition-transform"
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
            </div>
          )}
        </div>
      )}

      {/* Controls: mode toggle + expand toggle (fixed、スクロール外) */}
      <div className="shrink-0 px-4 py-1.5 flex items-center gap-2 border-b border-border">
        <div
          role="tablist"
          data-testid="patrol-view-mode-toggle"
          className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface/60 p-0.5"
        >
          {VIEW_MODE_ORDER.map(m => {
            const active = m === viewMode
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`patrol-view-mode-btn-${m}`}
                onClick={() => setViewMode(m)}
                className={`min-h-[44px] px-2.5 rounded text-xs font-bold leading-tight ${
                  active ? 'bg-emerald-600 text-white' : 'text-muted active:bg-surface'
                }`}
              >
                {VIEW_MODES[m].label}
              </button>
            )
          })}
        </div>
        {multiBoothCodes.length > 0 && (
          <button
            type="button"
            data-testid="expand-all-toggle"
            onClick={handleExpandAllToggle}
            className="text-xs text-muted border border-border rounded px-2 py-0.5 min-h-[44px] min-w-[44px] active:bg-surface"
          >
            {allExpanded ? '全閉' : '全開'}
          </button>
        )}
      </div>

      {/* F2: 一体横スクロール — StoreTotalsHeader + 全機械行が同一コンテナで水平同期スクロール */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="overflow-x-auto" ref={unifiedScrollRef}>
          <div className="min-w-max">
            <StoreTotalsHeader
              diffMap={diffMap}
              dateAxis={dateAxis}
              mode={viewMode}
              accumMap={accumMap}
            />
            <div className="pt-2 pb-6 space-y-1.5">
              {nonChangerMachines.length === 0 && (
                <p className="text-center text-muted text-base py-12 px-4">機械データがありません</p>
              )}
              {nonChangerMachines.map(machine => (
                <MachineRow
                  key={machine.machine_code}
                  machine={machine}
                  todayMap={todayMap}
                  diffMap={diffMap}
                  rankMap={rankMap}
                  mode={viewMode}
                  dateAxis={dateAxis}
                  accumMap={accumMap}
                  expanded={expandedSet.includes(machine.machine_code)}
                  onToggleExpand={() => toggleExpanded(storeCode, machine.machine_code)}
                  onBoothClick={booth =>
                    navigate(`/clawsupport/booth/${booth.booth_code}`, {
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
        </div>
      </div>
    </div>
  )
}

// Eslint workaround: putPatrolRecord は PatrolBoothInputPage で使うので
// 本ファイルでは import 済みだが直接 use しない。保留のため _suppress として残す。
// (build 影響なし、無視可能。後続 LF1-fix で削除予定。)
// eslint-disable-next-line no-unused-vars
const _suppress = putPatrolRecord
