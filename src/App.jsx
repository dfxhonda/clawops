import { Routes, Route, Navigate } from 'react-router-dom'
import { getToken } from './services/sheets'
import Login from './pages/Login'
import StoreSelect from './pages/StoreSelect'
import MachineList from './pages/MachineList'
import BoothInput from './pages/BoothInput'
import Complete from './pages/Complete'
import RankingView from './pages/RankingView'
import EditReading from './pages/EditReading'

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
      <Route path="/ranking/:storeId" element={<PrivateRoute><RankingView /></PrivateRoute>} />
      <Route path="/edit/:boothId" element={<PrivateRoute><EditReading /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
