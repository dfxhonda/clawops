import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useGlossaryStore } from './stores/glossaryStore'

// ===== ドメイン別ルーティング =====
// patrol.clawops.app → 巡回アプリ専用（/admin へのアクセスは admin.clawops.app にリダイレクト）
// admin.clawops.app  → 管理アプリ専用（/ へのアクセスは /admin にリダイレクト）
// ※ Step 5（clawops-tau.vercel.app → 新ドメインへの旧URLリダイレクト）はドメイン取得後に追加
const _host = window.location.hostname
if (_host === 'patrol.clawops.app' && window.location.pathname.startsWith('/admin')) {
  window.location.replace('https://admin.clawops.app' + window.location.pathname + window.location.search)
} else if (_host === 'admin.clawops.app' && !window.location.pathname.startsWith('/admin') && window.location.pathname !== '/login') {
  window.location.replace('/admin' + window.location.search)
}
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './lib/auth/AuthProvider'
import { useAuth } from './hooks/useAuth'
import ProtectedRoute, { AdminRoute, ManagerRoute } from './components/ProtectedRoute'
import { RoleGuard } from './shared/auth/RoleGuard'
// SPEC-LF1-STORE-LOCAL-CACHE-01: 未送信件数の app-wide banner
import UnsentBanner from './components/UnsentBanner'
import { makeDebouncedUploadAll } from './services/storeSync'
import { buildLabel } from './lib/buildInfo'
import { useSessionLock } from './hooks/useIdleLogout'

// ===== 遅延読み込み =====
// 初回ロードは Login + Launcher のみ。他は画面遷移時にロード。

// 即時ロード（初回表示に必要）
import Login from './pages/Login'
import Launcher from './pages/Launcher'

// 遅延ロード — メインタブ
const Dashboard = lazy(() => import('./manesupport/pages/Dashboard'))
const DashboardTop = lazy(() => import('./dashboard/pages/DashboardTop'))
// J-ADMIN-02: Admin IA layout + hub pages (旧実装は _legacy/ に移動)
const AdminLayout           = lazy(() => import('./admin/AdminLayout'))
const AdminMastersHubPage   = lazy(() => import('./admin/pages/AdminMastersHubPage'))
const AdminCollectionFlagPage = lazy(() => import('./admin/pages/AdminCollectionFlagPage'))
const AdminCollectionHubPage  = lazy(() => import('./admin/pages/AdminCollectionHubPage'))
const CollectionInputPage   = lazy(() => import('./collection/CollectionInputPage'))
const CollectionHistoryPage = lazy(() => import('./collection/CollectionHistoryPage'))
const CashReconcilePage     = lazy(() => import('./collection/CashReconcilePage'))
const AdminDevAssetsListPage = lazy(() => import('./admin/pages/AdminDevAssetsListPage'))
const AdminDevAssetsUploadPage = lazy(() => import('./admin/pages/AdminDevAssetsUploadPage'))
const AdminAuditHubPage     = lazy(() => import('./admin/pages/AdminAuditHubPage'))
const AdminReportsHubPage   = lazy(() => import('./admin/pages/AdminReportsHubPage'))
// J-REPORTS-ANALYTICS-01 2026-05-30: 7 売上分析画面 lazy import
const BoothRankingPage    = lazy(() => import('./admin/pages/reports/BoothRankingPage'))
const PayoutTrendPage     = lazy(() => import('./admin/pages/reports/PayoutTrendPage'))
const SevenDmaPage        = lazy(() => import('./admin/pages/reports/SevenDmaPage'))
const PrizeCostPage       = lazy(() => import('./admin/pages/reports/PrizeCostPage'))
const StoreComparisonPage = lazy(() => import('./admin/pages/reports/StoreComparisonPage'))
const ProfitCalendarPage      = lazy(() => import('./admin/pages/reports/ProfitCalendarPage'))
const CollectionExportPage    = lazy(() => import('./admin/pages/reports/CollectionExportPage'))
const AdminSettingsHubPage  = lazy(() => import('./admin/pages/AdminSettingsHubPage'))
const AdminPlaceholderPage  = lazy(() => import('./admin/pages/AdminPlaceholderPage'))
const AdminQRLabelPage      = lazy(() => import('./admin/pages/AdminQRLabelPage'))
const AdminMachineLayoutPage   = lazy(() => import('./admin/pages/AdminMachineLayoutPage'))
const AdminStaffListPage     = lazy(() => import('./admin/pages/AdminStaffListPage'))
const AdminSupplierPage           = lazy(() => import('./admin/pages/AdminSupplierPage'))
const AdminOperationLogsPage      = lazy(() => import('./admin/pages/AdminOperationLogsPage'))
const AdminLoginLogsPage          = lazy(() => import('./admin/pages/AdminLoginLogsPage'))
const AdminPrizePhaseHistoryPage  = lazy(() => import('./admin/pages/AdminPrizePhaseHistoryPage'))
const AdminStockMovementsPage     = lazy(() => import('./admin/pages/AdminStockMovementsPage'))
const AdminStoreListPage          = lazy(() => import('./admin/pages/AdminStoreListPage'))
const AdminBulkImportPage         = lazy(() => import('./admin/pages/AdminBulkImportPage'))
const AdminImportHubPage          = lazy(() => import('./admin/pages/AdminImportHubPage'))

