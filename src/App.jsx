import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

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
import UpdateBanner from './components/UpdateBanner'
import { useVersionCheck } from './hooks/useVersionCheck'
import { buildLabel } from './lib/buildInfo'

// ===== 遅延読み込み =====
// 初回ロードは Login のみ。他は画面遷移時にロード。

// 即時ロード（初回表示に必要）
import Login from './pages/Login'

// 遅延ロード — メインタブ
const Dashboard = lazy(() => import('./admin/pages/Dashboard'))
const AdminMenu = lazy(() => import('./admin/pages/AdminMenu'))
const AdminTop = lazy(() => import('./admin/pages/AdminTop'))

// 遅延ロード — 巡回入力
const BoothInput = lazy(() => import('./patrol/pages/BoothInput'))
const Complete = lazy(() => import('./patrol/pages/Complete'))
const RankingView = lazy(() => import('./patrol/pages/RankingView'))
const MachineList = lazy(() => import('./patrol/pages/MachineList'))

// 遅延ロード — マスタ追加
const BoothQrPrint = lazy(() => import('./admin/pages/BoothQrPrint'))
const AdminModelList = lazy(() => import('./admin/pages/ModelList'))
const AdminMachineList = lazy(() => import('./admin/pages/MachineList'))
const AdminBoothList = lazy(() => import('./admin/pages/BoothList'))
const ManualEditor = lazy(() => import('./admin/pages/ManualEditor'))
const ManualView = lazy(() => import('./admin/pages/ManualView'))

// 遅延ロード — 管理系
const EditReading = lazy(() => import('./admin/pages/EditReading'))
const DataSearch = lazy(() => import('./admin/pages/DataSearch'))
const PatrolScan = lazy(() => import('./patrol/pages/PatrolScan'))
const PatrolPage  = lazy(() => import('./patrol/pages/PatrolPage'))
const PatrolOverview = lazy(() => import('./patrol/pages/PatrolOverview'))
const LockerList = lazy(() => import('./admin/pages/LockerList'))
const ImportSlips = lazy(() => import('./admin/pages/ImportSlips'))
const SetupSheets = lazy(() => import('./admin/pages/SetupSheets'))
const AuditLog = lazy(() => import('./admin/pages/AuditLog'))
const AuditSummary = lazy(() => import('./admin/pages/AuditSummary'))
const DailyStatsAdmin = lazy(() => import('./admin/pages/DailyStatsAdmin'))

// 遅延ロード — OCRアプリ
const PatrolCameraPage  = lazy(() => import('./patrol/pages/PatrolCameraPage'))
const PatrolBatchOcrPage = lazy(() => import('./patrol/pages/PatrolBatchOcrPage'))

// 遅延ロード — 棚卸しアプリ（PIN認証）
const StocktakeLogin = lazy(() => import('./stock/pages/StocktakeLogin'))
const StocktakeTop = lazy(() => import('./stock/pages/StocktakeTop'))
const StocktakeCount = lazy(() => import('./stock/pages/StocktakeCount'))
const StocktakeSummary = lazy(() => import('./stock/pages/StocktakeSummary'))


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

      {/* ホーム = 巡回アプリ（全ロール） */}
      <Route path="/" element={<ProtectedRoute><PatrolOverview /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminTop /></ProtectedRoute>} />
      <Route path="/admin/menu" element={<ProtectedRoute><AdminMenu /></ProtectedRoute>} />

      {/* 巡回入力 — 全ロール */}
      <Route path="/booth/:machineId" element={<ProtectedRoute><BoothInput /></ProtectedRoute>} />
      <Route path="/complete" element={<ProtectedRoute><Complete /></ProtectedRoute>} />
      <Route path="/ranking/:storeId" element={<ProtectedRoute><RankingView /></ProtectedRoute>} />
      <Route path="/machines/:storeId" element={<ProtectedRoute><MachineList /></ProtectedRoute>} />

      {/* 巡回 — 全ロール */}
      <Route path="/patrol/overview" element={<ProtectedRoute><PatrolOverview /></ProtectedRoute>} />
      <Route path="/patrol" element={<ProtectedRoute><PatrolScan /></ProtectedRoute>} />
      <Route path="/patrol/input" element={<ProtectedRoute><PatrolPage /></ProtectedRoute>} />

      {/* 監査ログ — manager以上 */}
      <Route path="/admin/audit" element={<ManagerRoute><AuditLog /></ManagerRoute>} />
      <Route path="/admin/audit-summary" element={<ManagerRoute><AuditSummary /></ManagerRoute>} />

      {/* データ検索・修正 — manager以上 */}
      <Route path="/datasearch" element={<ManagerRoute><DataSearch /></ManagerRoute>} />
      <Route path="/edit/:boothId" element={<ManagerRoute><EditReading /></ManagerRoute>} />

      {/* QR印刷 — manager以上 */}
      <Route path="/admin/qr-print" element={<ManagerRoute><BoothQrPrint /></ManagerRoute>} />

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
      <Route path="/admin/daily-stats" element={<ManagerRoute><DailyStatsAdmin /></ManagerRoute>} />


      {/* TODO: Phase 4 OCR復活時にアンコメント - OcrConfirm ReferenceError調査中
      <Route path="/patrol/camera" element={<ProtectedRoute><PatrolCameraPage /></ProtectedRoute>} />
      <Route path="/patrol/batch-ocr" element={<ProtectedRoute><PatrolBatchOcrPage /></ProtectedRoute>} />
      */}

      {/* 棚卸しアプリ — PIN認証（ProtectedRoute不要） */}
      <Route path="/stock" element={<StocktakeLogin />} />
      <Route path="/stock/top" element={<StocktakeTop />} />
      <Route path="/stock/count/:sessionId" element={<StocktakeCount />} />
      <Route path="/stock/summary/:sessionId" element={<StocktakeSummary />} />

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
