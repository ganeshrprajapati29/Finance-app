import { useState, useEffect } from 'react'
import { Card, Row, Col, Button } from 'react-bootstrap'
import api from '../api/axios'

export default function EmployeeDashboard(){
  const [employee, setEmployee] = useState(null)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLoans: 0,
    totalPayments: 0,
    pendingSupport: 0
  })

  useEffect(() => {
    const emp = JSON.parse(localStorage.getItem('kp_employee') || '{}')
    setEmployee(emp)
  }, [])

  useEffect(() => {
    if (employee) {
      fetchStats()
    }
  }, [employee])

  const fetchStats = async () => {
    try {
      const requests = []

      // Only fetch stats for permissions the employee has
      if (employee?.permissions?.canManageUsers) {
        requests.push(api.get('/employee/users').then(res => ({ type: 'users', count: res.data.length })))
      } else {
        requests.push(Promise.resolve({ type: 'users', count: 0 }))
      }

      if (employee?.permissions?.canManageLoans) {
        requests.push(api.get('/employee/loans').then(res => ({ type: 'loans', count: res.data.length })))
      } else {
        requests.push(Promise.resolve({ type: 'loans', count: 0 }))
      }

      if (employee?.permissions?.canManagePayments) {
        requests.push(api.get('/employee/payments').then(res => ({ type: 'payments', count: res.data.length })))
      } else {
        requests.push(Promise.resolve({ type: 'payments', count: 0 }))
      }

      // Support is always available for employees
      requests.push(api.get('/employee/support').then(res => ({ type: 'support', count: res.data.tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length })))

      const results = await Promise.all(requests)

      const newStats = { totalUsers: 0, totalLoans: 0, totalPayments: 0, pendingSupport: 0 }
      results.forEach(result => {
        if (result.type === 'users') newStats.totalUsers = result.count
        if (result.type === 'loans') newStats.totalLoans = result.count
        if (result.type === 'payments') newStats.totalPayments = result.count
        if (result.type === 'support') newStats.pendingSupport = result.count
      })

      setStats(newStats)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const logout = () => {
    localStorage.removeItem('kp_employee_tokens')
    localStorage.removeItem('kp_employee')
    window.location.href = '/employee/login'
  }

  if (!employee) return <div>Loading...</div>

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Employee Dashboard</h2>
        <div>
          <Button variant="outline-primary" className="me-2" onClick={() => window.location.href = '/employee-history'}>Employee History</Button>
          <Button variant="outline-danger" onClick={logout}>Logout</Button>
        </div>
      </div>

      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>{stats.totalUsers}</Card.Title>
              <Card.Text>Total Users</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>{stats.totalLoans}</Card.Title>
              <Card.Text>Total Loans</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>{stats.totalPayments}</Card.Title>
              <Card.Text>Total Payments</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>{stats.pendingSupport}</Card.Title>
              <Card.Text>Pending Support</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card>
        <Card.Header>
          <h5>Employee Information</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <p><strong>Name:</strong> {employee.name}</p>
              <p><strong>Email:</strong> {employee.email}</p>
            </Col>
            <Col md={6}>
              <p><strong>Phone:</strong> {employee.phone}</p>
              <p><strong>Status:</strong> {employee.status}</p>
            </Col>
          </Row>
          <hr />
          <h6>Permissions:</h6>
          <ul>
            {Object.entries(employee.permissions).map(([key, value]) => (
              <li key={key}>
                {key.replace('can', '').replace('Manage', ' ').trim()}: {value ? 'Yes' : 'No'}
              </li>
            ))}
          </ul>
        </Card.Body>
      </Card>
    </div>
  )
}
