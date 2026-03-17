import { Routes, Route, Navigate } from 'react-router-dom'
import { getToken } from './services/sheets'
import Login from './pages/Login'
import StoreSelect from './pages/StoreSelect'
import MachineList from './pages/MachineList'
import BoothInput from './pages/BoothInput'
import Complete from './pages/Complete'
import RankingView from './pages/RankingView'
import EditReading from './pages/EditReading'
import DraftList from './pages/DraftList'
import DataSearch from './pages/DataSearch'
import PatrolScan from './pages/PatrolScan'
import PatrolInput from './pages/PatrolInput'
import StoreForm from './pages/StoreForm'
import MachineForm from './pages/MachineForm'
import PrizeManagement from './pages/PrizeManagement'
import ImportSlips from './pages/ImportSlips'

function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><StoreSelect /></PrivateRoute>} />
      <Route path="/machines/:storeId" element={<PrivateRoute><MachineList /></PrivateRoute>} />
      <Route path="/booth/:machineId" element={<PrivateRoute><BoothInput /></PrivateRoute>} />
      <Route path="/complete" element={<PrivateRoute><Complete /></PrivateRoute>} />
      <Route path="/drafts" element={<PrivateRoute><DraftList /></PrivateRoute>} />
      <Route path="/ranking/:storeId" element={<PrivateRoute><RankingView /></PrivateRoute>} />
      <Route path="/datasearch" element={<PrivateRoute><DataSearch /></PrivateRoute>} />
      <Route path="/edit/:boothId" element={<PrivateRoute><EditReading /></PrivateRoute>} />
      <Route path="/patrol" element={<PrivateRoute><PatrolScan /></PrivateRoute>} />
      <Route path="/patrol/input" element={<PrivateRoute><PatrolInput /></PrivateRoute>} />
      <Route path="/admin/stores" element={<PrivateRoute><StoreForm /></PrivateRoute>} />
      <Route path="/admin/machines" element={<PrivateRoute><MachineForm /></PrivateRoute>} />
      <Route path="/admin/machines/:storeId" element={<PrivateRoute><MachineForm /></PrivateRoute>} />
      <Route path="/admin/prizes" element={<PrivateRoute><PrizeManagement /></PrivateRoute>} />
      <Route path="/admin/import-slips" element={<PrivateRoute><ImportSlips /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
