import { Navigate } from 'react-router-dom'

export default function EmployeeProtectedRoute({ children }){
  const tokens = localStorage.getItem('kp_employee_tokens')
  if (!tokens) return <Navigate to="/employee/login" replace />
  return children
}