// 遅延ロード — 巡回入力
const RankingView = lazy(() => import('./clawsupport/pages/RankingView'))

// 遅延ロード — マスタ追加
// J-NAV-ORPHAN-CLEANUP-01 2026-05-30: BoothQrPrint は /admin/qr-print の動線無し orphan、
// /admin/labels (AdminQRLabelPage) が現役のため lazy import 削除。
const AdminModelList = lazy(() => import('./manesupport/pages/ModelList'))
const AdminMachineList = lazy(() => import('./manesupport/pages/MachineList'))
const AdminBoothList = lazy(() => import('./manesupport/pages/BoothList'))
const ManualEditor = lazy(() => import('./manesupport/pages/ManualEditor'))
const ManualView = lazy(() => import('./manesupport/pages/ManualView'))

// 遅延ロード — 管理系
const EditReading = lazy(() => import('./manesupport/pages/EditReading'))
const DataSearch = lazy(() => import('./manesupport/pages/DataSearch'))
const LockerList = lazy(() => import('./manesupport/pages/LockerList'))
const ForecastList = lazy(() => import('./manesupport/pages/ForecastList'))
const ForecastDetail = lazy(() => import('./manesupport/pages/ForecastDetail'))
const ImportSlips = lazy(() => import('./manesupport/pages/ImportSlips'))
const SetupSheets = lazy(() => import('./manesupport/pages/SetupSheets'))
const TestDataImport = lazy(() => import('./manesupport/pages/TestDataImport'))
const AuditLog = lazy(() => import('./manesupport/pages/AuditLog'))
// J-NAV-ORPHAN-CLEANUP-01 2026-05-30: AuditSummary / DailyStatsAdmin は動線無し orphan、lazy import 削除。

// 遅延ロード — 用語マスタ管理
const AdminGlossary = lazy(() => import('./manesupport/pages/AdminGlossary'))

// 遅延ロード — タナサポ
const TanasupportHub       = lazy(() => import('./tanasupport/pages/TanasupportHub'))
const OrderList            = lazy(() => import('./tanasupport/pages/OrderList'))
const StoreDashboard       = lazy(() => import('./tanasupport/StoreDashboard'))
const StocktakeInput       = lazy(() => import('./tanasupport/stocktake/StocktakeInput'))
const StocktakeSessionPage = lazy(() => import('./tanasupport/stocktake/StocktakeSessionPage'))
const StocktakeTargetPage  = lazy(() => import('./tanasupport/pages/StocktakeTargetPage'))
const LocationHubPage      = lazy(() => import('./tanasupport/pages/LocationHubPage'))
const OcrCountTestPage     = lazy(() => import('./tanasupport/pages/OcrCountTestPage'))

