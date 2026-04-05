import { Routes, Route, Navigate } from 'react-router-dom'
import { isLoggedIn } from './lib/auth/session'
import ErrorBoundary from './components/ErrorBoundary'
import RoleGuard, { AdminOnly, ManagerOnly, PatrolOnly } from './components/RoleGuard'
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

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" />
}

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
      <Route path="/" element={<PrivateRoute><WithTabs><MainInput /></WithTabs></PrivateRoute>} />
      <Route path="/dashboard" element={<PrivateRoute><WithTabs><Dashboard /></WithTabs></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute><WithTabs><ManagerOnly><AdminMenu /></ManagerOnly></WithTabs></PrivateRoute>} />

      {/* 巡回入力 — 全ロール */}
      <Route path="/booth/:machineId" element={<PrivateRoute><BoothInput /></PrivateRoute>} />
      <Route path="/drafts" element={<PrivateRoute><DraftList /></PrivateRoute>} />
      <Route path="/complete" element={<PrivateRoute><Complete /></PrivateRoute>} />
      <Route path="/ranking/:storeId" element={<PrivateRoute><RankingView /></PrivateRoute>} />
      <Route path="/machines/:storeId" element={<PrivateRoute><MachineList /></PrivateRoute>} />

      {/* 巡回QR — patrol以上 */}
      <Route path="/patrol" element={<PrivateRoute><PatrolOnly><PatrolScan /></PatrolOnly></PrivateRoute>} />
      <Route path="/patrol/input" element={<PrivateRoute><PatrolOnly><PatrolInput /></PatrolOnly></PrivateRoute>} />

      {/* データ検索・修正 — manager以上 */}
      <Route path="/datasearch" element={<PrivateRoute><ManagerOnly><DataSearch /></ManagerOnly></PrivateRoute>} />
      <Route path="/edit/:boothId" element={<PrivateRoute><ManagerOnly><EditReading /></ManagerOnly></PrivateRoute>} />

      {/* 管理ツール — admin のみ */}
      <Route path="/admin/import-slips" element={<PrivateRoute><AdminOnly><ImportSlips /></AdminOnly></PrivateRoute>} />
      <Route path="/admin/setup-sheets" element={<PrivateRoute><AdminOnly><SetupSheets /></AdminOnly></PrivateRoute>} />
      <Route path="/admin/test-data" element={<PrivateRoute><AdminOnly><TestDataImport /></AdminOnly></PrivateRoute>} />

      {/* 棚卸し — patrol以上 */}
      <Route path="/inventory" element={<PrivateRoute><PatrolOnly><InventoryDashboard /></PatrolOnly></PrivateRoute>} />
      <Route path="/inventory/receive" element={<PrivateRoute><PatrolOnly><InventoryReceive /></PatrolOnly></PrivateRoute>} />
      <Route path="/inventory/transfer" element={<PrivateRoute><PatrolOnly><InventoryTransfer /></PatrolOnly></PrivateRoute>} />
      <Route path="/inventory/count" element={<PrivateRoute><PatrolOnly><InventoryCount /></PatrolOnly></PrivateRoute>} />
      <Route path="/inventory/match" element={<PrivateRoute><ManagerOnly><InventoryMatch /></ManagerOnly></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    </ErrorBoundary>
  )
}
