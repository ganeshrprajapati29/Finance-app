import { Navigate } from 'react-router-dom'

export default function AdminOrEmployeeProtectedRoute({ children }){
  const adminTokens = localStorage.getItem('kp_admin_tokens')
  const employeeTokens = localStorage.getItem('kp_employee_tokens')
  if (!adminTokens && !employeeTokens) return <Navigate to="/login" replace />
  return children
}
