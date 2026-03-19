import { Routes, Route, Navigate } from 'react-router-dom'
import { getToken } from './services/sheets'
import Login from './pages/Login'
import MainInput from './pages/MainInput'
import Dashboard from './pages/Dashboard'
import AdminMenu from './pages/AdminMenu'
import TabBar from './components/TabBar'

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
import ImportData from './pages/ImportData'

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
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* メイン3タブ */}
      <Route path="/" element={<PrivateRoute><WithTabs><MainInput /></WithTabs></PrivateRoute>} />
      <Route path="/dashboard" element={<PrivateRoute><WithTabs><Dashboard /></WithTabs></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute><WithTabs><AdminMenu /></WithTabs></PrivateRoute>} />

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
      <Route path="/admin/import-data" element={<PrivateRoute><ImportData /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
