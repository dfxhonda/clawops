import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './lib/auth/AuthProvider'
import { useAuth } from './hooks/useAuth'
import ProtectedRoute, { AdminRoute, ManagerRoute, PatrolRoute } from './components/ProtectedRoute'
import TabBar from './components/TabBar'
import UpdateBanner from './components/UpdateBanner'
import { useVersionCheck } from './hooks/useVersionCheck'
import { buildLabel } from './lib/buildInfo'

// ===== 遅延読み込み =====
// 初回ロードは Login + MainInput のみ。他は画面遷移時にロード。

// 即時ロード（初回表示に必要）
import MainInput from './pages/MainInput'
import Login from './pages/Login'

// 遅延ロード — メインタブ
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AdminMenu = lazy(() => import('./pages/AdminMenu'))

// 遅延ロード — 巡回入力
const BoothInput = lazy(() => import('./pages/BoothInput'))
const DraftList = lazy(() => import('./pages/DraftList'))
const Complete = lazy(() => import('./pages/Complete'))
const RankingView = lazy(() => import('./pages/RankingView'))
const MachineList = lazy(() => import('./pages/MachineList'))

// 遅延ロード — 管理系
const EditReading = lazy(() => import('./pages/EditReading'))
const DataSearch = lazy(() => import('./pages/DataSearch'))
const PatrolScan = lazy(() => import('./pages/PatrolScan'))
const PatrolInput = lazy(() => import('./pages/PatrolInput'))
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

function WithTabs({ children }) {
  return (
    <>
      {children}
      <TabBar />
    </>
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

      {/* メイン3タブ — 全ロール */}
      <Route path="/" element={<ProtectedRoute><WithTabs><MainInput /></WithTabs></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><WithTabs><Dashboard /></WithTabs></ProtectedRoute>} />
      <Route path="/admin" element={<ManagerRoute><WithTabs><AdminMenu /></WithTabs></ManagerRoute>} />

      {/* 巡回入力 — 全ロール */}
      <Route path="/booth/:machineId" element={<ProtectedRoute><BoothInput /></ProtectedRoute>} />
      <Route path="/drafts" element={<ProtectedRoute><DraftList /></ProtectedRoute>} />
      <Route path="/complete" element={<ProtectedRoute><Complete /></ProtectedRoute>} />
      <Route path="/ranking/:storeId" element={<ProtectedRoute><RankingView /></ProtectedRoute>} />
      <Route path="/machines/:storeId" element={<ProtectedRoute><MachineList /></ProtectedRoute>} />

      {/* 巡回QR — patrol以上 */}
      <Route path="/patrol" element={<PatrolRoute><PatrolScan /></PatrolRoute>} />
      <Route path="/patrol/input" element={<PatrolRoute><PatrolInput /></PatrolRoute>} />

      {/* 監査ログ — manager以上 */}
      <Route path="/admin/audit" element={<ManagerRoute><AuditLog /></ManagerRoute>} />
      <Route path="/admin/audit-summary" element={<ManagerRoute><AuditSummary /></ManagerRoute>} />

      {/* データ検索・修正 — manager以上 */}
      <Route path="/datasearch" element={<ManagerRoute><DataSearch /></ManagerRoute>} />
      <Route path="/edit/:boothId" element={<ManagerRoute><EditReading /></ManagerRoute>} />

      {/* 管理ツール — admin のみ */}
      <Route path="/admin/import-slips" element={<AdminRoute><ImportSlips /></AdminRoute>} />
      <Route path="/admin/setup-sheets" element={<AdminRoute><SetupSheets /></AdminRoute>} />
      <Route path="/admin/test-data" element={<AdminRoute><TestDataImport /></AdminRoute>} />
      <Route path="/admin/daily-stats" element={<AdminRoute><DailyStatsAdmin /></AdminRoute>} />


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
