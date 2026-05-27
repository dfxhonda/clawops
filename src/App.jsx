import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
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
import UpdateBanner from './components/UpdateBanner'
import { useVersionCheck } from './hooks/useVersionCheck'
import { buildLabel } from './lib/buildInfo'
import { useIdleLogout } from './hooks/useIdleLogout'
import { IdleWarningBanner } from './shared/ui/IdleWarningBanner'

// ===== 遅延読み込み =====
// 初回ロードは Login + MainInput のみ。他は画面遷移時にロード。

// 即時ロード（初回表示に必要）
import Login from './pages/Login'
import Launcher from './pages/Launcher'

// 遅延ロード — メインタブ
const MainInput = lazy(() => import('./clawsupport/pages/MainInput'))
const Dashboard = lazy(() => import('./manesupport/pages/Dashboard'))
const DashboardTop = lazy(() => import('./dashboard/pages/DashboardTop'))
// J-ADMIN-02: Admin IA layout + hub pages (旧実装は _legacy/ に移動)
const AdminLayout           = lazy(() => import('./admin/AdminLayout'))
const AdminMastersHubPage   = lazy(() => import('./admin/pages/AdminMastersHubPage'))
const AdminAuditHubPage     = lazy(() => import('./admin/pages/AdminAuditHubPage'))
const AdminReportsHubPage   = lazy(() => import('./admin/pages/AdminReportsHubPage'))
const AdminSettingsHubPage  = lazy(() => import('./admin/pages/AdminSettingsHubPage'))
const AdminPlaceholderPage  = lazy(() => import('./admin/pages/AdminPlaceholderPage'))
const AdminQRLabelPage      = lazy(() => import('./admin/pages/AdminQRLabelPage'))
const AdminMasterMachinePage   = lazy(() => import('./admin/pages/AdminMasterMachinePage'))
const AdminMachineLayoutPage   = lazy(() => import('./admin/pages/AdminMachineLayoutPage'))
const AdminStaffListPage     = lazy(() => import('./admin/pages/AdminStaffListPage'))
const AdminSupplierPage           = lazy(() => import('./admin/pages/AdminSupplierPage'))
const AdminOperationLogsPage      = lazy(() => import('./admin/pages/AdminOperationLogsPage'))
const AdminLoginLogsPage          = lazy(() => import('./admin/pages/AdminLoginLogsPage'))
const AdminPrizePhaseHistoryPage  = lazy(() => import('./admin/pages/AdminPrizePhaseHistoryPage'))
const AdminStockMovementsPage     = lazy(() => import('./admin/pages/AdminStockMovementsPage'))
const AdminStoreListPage          = lazy(() => import('./admin/pages/AdminStoreListPage'))
const AdminBulkImportPage         = lazy(() => import('./admin/pages/AdminBulkImportPage'))

// 遅延ロード — 巡回入力
const BoothInput = lazy(() => import('./clawsupport/pages/BoothInput'))
const DraftList = lazy(() => import('./clawsupport/pages/DraftList'))
const Complete = lazy(() => import('./clawsupport/pages/Complete'))
const RankingView = lazy(() => import('./clawsupport/pages/RankingView'))
const MachineList = lazy(() => import('./clawsupport/pages/MachineList'))

// 遅延ロード — マスタ追加
const BoothQrPrint = lazy(() => import('./manesupport/pages/BoothQrPrint'))
const AdminModelList = lazy(() => import('./manesupport/pages/ModelList'))
const AdminMachineList = lazy(() => import('./manesupport/pages/MachineList'))
const AdminBoothList = lazy(() => import('./manesupport/pages/BoothList'))
const ManualEditor = lazy(() => import('./manesupport/pages/ManualEditor'))
const ManualView = lazy(() => import('./manesupport/pages/ManualView'))

// 遅延ロード — 管理系
const EditReading = lazy(() => import('./manesupport/pages/EditReading'))
const DataSearch = lazy(() => import('./manesupport/pages/DataSearch'))
const PatrolScan = lazy(() => import('./clawsupport/pages/PatrolScan'))
const PatrolInput = lazy(() => import('./clawsupport/pages/PatrolInput'))
const PatrolPage  = lazy(() => import('./clawsupport/pages/PatrolPage'))
const LockerList = lazy(() => import('./manesupport/pages/LockerList'))
const ImportSlips = lazy(() => import('./manesupport/pages/ImportSlips'))
const SetupSheets = lazy(() => import('./manesupport/pages/SetupSheets'))
const TestDataImport = lazy(() => import('./manesupport/pages/TestDataImport'))
const AuditLog = lazy(() => import('./manesupport/pages/AuditLog'))
const AuditSummary = lazy(() => import('./manesupport/pages/AuditSummary'))
const DailyStatsAdmin = lazy(() => import('./manesupport/pages/DailyStatsAdmin'))