// 遅延ロード — タナサポ 棚卸し管理 (マネサポ側)
const StocktakeSessionListAdmin = lazy(() => import('./manesupport/admin/stocktake/SessionListAdmin'))
const StocktakeSessionCreate    = lazy(() => import('./manesupport/admin/stocktake/SessionCreate'))
const StocktakeSessionDetail    = lazy(() => import('./manesupport/admin/stocktake/SessionDetail'))
const StocktakeDashboard        = lazy(() => import('./manesupport/admin/stocktake/StocktakeDashboard'))

// 遅延ロード — ヘルプ
const HelpPage = lazy(() => import('./pages/HelpPage'))

// SPEC-STAFF-INVITE-S3-TOKEN-RECEIVE-01: 招待受信画面 (ProtectedRoute外、未認証可)
const InvitePage = lazy(() => import('./pages/InvitePage'))

// 遅延ロード — J-ADMIN-01 管理者ブース編集
const AdminStorePage      = lazy(() => import('./admin/pages/AdminStorePage'))
const AdminMachineListPage = lazy(() => import('./admin/pages/AdminMachineListPage'))
const AdminBoothEditPage   = lazy(() => import('./admin/pages/AdminBoothEditPage'))

// 遅延ロード — J-ADMIN-05 景品マスタ + 発注履歴
const AdminPrizeMasterPage  = lazy(() => import('./admin/pages/AdminPrizeMasterPage'))
const AdminOrderHistoryPage = lazy(() => import('./admin/pages/AdminOrderHistoryPage'))

// 遅延ロード — J-PATROL-ALERTS-HUB-01
const AlertListPage       = lazy(() => import('./clawsupport/pages/AlertListPage'))
const ChangerInputPage    = lazy(() => import('./clawsupport/pages/ChangerInputPage'))
const AdminAlertTypesPage = lazy(() => import('./admin/pages/AdminAlertTypesPage'))

// 遅延ロード — クレサポ v1.0 ハブ
const ClawsupportHub        = lazy(() => import('./clawsupport/pages/ClawsupportHub'))
const ClawsupportStoreDash  = lazy(() => import('./clawsupport/pages/ClawsupportStoreDash'))
const PatrolScreenV1        = lazy(() => import('./clawsupport/pages/PatrolScreenV1'))
// M1 Stage 2: ブース入力
const PatrolBoothInputPage  = lazy(() => import('./clawsupport/pages/PatrolBoothInputPage'))
// M1 Stage 3: 店舗ハブ (sticky summary bar + diff chips)
const PatrolStorePage       = lazy(() => import('./clawsupport/pages/PatrolStorePage'))

// 遅延ロード — OCRアプリ
const PatrolCameraPage  = lazy(() => import('./clawsupport/pages/PatrolCameraPage'))
const PatrolBatchOcrPage = lazy(() => import('./clawsupport/pages/PatrolBatchOcrPage'))
const OCRTestPage = lazy(() => import('./clawsupport/pages/OCRTestPage'))

// 遅延ロード — 棚卸しアプリ（PIN認証）
const StocktakeLogin = lazy(() => import('./tanasupport/pages/StocktakeLogin'))
const StocktakeTop = lazy(() => import('./tanasupport/pages/StocktakeTop'))
const StocktakeCount = lazy(() => import('./tanasupport/pages/StocktakeCount'))
const StocktakeSummary = lazy(() => import('./tanasupport/pages/StocktakeSummary'))
const StockDashboard = lazy(() => import('./tanasupport/pages/StockDashboard'))
const StockMove    = lazy(() => import('./tanasupport/pages/StockMove'))
const StockCount   = lazy(() => import('./tanasupport/pages/StockCount'))
const StockOutPage       = lazy(() => import('./tanasupport/pages/StockOutPage'))
const ArrivalCheckPage   = lazy(() => import('./tanasupport/pages/ArrivalCheckPage'))
const StockHubPage       = lazy(() => import('./tanasupport/pages/StockHubPage'))
// SPEC-STOCK-ANNOUNCEMENTS-01: 景品案内ビューア (お気に入り付き)
const AnnouncementsPage  = lazy(() => import('./pages/stock/AnnouncementsPage'))


