import { useState } from 'react'
import { Button, Card, Form } from 'react-bootstrap'
import api from '../api/axios'

export default function EmployeeLogin(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const onSubmit = async (e)=>{
    e.preventDefault()
    setLoading(true); setErr('')
    try{
      const res = await api.post('/employee/auth/login', { email, password })
      const { accessToken, refreshToken, employee } = res.data.data
      localStorage.setItem('kp_employee_tokens', JSON.stringify({ accessToken, refreshToken }))
      localStorage.setItem('kp_employee', JSON.stringify(employee))
      window.location.href = '/employee/dashboard'
    }catch(e){ setErr(e.response?.data?.message || e.message) }
    finally{ setLoading(false) }
  }

  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight:'100vh' }}>
      <Card style={{ width: 380 }} className="p-3">
        <h4 className="mb-3">Employee Login</h4>
        <Form onSubmit={onSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control value={email} onChange={e=>setEmail(e.target.value)} placeholder="employee@example.com" />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
          </Form.Group>
          {err && <div className="text-danger small mb-2">{err}</div>}
          <Button type="submit" disabled={loading} className="w-100">{loading? 'Signing in...' : 'Sign In'}</Button>
        </Form>
      </Card>
    </div>
  )
}