// 遅延ロード — 用語マスタ管理
const AdminGlossary = lazy(() => import('./manesupport/pages/AdminGlossary'))

// 遅延ロード — タナサポ
const TanasupportHub       = lazy(() => import('./tanasupport/pages/TanasupportHub'))
const OrderList            = lazy(() => import('./tanasupport/pages/OrderList'))
const StoreDashboard       = lazy(() => import('./tanasupport/StoreDashboard'))
const StocktakeInput       = lazy(() => import('./tanasupport/stocktake/StocktakeInput'))
const StocktakeSessionPage = lazy(() => import('./tanasupport/stocktake/StocktakeSessionPage'))
// J-STOCKTAKE-MVP-fix-01: 倉庫/担当者の個数入力 (FF=VITE_FF_STOCKTAKE)
const StocktakeCountHub     = lazy(() => import('./tanasupport/stocktake/StocktakeCountHub'))
const StocktakeCountSession = lazy(() => import('./tanasupport/stocktake/StocktakeCountSession'))

// 遅延ロード — タナサポ 棚卸し管理 (マネサポ側)
const StocktakeSessionListAdmin = lazy(() => import('./manesupport/admin/stocktake/SessionListAdmin'))
const StocktakeSessionCreate    = lazy(() => import('./manesupport/admin/stocktake/SessionCreate'))
const StocktakeSessionDetail    = lazy(() => import('./manesupport/admin/stocktake/SessionDetail'))
const StocktakeDashboard        = lazy(() => import('./manesupport/admin/stocktake/StocktakeDashboard'))

// 遅延ロード — ヘルプ
const HelpPage = lazy(() => import('./pages/HelpPage'))

// 遅延ロード — J-ADMIN-01 管理者ブース編集
const AdminStorePage      = lazy(() => import('./admin/pages/AdminStorePage'))
const AdminMachineListPage = lazy(() => import('./admin/pages/AdminMachineListPage'))
const AdminBoothEditPage   = lazy(() => import('./admin/pages/AdminBoothEditPage'))

// 遅延ロード — J-ADMIN-05 景品マスタ + 発注履歴
const AdminPrizeMasterPage  = lazy(() => import('./admin/pages/AdminPrizeMasterPage'))
const AdminOrderHistoryPage = lazy(() => import('./admin/pages/AdminOrderHistoryPage'))

// 遅延ロード — J-PATROL-ALERTS-HUB-01
const AlertListPage       = lazy(() => import('./clawsupport/pages/AlertListPage'))
const AdminAlertTypesPage = lazy(() => import('./admin/pages/AdminAlertTypesPage'))

// 遅延ロード — クレサポ v1.0 ハブ
const ClawsupportHub        = lazy(() => import('./clawsupport/pages/ClawsupportHub'))
const ClawsupportStoreDash  = lazy(() => import('./clawsupport/pages/ClawsupportStoreDash'))
const PatrolScreenV1        = lazy(() => import('./clawsupport/pages/PatrolScreenV1'))
// M1 Stage 2: 機械リスト + ブース入力
const PatrolMachineListPage = lazy(() => import('./clawsupport/pages/PatrolMachineListPage'))
const PatrolBoothInputPage  = lazy(() => import('./clawsupport/pages/PatrolBoothInputPage'))
const PatrolBoothInputPageBeta = lazy(() => import('./clawsupport/pages/PatrolBoothInputPageBeta'))
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
// J-STOCK-TRANSFER-fix-02: 倉庫↔担当者 持ち出し/帰庫 (FF=VITE_FF_STOCK_TRANSFER)
const TransferPage = lazy(() => import('./tanasupport/stock/TransferPage'))
const StockCount   = lazy(() => import('./tanasupport/pages/StockCount'))
const StockOutPage       = lazy(() => import('./tanasupport/pages/StockOutPage'))
const ArrivalCheckPage   = lazy(() => import('./tanasupport/pages/ArrivalCheckPage'))


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