// ローディングスピナー（Suspense フォールバック）
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">読み込み中...</p>
      </div>
    </div>
  )
}

// SPEC-AUTH-TIMEOUT-LOCKSCREEN-01: hidden 中の視覚カバー。position:fixed + inset-0 で viewport
// 端固定 (既知の iOS h-dvh/h-svh cutoff を避けるため height-class は使わない)。Routes は下で
// マウントされ続けるので、復帰(isLocked→false)時は離れた画面へ remount/reload なしで即戻る。
// 既存 design token のみ (--color-bg / --color-accent / --color-muted)。読み込みではないので spinner なし。
function AppLockOverlay() {
  return (
    <div className="fixed inset-0 z-[200] bg-bg flex items-center justify-center">
      <div className="text-center">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor"
             strokeWidth="1.8" className="text-accent mx-auto mb-3" aria-hidden="true">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <p className="text-muted text-sm">ロック中</p>
      </div>
    </div>
  )
}

// DIAG-SWIPE-BLACKSCREEN-01 fix A: useParams から boothCode を読み、key prop に渡すことで
// React Router v6 の param-only update では起きないコンポーネント再マウントを強制する。
// これにより PatrolBoothInputPage の useState 初期化 (consumePendingEnterFrom) と
// 入場アニメ useEffect[] が boothCode 変更毎に再実行され、ANIM-01 の swipeDx が初期化される。
function PatrolBoothInputPageKeyed() {
  const { boothCode } = useParams()
  return <PatrolBoothInputPage key={boothCode} />
}

