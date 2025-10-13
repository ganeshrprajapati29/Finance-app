import { Navigate } from 'react-router-dom'
export default function ProtectedRoute({ children }){
  const tokens = localStorage.getItem('kp_tokens')
  if (!tokens) return <Navigate to="/login" replace />
  return children
}