function AppInner() {
  const { isLoggedIn } = useAuth()
  const { updateAvailable, dismiss } = useVersionCheck()
  const { showWarning, reset: resetIdle } = useIdleLogout(isLoggedIn)
  const initGlossary = useGlossaryStore(s => s.init)
  const cleanupGlossary = useGlossaryStore(s => s.cleanup)

  useEffect(() => {
    initGlossary()
    return () => cleanupGlossary()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ErrorBoundary>
      {isLoggedIn && showWarning && <IdleWarningBanner onDismiss={resetIdle} />}
      {updateAvailable && isLoggedIn && <UpdateBanner onDismiss={dismiss} />}
      {isLoggedIn && (
        <div className="fixed bottom-1 right-1 z-[90] text-[8px] text-muted/20 pointer-events-none select-none">
          {buildLabel()}
        </div>
      )}
      <Suspense fallback={<PageLoader />}>
      <Routes>
      <Route path="/login" element={<Login />} />

      {/* ホーム = ランチャー（ロール別タイル表示） */}
      <Route path="/launcher" element={<ProtectedRoute><Launcher /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><Navigate to="/launcher" replace /></ProtectedRoute>} />
      <Route path="/input" element={<ProtectedRoute><MainInput /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardTop /></ProtectedRoute>} />
      <Route path="/dashboard/legacy" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      {/* J-ADMIN-02: AdminLayout nested routes (新 IA ナビ骨組) */}
      <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="masters" replace />} />
        <Route path="masters" element={<AdminMastersHubPage />} />
        <Route path="masters/store-list" element={<AdminStoreListPage />} />
        <Route path="masters/stores" element={<AdminStorePage />} />
        <Route path="masters/prizes" element={<AdminPrizeMasterPage />} />
        <Route path="masters/machines" element={<AdminMasterMachinePage />} />
        <Route path="masters/staff" element={<AdminStaffListPage />} />
        <Route path="masters/suppliers" element={<AdminSupplierPage />} />
        <Route path="masters/*" element={<AdminPlaceholderPage />} />
        <Route path="audit" element={<AdminAuditHubPage />} />
        <Route path="audit/orders" element={<AdminOrderHistoryPage />} />
        <Route path="audit/booth-edit" element={<AdminStorePage />} />
        <Route path="audit/booth-edit/:storeCode/machines" element={<AdminMachineListPage />} />
        <Route path="audit/booth-edit/:boothCode" element={<AdminBoothEditPage />} />
        <Route path="audit/operations"  element={<AdminOperationLogsPage />} />
        <Route path="audit/logins"      element={<AdminLoginLogsPage />} />
        <Route path="audit/prize-phases" element={<AdminPrizePhaseHistoryPage />} />
        <Route path="audit/stock-moves" element={<AdminStockMovementsPage />} />
        <Route path="audit/bulk-import" element={<AdminBulkImportPage />} />
        <Route path="audit/*" element={<AdminPlaceholderPage />} />
        <Route path="reports" element={<AdminReportsHubPage />} />
        <Route path="reports/*" element={<AdminPlaceholderPage />} />
        <Route path="settings" element={<AdminSettingsHubPage />} />
        <Route path="settings/*" element={<AdminPlaceholderPage />} />
        <Route path="labels" element={<AdminQRLabelPage />} />
        <Route path="*" element={<AdminPlaceholderPage />} />
      </Route>

      {/* J-ADMIN-01 backward-compat flat routes (regression keep) */}
      <Route path="/admin/store-list" element={<ProtectedRoute><AdminStorePage /></ProtectedRoute>} />
      <Route path="/admin/store/:storeCode/machines" element={<ProtectedRoute><AdminMachineListPage /></ProtectedRoute>} />
      <Route path="/admin/booth-edit/:boothCode" element={<ProtectedRoute><AdminBoothEditPage /></ProtectedRoute>} />

      {/* 巡回入力 — 全ロール */}
      <Route path="/booth/:machineId" element={<ProtectedRoute><BoothInput /></ProtectedRoute>} />
      <Route path="/drafts" element={<ProtectedRoute><DraftList /></ProtectedRoute>} />
      <Route path="/complete" element={<ProtectedRoute><Complete /></ProtectedRoute>} />
      <Route path="/ranking/:storeId" element={<ProtectedRoute><RankingView /></ProtectedRoute>} />
      <Route path="/machines/:storeId" element={<ProtectedRoute><MachineList /></ProtectedRoute>} />

      {/* J-PATROL-ALERTS-HUB-01 */}
      <Route path="/clawsupport/alerts" element={<ProtectedRoute><AlertListPage /></ProtectedRoute>} />
      <Route path="/admin/alert-types"  element={<AdminRoute><AdminAlertTypesPage /></AdminRoute>} />

      {/* クレサポ v1.0 — 全ロール */}
      <Route path="/clawsupport" element={<ProtectedRoute><ClawsupportHub /></ProtectedRoute>} />
      {/* M1 Stage 2: 機械リスト → ブース入力 */}
      <Route path="/clawsupport/store/:storeCode" element={<ProtectedRoute><PatrolStorePage /></ProtectedRoute>} />
      <Route path="/clawsupport/booth/:boothCode"  element={<ProtectedRoute><PatrolBoothInputPage /></ProtectedRoute>} />
      {/* ベータ: OCR統合版 */}
      <Route path="/clawsupport/beta/store/:storeCode" element={<ProtectedRoute><PatrolStorePage /></ProtectedRoute>} />
      <Route path="/clawsupport/beta/booth/:boothCode" element={<ProtectedRoute><PatrolBoothInputPageBeta /></ProtectedRoute>} />
      {/* 旧ルート（緊急避難 + 後方互換） */}
      <Route path="/clawsupport/store/:storeCode/dash" element={<ProtectedRoute><ClawsupportStoreDash /></ProtectedRoute>} />
      <Route path="/clawsupport/store/:storeCode/patrol" element={<ProtectedRoute><PatrolScreenV1 /></ProtectedRoute>} />

      {/* 巡回 — 全ロール */}
      <Route path="/patrol/overview" element={<Navigate to="/clawsupport" replace />} />
      <Route path="/patrol" element={<ProtectedRoute><PatrolScan /></ProtectedRoute>} />
      <Route path="/patrol/input" element={<ProtectedRoute><PatrolPage /></ProtectedRoute>} />
      <Route path="/patrol/input-legacy" element={<ProtectedRoute><PatrolInput /></ProtectedRoute>} />
      <Route path="/patrol/booth" element={<ProtectedRoute><BoothInput /></ProtectedRoute>} />

      {/* 監査ログ — manager以上 (旧ルート、/admin/audit は AdminLayout 配下に移行) */}
      <Route path="/admin/audit-summary" element={<ManagerRoute><AuditSummary /></ManagerRoute>} />

      {/* データ検索・修正 — manager以上 */}
      <Route path="/datasearch" element={<ManagerRoute><DataSearch /></ManagerRoute>} />
      <Route path="/edit/:boothId" element={<ManagerRoute><EditReading /></ManagerRoute>} />

      {/* QR印刷 — manager以上 */}
      <Route path="/admin/qr-print" element={<ManagerRoute><BoothQrPrint /></ManagerRoute>} />

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
      {/* J-STOCKTAKE-MVP-fix-01: 倉庫/担当者の個数入力 (FF=VITE_FF_STOCKTAKE, default off) */}
      {import.meta.env.VITE_FF_STOCKTAKE === 'true' && (
        <Route path="/tanasupport/stocktake/count" element={<ManagerRoute><StocktakeCountHub /></ManagerRoute>} />
      )}
      {import.meta.env.VITE_FF_STOCKTAKE === 'true' && (
        <Route path="/tanasupport/stocktake/count/:ownerType/:ownerCode" element={<ManagerRoute><StocktakeCountSession /></ManagerRoute>} />
      )}
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
      <Route path="/admin/daily-stats" element={<ManagerRoute><DailyStatsAdmin /></ManagerRoute>} />


      {/* Phase 4一時無効化中 - OcrConfirmのReferenceError調査中
          導線はPatrolOverviewで隠しているが、直URL入力で到達可能 */}
      {/* OCR巡回入力 — 全ロール */}
      <Route path="/patrol/camera"    element={<ProtectedRoute><PatrolCameraPage /></ProtectedRoute>} />
      <Route path="/patrol/batch-ocr" element={<ProtectedRoute><PatrolBatchOcrPage /></ProtectedRoute>} />
      <Route path="/ocr-test"         element={<ProtectedRoute><OCRTestPage /></ProtectedRoute>} />

      {/* 棚卸しアプリ — PIN認証（ProtectedRoute不要） */}
      <Route path="/stock" element={<StocktakeLogin />} />
      <Route path="/stock/top" element={<StocktakeTop />} />
      <Route path="/stock/count" element={<ManagerRoute><StockCount /></ManagerRoute>} />
      <Route path="/stock/count/:sessionId" element={<StocktakeCount />} />
      <Route path="/stock/summary/:sessionId" element={<StocktakeSummary />} />

      {/* 在庫管理 — manager以上 */}
      <Route path="/stock/dashboard" element={<ManagerRoute><StockDashboard /></ManagerRoute>} />
      <Route path="/stock/move" element={<ManagerRoute><StockMove /></ManagerRoute>} />
      {/* J-STOCK-TRANSFER-fix-02: 倉庫↔担当者 持ち出し/帰庫 (FF=VITE_FF_STOCK_TRANSFER, default off) */}
      {import.meta.env.VITE_FF_STOCK_TRANSFER === 'true' && (
        <Route path="/tanasupport/transfer" element={<ManagerRoute><TransferPage /></ManagerRoute>} />
      )}
      <Route path="/stock/out"     element={<ManagerRoute><StockOutPage /></ManagerRoute>} />
      <Route path="/stock/arrival" element={<ManagerRoute><ArrivalCheckPage /></ManagerRoute>} />

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