function AppInner() {
  const { isLoggedIn, staffId } = useAuth()
  // SPEC-AUTH-TIMEOUT-LOCKSCREEN-01: hidden 中は isLocked=true。ログイン中のみカバー表示。
  const isLocked = useSessionLock(isLoggedIn)

  const initGlossary = useGlossaryStore(s => s.init)
  const cleanupGlossary = useGlossaryStore(s => s.cleanup)

  useEffect(() => {
    initGlossary()
    return () => cleanupGlossary()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // SPEC-LF1-IDEMPOTENT-SYNC-01 D6: iOS tab-kill が unmount trigger を飛ばす対策。
  // 'online' 復帰 + visibilitychange(visible) で shared 10s debounce → uploadAllUnsynced を
  // fire-and-forget。ClawsupportHub / PatrolStorePage 既存 trigger はそのまま残す (追加のみ)。
  useEffect(() => {
    if (!isLoggedIn || typeof window === 'undefined') return
    const trigger = makeDebouncedUploadAll({ getStaff: () => ({ staffId }) })
    const onVisible = () => { if (document.visibilityState === 'visible') trigger() }
    window.addEventListener('online', trigger)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', trigger)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isLoggedIn, staffId])
  return (
    <ErrorBoundary>
      {/* SPEC-AUTH-TIMEOUT-LOCKSCREEN-01: hidden 中の視覚カバー。Routes を unmount せず被せるだけ。
          ツリー先頭に置き、復帰時に最速で描画されるようにする。 */}
      {isLoggedIn && isLocked && <AppLockOverlay />}
      {/* SPEC-LF1-STORE-LOCAL-CACHE-01: app-wide 未送信件数バナー */}
      {isLoggedIn && <UnsentBanner />}
      {isLoggedIn && (
        <div className="fixed bottom-1 right-1 z-[90] text-[8px] text-muted/20 pointer-events-none select-none">
          {buildLabel()}
        </div>
      )}
      <Suspense fallback={<PageLoader />}>
      <Routes>
      <Route path="/login" element={<Login />} />
      {/* SPEC-STAFF-INVITE-S3-TOKEN-RECEIVE-01: 招待受信画面 (ProtectedRoute外、未認証可) */}
      <Route path="/invite" element={<InvitePage />} />

      {/* ホーム = ランチャー（ロール別タイル表示） */}
      <Route path="/launcher" element={<ProtectedRoute><Launcher /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><Navigate to="/launcher" replace /></ProtectedRoute>} />
      {/* SPEC-UI-B-DECOMM-LEGACY-PATROL-01: 旧 /input (MainInput) 削除 → Navigate catch */}
      <Route path="/input" element={<Navigate to="/clawsupport" replace />} />
      {/* J-COLLECTION-01: 集金 / J-COLLECTION-12 R1: admin/manager のみ。
          staff/patrol で直接 URL 入力時は ManagerRoute (RoleRoute) が '/' へ redirect → /launcher。 */}
      <Route path="/collection/input" element={<ManagerRoute><CollectionInputPage /></ManagerRoute>} />
      <Route path="/collection/history" element={<ManagerRoute><CollectionHistoryPage /></ManagerRoute>} />
      <Route path="/collection/reconciliation" element={<ManagerRoute><CashReconcilePage /></ManagerRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardTop /></ProtectedRoute>} />
      {/* J-NAV-ORPHAN-CLEANUP-01 2026-05-30: /dashboard/legacy ルート削除 (動線無し) */}
      {/* J-ADMIN-02: AdminLayout nested routes (新 IA ナビ骨組) */}
      <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="masters" replace />} />
        <Route path="masters" element={<AdminMastersHubPage />} />
        <Route path="masters/store-list" element={<AdminStoreListPage />} />
        <Route path="masters/stores" element={<AdminStorePage />} />
        <Route path="masters/prizes" element={<AdminPrizeMasterPage />} />
        <Route path="masters/staff" element={<AdminStaffListPage />} />
        <Route path="masters/suppliers" element={<AdminSupplierPage />} />
        <Route path="masters/*" element={<AdminPlaceholderPage />} />
        <Route path="audit" element={<AdminAuditHubPage />} />
        <Route path="audit/orders" element={<AdminOrderHistoryPage />} />
        <Route path="audit/booth-edit" element={<AdminMachineListPage />} />
        <Route path="audit/booth-edit/:storeCode/machines" element={<AdminMachineListPage />} />
        <Route path="audit/booth-edit/:boothCode" element={<AdminBoothEditPage />} />
        <Route path="audit/operations"  element={<AdminOperationLogsPage />} />
        <Route path="audit/logins"      element={<AdminLoginLogsPage />} />
        <Route path="audit/prize-phases" element={<AdminPrizePhaseHistoryPage />} />
        <Route path="audit/stock-moves" element={<AdminStockMovementsPage />} />
        <Route path="audit/bulk-import" element={<AdminBulkImportPage />} />
        <Route path="audit/*" element={<AdminPlaceholderPage />} />
        <Route path="reports" element={<AdminReportsHubPage />} />
        {/* J-REPORTS-ANALYTICS-01 2026-05-30: 7 売上分析画面 */}
        <Route path="reports/booth-ranking"    element={<BoothRankingPage />} />
        <Route path="reports/payout-trend"     element={<PayoutTrendPage />} />
        <Route path="reports/7dma"             element={<SevenDmaPage />} />
        <Route path="reports/prize-cost"       element={<PrizeCostPage />} />
        <Route path="reports/store-comparison" element={<StoreComparisonPage />} />
        <Route path="reports/profit-calendar"  element={<ProfitCalendarPage />} />
        <Route path="reports/collections"       element={<CollectionExportPage />} />
        <Route path="reports/*" element={<AdminPlaceholderPage />} />
        <Route path="settings" element={<AdminSettingsHubPage />} />
        <Route path="settings/*" element={<AdminPlaceholderPage />} />
        <Route path="import" element={<AdminImportHubPage />} />
        <Route path="collection" element={<AdminCollectionHubPage />} />
        <Route path="collection-flag" element={<AdminCollectionFlagPage />} />
        <Route path="labels" element={<AdminQRLabelPage />} />
        <Route path="*" element={<AdminPlaceholderPage />} />
      </Route>

      {/* J-ADMIN-01 backward-compat flat routes (regression keep) */}
      <Route path="/admin/booth-edit/:boothCode" element={<ProtectedRoute><div className="h-svh"><AdminBoothEditPage /></div></ProtectedRoute>} />

      {/* SPEC-UI-B-DECOMM-LEGACY-PATROL-01: 旧巡回フロー削除。ブックマーク/PWA残存URLが404に
          ならないよう Navigate catch に置換 (canonical /clawsupport へ)。 */}
      <Route path="/booth/:machineId" element={<Navigate to="/clawsupport" replace />} />
      <Route path="/drafts" element={<Navigate to="/clawsupport" replace />} />
      <Route path="/complete" element={<Navigate to="/clawsupport" replace />} />
      <Route path="/ranking/:storeId" element={<ProtectedRoute><RankingView /></ProtectedRoute>} />
      <Route path="/machines/:storeId" element={<Navigate to="/clawsupport" replace />} />

      {/* J-PATROL-ALERTS-HUB-01 */}
      <Route path="/clawsupport/alerts" element={<ProtectedRoute><AlertListPage /></ProtectedRoute>} />
      <Route path="/admin/alert-types"  element={<AdminRoute><AdminAlertTypesPage /></AdminRoute>} />

      {/* J-CHANGER-01: 両替機専用入力画面 (ブース層スキップ、machine_code 直結) */}
      <Route path="/clawsupport/changer/:machineCode" element={<ProtectedRoute><ChangerInputPage /></ProtectedRoute>} />

      {/* クレサポ v1.0 — 全ロール */}
      <Route path="/clawsupport" element={<ProtectedRoute><ClawsupportHub /></ProtectedRoute>} />
      {/* M1 Stage 3: 店舗ハブ */}
      <Route path="/clawsupport/store/:storeCode" element={<ProtectedRoute><PatrolStorePage /></ProtectedRoute>} />
      {/* DIAG-SWIPE-BLACKSCREEN-01 fix A: key={boothCode} で boothCode 変更時にコンポーネントを
          強制 remount し、ANIM-01 の swipeDx state (commit swipe 後 -innerWidth 残存) を初期化。
          これにより useState 初期化 + useEffect[] が再実行され、入場アニメ + 黒画面解消。
          useSwipeNav.js / swipeTransition.js / animation logic は不変。 */}
      <Route path="/clawsupport/booth/:boothCode"  element={<ProtectedRoute><PatrolBoothInputPageKeyed /></ProtectedRoute>} />
      {/* 旧ルート（緊急避難 + 後方互換） */}
      <Route path="/clawsupport/store/:storeCode/dash" element={<ProtectedRoute><ClawsupportStoreDash /></ProtectedRoute>} />
      <Route path="/clawsupport/store/:storeCode/patrol" element={<ProtectedRoute><PatrolScreenV1 /></ProtectedRoute>} />

      {/* SPEC-UI-B-DECOMM-LEGACY-PATROL-01: 旧巡回 /patrol クラスタ削除 → Navigate catch。
          OCR ツール (/patrol/camera, /patrol/batch-ocr) は legacy ではないので残す。 */}
      <Route path="/patrol/overview" element={<Navigate to="/clawsupport" replace />} />
      <Route path="/patrol" element={<Navigate to="/clawsupport" replace />} />
      <Route path="/patrol/input" element={<Navigate to="/clawsupport" replace />} />
      <Route path="/patrol/booth" element={<Navigate to="/clawsupport" replace />} />

      {/* 監査ログ — manager以上 (旧ルート、/admin/audit は AdminLayout 配下に移行) */}
      {/* J-DEV-ASSET-HANDOFF-01: ファイル受け渡し (admin/manager 両方アクセス可、AdminLayout 外、ManagerRoute で staff/patrol ブロック) */}
      <Route path="/admin/dev-assets" element={<ManagerRoute><AdminDevAssetsListPage /></ManagerRoute>} />
      <Route path="/admin/dev-assets/upload" element={<ManagerRoute><AdminDevAssetsUploadPage /></ManagerRoute>} />
      {/* J-NAV-ORPHAN-CLEANUP-01 2026-05-30: /admin/audit-summary ルート削除 (動線無し orphan) */}

      {/* データ検索・修正 — manager以上 */}
      <Route path="/datasearch" element={<ManagerRoute><DataSearch /></ManagerRoute>} />
      <Route path="/edit/:boothId" element={<ManagerRoute><EditReading /></ManagerRoute>} />

      {/* J-NAV-ORPHAN-CLEANUP-01 2026-05-30: /admin/qr-print ルート削除 (動線無し)、
          /admin/labels (AdminQRLabelPage) が現役 QR ラベル機能 */}

      {/* 用語マスタ管理 — admin のみ */}
      <Route path="/admin/glossary" element={<AdminRoute><AdminGlossary /></AdminRoute>} />

      {/* タナサポ — manager以上 */}
      <Route path="/tanasupport" element={<ManagerRoute><TanasupportHub /></ManagerRoute>} />
      <Route path="/tanasupport/orders" element={<ManagerRoute><OrderList /></ManagerRoute>} />
      <Route path="/tanasupport/store/:storeCode" element={<ManagerRoute><StoreDashboard /></ManagerRoute>} />
      {/* M2 Stage 1: 倉庫ロケーション棚卸し */}
      <Route path="/tanasupport/location/:locationId/stocktake" element={<ManagerRoute><StocktakeInput /></ManagerRoute>} />
      {/* M2 Stage 2: セッション詳細 (機械・個人・合計) */}
      <Route path="/tanasupport/stocktake" element={<ManagerRoute><StocktakeSessionPage /></ManagerRoute>} />
      {/* 旧 store/stocktake ルートはハブへリダイレクト (M2 Stage 1 で session 粒度変更) */}
      <Route path="/tanasupport/store/:storeCode/stocktake" element={<Navigate to="/tanasupport" replace />} />
      <Route path="/tanasupport/store/:storeCode/stocktake/:sessionId" element={<Navigate to="/tanasupport" replace />} />

      {/* 棚卸し管理 — admin のみ */}
      <Route path="/admin/stocktake" element={<AdminRoute><StocktakeSessionListAdmin /></AdminRoute>} />
      <Route path="/admin/stocktake/create" element={<AdminRoute><StocktakeSessionCreate /></AdminRoute>} />
      <Route path="/admin/stocktake/dashboard" element={<AdminRoute><StocktakeDashboard /></AdminRoute>} />
      <Route path="/admin/stocktake/:sessionId" element={<AdminRoute><StocktakeSessionDetail /></AdminRoute>} />

      {/* ヘルプ — 全認証ユーザー */}
      <Route path="/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />

      {/* マスタ管理 — admin のみ */}
      <Route path="/admin/lockers" element={<AdminRoute><LockerList /></AdminRoute>} />
      <Route path="/admin/forecast" element={<AdminRoute><ForecastList /></AdminRoute>} />
      <Route path="/admin/forecast/:storeCode" element={<AdminRoute><ForecastDetail /></AdminRoute>} />
      <Route path="/admin/models" element={<AdminRoute><AdminModelList /></AdminRoute>} />
      <Route path="/admin/machine-models" element={<AdminRoute><AdminMachineLayoutPage /></AdminRoute>} />
      <Route path="/admin/machines" element={<AdminRoute><AdminMachineList /></AdminRoute>} />
      <Route path="/admin/booths" element={<AdminRoute><AdminBoothList /></AdminRoute>} />
      {/* マニュアル — admin管理 + 全ロール閲覧 */}
      <Route path="/admin/manuals" element={<AdminRoute><ManualEditor /></AdminRoute>} />
      <Route path="/manual/:modelId" element={<ProtectedRoute><ManualView /></ProtectedRoute>} />

      {/* 管理ツール — admin のみ */}
      <Route path="/admin/import-slips" element={<AdminRoute><ImportSlips /></AdminRoute>} />
      <Route path="/admin/setup-sheets" element={<AdminRoute><SetupSheets /></AdminRoute>} />
      <Route path="/admin/test-data" element={<AdminRoute><TestDataImport /></AdminRoute>} />
      {/* J-NAV-ORPHAN-CLEANUP-01 2026-05-30: /admin/daily-stats ルート削除 (動線無し orphan) */}


      {/* OCR巡回入力 — 全ロール (OCRツール、legacy巡回とは別系統で維持) */}
      <Route path="/patrol/camera"    element={<ProtectedRoute><PatrolCameraPage /></ProtectedRoute>} />
      <Route path="/patrol/batch-ocr" element={<ProtectedRoute><PatrolBatchOcrPage /></ProtectedRoute>} />
      <Route path="/ocr-test"         element={<ProtectedRoute><OCRTestPage /></ProtectedRoute>} />

      {/* J-STOCK-STORE-SELECT-01 2026-05-30 司令塔Opus spec:
          /stock に StockHubPage を載せ、staff/leader/manager/admin 全ロールアクセス可。
          旧 StocktakeLogin (PIN認証) は /stock/login へ退避 (backward-compat、必要なら復旧)。
          子ルートは ProtectedRoute (any role) に開放、staff_stores フィルタは hub 側で吸収。 */}
      {/* J-STOCK-NAVIGATION-REDESIGN-01: /stock = StocktakeTargetPage (倉庫/担当 2 タブ) に変更、
          StockHubPage (店舗選択ハブ) は履歴のため残置 (Launcher 入口は外れたため到達不能だが) */}
      <Route path="/stock" element={<ProtectedRoute><StocktakeTargetPage /></ProtectedRoute>} />
      <Route path="/stock/hub" element={<ProtectedRoute><LocationHubPage /></ProtectedRoute>} />
      <Route path="/stock/login" element={<StocktakeLogin />} />
      <Route path="/stock/top" element={<StocktakeTop />} />
      <Route path="/stock/count" element={<ManagerRoute><StockCount /></ManagerRoute>} />
      <Route path="/stock/count/:sessionId" element={<StocktakeCount />} />
      <Route path="/stock/summary/:sessionId" element={<StocktakeSummary />} />

      {/* 在庫管理: J-STOCK-STORE-SELECT-01 で role ガード開放 (ProtectedRoute = any role)、
          staff の場合は staff_stores のデータのみ表示 (RLS + hub フィルタ) */}
      <Route path="/stock/dashboard" element={<ManagerRoute><StockDashboard /></ManagerRoute>} />
      <Route path="/stock/move" element={<ManagerRoute><StockMove /></ManagerRoute>} />
      <Route path="/stock/out"     element={<ProtectedRoute><StockOutPage /></ProtectedRoute>} />
      <Route path="/stock/arrival" element={<ProtectedRoute><ArrivalCheckPage /></ProtectedRoute>} />
      {/* SPEC-STOCK-LAUNCHER-REDIRECT-02: 旧 Navigate to=/stock は Launcher 由来の /stock/stocktake
          を踏むと /stock へ戻るループ + URL バー揺れの原因。StocktakeTargetPage を直接 mount して
          /stock/stocktake と /stock で同 page を render (両 URL が同等扱い)。 */}
      <Route path="/stock/stocktake" element={<ProtectedRoute><StocktakeTargetPage /></ProtectedRoute>} />
      <Route path="/stock/stocktake/session" element={<ProtectedRoute><StocktakeSessionPage /></ProtectedRoute>} />
      <Route path="/stock/orders" element={<ProtectedRoute><OrderList /></ProtectedRoute>} />
      {/* J-STOCK-OCR-COUNT-TEST-01: 棚卸 OCR カウントテスト (temp、DB なし) */}
      <Route path="/stock/ocr-count-test" element={<ProtectedRoute><OcrCountTestPage /></ProtectedRoute>} />
      {/* SPEC-STOCK-ANNOUNCEMENTS-01: 景品案内ビューア。role_access: [admin, manager, patrol, staff] のため ProtectedRoute (login required only)。 */}
      <Route path="/stock/announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/launcher" replace />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
