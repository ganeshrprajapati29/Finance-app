import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import Loans from './pages/Loans.jsx'
import Payments from './pages/Payments.jsx'
import FAQs from './pages/FAQs.jsx'
import Push from './pages/Push.jsx'
import Audit from './pages/Audit.jsx'
import NotFound from './pages/NotFound.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'

export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/loans" element={<Loans />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/faqs" element={<FAQs />} />
        <Route path="/push" element={<Push />} />
        <Route path="/audit" element={<Audit />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
