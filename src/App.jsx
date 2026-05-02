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

// ===== 遅延読み込み =====
// 初回ロードは Login + MainInput のみ。他は画面遷移時にロード。

// 即時ロード（初回表示に必要）
import Login from './pages/Login'
import Launcher from './pages/Launcher'

// 遅延ロード — メインタブ
const MainInput = lazy(() => import('./clawsupport/pages/MainInput'))
const Dashboard = lazy(() => import('./manesupport/pages/Dashboard'))
const DashboardTop = lazy(() => import('./dashboard/pages/DashboardTop'))
const AdminMenu = lazy(() => import('./manesupport/pages/AdminMenu'))
const AdminTop = lazy(() => import('./manesupport/pages/AdminTop'))

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
const PatrolOverview = lazy(() => import('./clawsupport/pages/PatrolOverview'))
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
const TanasupportHub = lazy(() => import('./tanasupport/pages/TanasupportHub'))
const OrderList = lazy(() => import('./tanasupport/pages/OrderList'))

// 遅延ロード — ヘルプ
const HelpPage = lazy(() => import('./pages/HelpPage'))

// 遅延ロード — OCRアプリ
const PatrolCameraPage  = lazy(() => import('./clawsupport/pages/PatrolCameraPage'))
const PatrolBatchOcrPage = lazy(() => import('./clawsupport/pages/PatrolBatchOcrPage'))

// 遅延ロード — 棚卸しアプリ（PIN認証）
const StocktakeLogin = lazy(() => import('./tanasupport/pages/StocktakeLogin'))
const StocktakeTop = lazy(() => import('./tanasupport/pages/StocktakeTop'))
const StocktakeCount = lazy(() => import('./tanasupport/pages/StocktakeCount'))
const StocktakeSummary = lazy(() => import('./tanasupport/pages/StocktakeSummary'))
const StockDashboard = lazy(() => import('./tanasupport/pages/StockDashboard'))
const StockMove = lazy(() => import('./tanasupport/pages/StockMove'))
const StockCount = lazy(() => import('./tanasupport/pages/StockCount'))


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
  const initGlossary = useGlossaryStore(s => s.init)
  const cleanupGlossary = useGlossaryStore(s => s.cleanup)

  useEffect(() => {
    initGlossary()
    return () => cleanupGlossary()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ErrorBoundary>
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
      <Route path="/" element={<ProtectedRoute><Launcher /></ProtectedRoute>} />
      <Route path="/input" element={<ProtectedRoute><MainInput /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardTop /></ProtectedRoute>} />
      <Route path="/dashboard/legacy" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminTop /></ProtectedRoute>} />
      <Route path="/admin/menu" element={<ProtectedRoute><AdminMenu /></ProtectedRoute>} />

      {/* 巡回入力 — 全ロール */}
      <Route path="/booth/:machineId" element={<ProtectedRoute><BoothInput /></ProtectedRoute>} />
      <Route path="/drafts" element={<ProtectedRoute><DraftList /></ProtectedRoute>} />
      <Route path="/complete" element={<ProtectedRoute><Complete /></ProtectedRoute>} />
      <Route path="/ranking/:storeId" element={<ProtectedRoute><RankingView /></ProtectedRoute>} />
      <Route path="/machines/:storeId" element={<ProtectedRoute><MachineList /></ProtectedRoute>} />

      {/* 巡回 — 全ロール */}
      <Route path="/patrol/overview" element={<ProtectedRoute><PatrolOverview /></ProtectedRoute>} />
      <Route path="/patrol" element={<ProtectedRoute><PatrolScan /></ProtectedRoute>} />
      <Route path="/patrol/input" element={<ProtectedRoute><PatrolPage /></ProtectedRoute>} />
      <Route path="/patrol/input-legacy" element={<ProtectedRoute><PatrolInput /></ProtectedRoute>} />
      <Route path="/patrol/booth" element={<ProtectedRoute><BoothInput /></ProtectedRoute>} />

      {/* 監査ログ — manager以上 */}
      <Route path="/admin/audit" element={<ManagerRoute><AuditLog /></ManagerRoute>} />
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

      {/* ヘルプ — 全認証ユーザー */}
      <Route path="/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />

      {/* マスタ管理 — admin のみ */}
      <Route path="/admin/lockers" element={<AdminRoute><LockerList /></AdminRoute>} />
      <Route path="/admin/models" element={<AdminRoute><AdminModelList /></AdminRoute>} />
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

      {/* 棚卸しアプリ — PIN認証（ProtectedRoute不要） */}
      <Route path="/stock" element={<StocktakeLogin />} />
      <Route path="/stock/top" element={<StocktakeTop />} />
      <Route path="/stock/count" element={<ManagerRoute><StockCount /></ManagerRoute>} />
      <Route path="/stock/count/:sessionId" element={<StocktakeCount />} />
      <Route path="/stock/summary/:sessionId" element={<StocktakeSummary />} />

      {/* 在庫管理 — manager以上 */}
      <Route path="/stock/dashboard" element={<ManagerRoute><StockDashboard /></ManagerRoute>} />
      <Route path="/stock/move" element={<ManagerRoute><StockMove /></ManagerRoute>} />

      <Route path="*" element={<Navigate to="/" />} />
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
