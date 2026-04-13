import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './lib/auth/AuthProvider'
import { useAuth } from './hooks/useAuth'
import ProtectedRoute, { AdminRoute, ManagerRoute, PatrolRoute } from './components/ProtectedRoute'
import UpdateBanner from './components/UpdateBanner'
import { useVersionCheck } from './hooks/useVersionCheck'
import { buildLabel } from './lib/buildInfo'

// ===== 遅延読み込み =====
// 初回ロードは Login + MainInput のみ。他は画面遷移時にロード。

// 即時ロード（初回表示に必要）
import Login from './pages/Login'

// 遅延ロード — メインタブ
const MainInput = lazy(() => import('./pages/MainInput'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AdminMenu = lazy(() => import('./pages/AdminMenu'))
const AdminTop = lazy(() => import('./pages/admin/AdminTop'))

// 遅延ロード — 巡回入力
const BoothInput = lazy(() => import('./pages/BoothInput'))
const DraftList = lazy(() => import('./pages/DraftList'))
const Complete = lazy(() => import('./pages/Complete'))
const RankingView = lazy(() => import('./pages/RankingView'))
const MachineList = lazy(() => import('./pages/MachineList'))

// 遅延ロード — マスタ追加
const BoothQrPrint = lazy(() => import('./pages/BoothQrPrint'))
const AdminModelList = lazy(() => import('./pages/admin/ModelList'))
const AdminMachineList = lazy(() => import('./pages/admin/MachineList'))
const AdminBoothList = lazy(() => import('./pages/admin/BoothList'))
const ManualEditor = lazy(() => import('./pages/admin/ManualEditor'))
const ManualView = lazy(() => import('./pages/ManualView'))

// 遅延ロード — 管理系
const EditReading = lazy(() => import('./pages/EditReading'))
const DataSearch = lazy(() => import('./pages/DataSearch'))
const PatrolScan = lazy(() => import('./pages/PatrolScan'))
const PatrolInput = lazy(() => import('./pages/PatrolInput'))
const PatrolPage  = lazy(() => import('./pages/PatrolPage'))
const PatrolOverview = lazy(() => import('./pages/PatrolOverview'))
const LockerList = lazy(() => import('./pages/admin/LockerList'))
const ImportSlips = lazy(() => import('./pages/ImportSlips'))
const SetupSheets = lazy(() => import('./pages/SetupSheets'))
const TestDataImport = lazy(() => import('./pages/TestDataImport'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const AuditSummary = lazy(() => import('./pages/AuditSummary'))
const DailyStatsAdmin = lazy(() => import('./pages/DailyStatsAdmin'))


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
      <Route path="/input" element={<ProtectedRoute><MainInput /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
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
