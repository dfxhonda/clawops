import { Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute, { AdminRoute, ManagerRoute, PatrolRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import MainInput from './pages/MainInput'
import Dashboard from './pages/Dashboard'
import AdminMenu from './pages/AdminMenu'
import TabBar from './components/TabBar'

// 巡回入力
import BoothInput from './pages/BoothInput'
import DraftList from './pages/DraftList'
import Complete from './pages/Complete'
import RankingView from './pages/RankingView'
import MachineList from './pages/MachineList'

// 管理系
import EditReading from './pages/EditReading'
import DataSearch from './pages/DataSearch'
import PatrolScan from './pages/PatrolScan'
import PatrolInput from './pages/PatrolInput'
import ImportSlips from './pages/ImportSlips'
import SetupSheets from './pages/SetupSheets'
import TestDataImport from './pages/TestDataImport'

// 棚卸しアプリ
import InventoryDashboard from './pages/inventory/InventoryDashboard'
import InventoryReceive from './pages/inventory/InventoryReceive'
import InventoryTransfer from './pages/inventory/InventoryTransfer'
import InventoryCount from './pages/inventory/InventoryCount'
import InventoryMatch from './pages/inventory/InventoryMatch'

function WithTabs({ children }) {
  return (
    <>
      {children}
      <TabBar />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
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

      {/* データ検索・修正 — manager以上 */}
      <Route path="/datasearch" element={<ManagerRoute><DataSearch /></ManagerRoute>} />
      <Route path="/edit/:boothId" element={<ManagerRoute><EditReading /></ManagerRoute>} />

      {/* 管理ツール — admin のみ */}
      <Route path="/admin/import-slips" element={<AdminRoute><ImportSlips /></AdminRoute>} />
      <Route path="/admin/setup-sheets" element={<AdminRoute><SetupSheets /></AdminRoute>} />
      <Route path="/admin/test-data" element={<AdminRoute><TestDataImport /></AdminRoute>} />

      {/* 棚卸し — patrol以上 */}
      <Route path="/inventory" element={<PatrolRoute><InventoryDashboard /></PatrolRoute>} />
      <Route path="/inventory/receive" element={<PatrolRoute><InventoryReceive /></PatrolRoute>} />
      <Route path="/inventory/transfer" element={<PatrolRoute><InventoryTransfer /></PatrolRoute>} />
      <Route path="/inventory/count" element={<PatrolRoute><InventoryCount /></PatrolRoute>} />
      <Route path="/inventory/match" element={<ManagerRoute><InventoryMatch /></ManagerRoute>} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    </ErrorBoundary>
  )
}
