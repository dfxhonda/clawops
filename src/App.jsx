import { Routes, Route, Navigate } from 'react-router-dom'
import { getToken } from './services/sheets'
import ErrorBoundary from './components/ErrorBoundary'
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

// 既存ページ（管理系）
import EditReading from './pages/EditReading'
import DataSearch from './pages/DataSearch'
import PatrolScan from './pages/PatrolScan'
import PatrolInput from './pages/PatrolInput'
import StoreForm from './pages/StoreForm'
import MachineForm from './pages/MachineForm'
import PrizeManagement from './pages/PrizeManagement'
import ImportSlips from './pages/ImportSlips'
import SetupSheets from './pages/SetupSheets'
import TestDataImport from './pages/TestDataImport'

// Supabase版（認証不要・公開）
import PrizeList from './pages/sb/PrizeList'
// Supabase連携
import PrizeMasterDB from './pages/db/PrizeMasterDB'
import MachineFormDB from './pages/db/MachineFormDB'
import MachineTypeDB from './pages/db/MachineTypeDB'
import BoothFormDB from './pages/db/BoothFormDB'
import SupplierDB from './pages/db/SupplierDB'
import OwnershipTypeDB from './pages/db/OwnershipTypeDB'
import TransferTypeDB from './pages/db/TransferTypeDB'
import PatrolStatusDB from './pages/db/PatrolStatusDB'
import MachineCategoryDB from './pages/db/MachineCategoryDB'

// 棚卸しアプリ
import InventoryDashboard from './pages/inventory/InventoryDashboard'
import InventoryReceive from './pages/inventory/InventoryReceive'
import InventoryTransfer from './pages/inventory/InventoryTransfer'
import InventoryCount from './pages/inventory/InventoryCount'
import InventoryMatch from './pages/inventory/InventoryMatch'

function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" />
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

      {/* メイン3タブ */}
      <Route path="/" element={<PrivateRoute><WithTabs><MainInput /></WithTabs></PrivateRoute>} />
      <Route path="/dashboard" element={<PrivateRoute><WithTabs><Dashboard /></WithTabs></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute><WithTabs><AdminMenu /></WithTabs></PrivateRoute>} />

      {/* 巡回入力 */}
      <Route path="/booth/:machineId" element={<PrivateRoute><BoothInput /></PrivateRoute>} />
      <Route path="/drafts" element={<PrivateRoute><DraftList /></PrivateRoute>} />
      <Route path="/complete" element={<PrivateRoute><Complete /></PrivateRoute>} />
      <Route path="/ranking/:storeId" element={<PrivateRoute><RankingView /></PrivateRoute>} />
      <Route path="/machines/:storeId" element={<PrivateRoute><MachineList /></PrivateRoute>} />

      {/* サブページ（タブバー非表示） */}
      <Route path="/datasearch" element={<PrivateRoute><DataSearch /></PrivateRoute>} />
      <Route path="/edit/:boothId" element={<PrivateRoute><EditReading /></PrivateRoute>} />
      <Route path="/patrol" element={<PrivateRoute><PatrolScan /></PrivateRoute>} />
      <Route path="/patrol/input" element={<PrivateRoute><PatrolInput /></PrivateRoute>} />
      <Route path="/admin/stores" element={<PrivateRoute><StoreForm /></PrivateRoute>} />
      <Route path="/admin/machines" element={<PrivateRoute><MachineForm /></PrivateRoute>} />
      <Route path="/admin/machines/:storeId" element={<PrivateRoute><MachineForm /></PrivateRoute>} />
      <Route path="/admin/prizes" element={<PrivateRoute><PrizeManagement /></PrivateRoute>} />
      <Route path="/admin/import-slips" element={<PrivateRoute><ImportSlips /></PrivateRoute>} />
      <Route path="/admin/setup-sheets" element={<PrivateRoute><SetupSheets /></PrivateRoute>} />
      <Route path="/admin/test-data" element={<PrivateRoute><TestDataImport /></PrivateRoute>} />

      {/* Supabase DB */}
      <Route path="/db/prizes" element={<PrizeMasterDB />} />
      <Route path="/db/machines" element={<MachineFormDB />} />
      <Route path="/db/machines/:storeCode" element={<MachineFormDB />} />
      <Route path="/db/machines/:storeCode/:machineCode/booths" element={<BoothFormDB />} />
      <Route path="/db/machine-types" element={<MachineTypeDB />} />
      <Route path="/db/suppliers" element={<SupplierDB />} />
      <Route path="/db/ownership-types" element={<OwnershipTypeDB />} />
      <Route path="/db/transfer-types" element={<TransferTypeDB />} />
      <Route path="/db/patrol-statuses" element={<PatrolStatusDB />} />
      <Route path="/db/machine-categories" element={<MachineCategoryDB />} />

      {/* 棚卸しアプリ */}
      <Route path="/inventory" element={<PrivateRoute><InventoryDashboard /></PrivateRoute>} />
      <Route path="/inventory/receive" element={<PrivateRoute><InventoryReceive /></PrivateRoute>} />
      <Route path="/inventory/transfer" element={<PrivateRoute><InventoryTransfer /></PrivateRoute>} />
      <Route path="/inventory/count" element={<PrivateRoute><InventoryCount /></PrivateRoute>} />
      <Route path="/inventory/match" element={<PrivateRoute><InventoryMatch /></PrivateRoute>} />

      {/* Supabase版 公開ページ（認証不要） */}
      <Route path="/sb/prizes" element={<PrizeList />} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    </ErrorBoundary>
  )
}
