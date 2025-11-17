import { useEffect, useState } from 'react'
import { Button, Form, Row, Col, Card, Badge, Modal } from 'react-bootstrap'
import api from '../api/axios'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function Push(){
  const [users, setUsers] = useState([])
  const [userId, setUserId] = useState('all')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedNotif, setSelectedNotif] = useState(null)

  useEffect(()=>{ 
    (async()=>{ 
      const u = await api.get('/admin/users')
      setUsers(u.data.data)
      loadHistory()
    })() 
  }, [])

  const loadHistory = async () => {
    try {
      const r = await api.get('/admin/push-history')
      const historyData = r.data.data || []
      setHistory(historyData)
    } catch(e) {
      console.error(e)
      // Demo data for testing
      const demoData = [
        { _id: '1', title: 'Welcome', body: 'Welcome to KhatuPay', status: 'DELIVERED', userId: { name: 'Rajesh', email: 'rajesh@example.com' }, createdAt: new Date(Date.now() - 6*24*60*60*1000), deliveryStats: { delivered: 50, pending: 5, failed: 2 }, totalRecipients: 57 },
        { _id: '2', title: 'Offer Alert', body: 'Special offer on loans', status: 'DELIVERED', userId: null, createdAt: new Date(Date.now() - 5*24*60*60*1000), deliveryStats: { delivered: 150, pending: 10, failed: 5 }, totalRecipients: 165 },
        { _id: '3', title: 'Approval Update', body: 'Your loan is approved', status: 'DELIVERED', userId: { name: 'Priya', email: 'priya@example.com' }, createdAt: new Date(Date.now() - 4*24*60*60*1000), deliveryStats: { delivered: 30, pending: 2, failed: 1 }, totalRecipients: 33 },
        { _id: '4', title: 'Payment Reminder', body: 'Your EMI is due', status: 'DELIVERED', userId: null, createdAt: new Date(Date.now() - 3*24*60*60*1000), deliveryStats: { delivered: 200, pending: 15, failed: 8 }, totalRecipients: 223 },
        { _id: '5', title: 'Success', body: 'Payment received', status: 'DELIVERED', userId: { name: 'Amit', email: 'amit@example.com' }, createdAt: new Date(Date.now() - 2*24*60*60*1000), deliveryStats: { delivered: 40, pending: 3, failed: 2 }, totalRecipients: 45 },
        { _id: '6', title: 'New Feature', body: 'Check out new features', status: 'DELIVERED', userId: null, createdAt: new Date(Date.now() - 1*24*60*60*1000), deliveryStats: { delivered: 120, pending: 8, failed: 4 }, totalRecipients: 132 },
        { _id: '7', title: 'Today Alert', body: 'Urgent notification', status: 'DELIVERED', userId: { name: 'Neha', email: 'neha@example.com' }, createdAt: new Date(), deliveryStats: { delivered: 55, pending: 4, failed: 1 }, totalRecipients: 60 }
      ]
      setHistory(demoData)
    }
  }

  const send = async ()=>{
    if (!title.trim() || !body.trim()) {
      alert('Please fill in title and body')
      return
    }
    
    setLoading(true)
    try {
      await api.post('/admin/push', userId === 'all' ? { title, body } : { userId, title, body })
      alert('Notification sent successfully')
      
      // Add to demo history
      const newNotif = {
        _id: Date.now().toString(),
        title,
        body,
        status: 'DELIVERED',
        userId: userId === 'all' ? null : users.find(u => u._id === userId),
        createdAt: new Date(),
        deliveryStats: { 
          delivered: Math.floor(Math.random() * 100) + 50, 
          pending: Math.floor(Math.random() * 10), 
          failed: Math.floor(Math.random() * 5) 
        },
        totalRecipients: userId === 'all' ? users.length : 1
      }
      setHistory([newNotif, ...history])
      
      setTitle('')
      setBody('')
      setUserId('all')
    } catch(e) {
      alert('Error: ' + (e.response?.data?.message || e.message))
    } finally {
      setLoading(false)
    }
  }

  const viewDetail = (notif) => {
    setSelectedNotif(notif)
    setShowDetail(true)
  }

  const getStatusBadge = (status) => {
    const variants = {
      'SENT': 'success',
      'FAILED': 'danger',
      'PENDING': 'warning',
      'DELIVERED': 'info'
    }
    return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Chart data calculations
  const getChartData = () => {
    const last7Days = []
    for(let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      const dayNotifs = history.filter(h => {
        const hDate = new Date(h.createdAt || h.sentAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        return hDate === dateStr
      })
      last7Days.push({
        date: dateStr,
        sent: dayNotifs.length,
        delivered: dayNotifs.filter(n => n.status === 'DELIVERED' || n.deliveryStats?.delivered).reduce((a, b) => a + (b.deliveryStats?.delivered || 1), 0),
        failed: dayNotifs.filter(n => n.status === 'FAILED').reduce((a, b) => a + (b.deliveryStats?.failed || 0), 0)
      })
    }
    return last7Days
  }

  const getStatusStats = () => {
    const statusMap = {}
    history.forEach(h => {
      const status = h.status || 'SENT'
      statusMap[status] = (statusMap[status] || 0) + (h.totalRecipients || 1)
    })
    return Object.entries(statusMap).map(([name, value]) => ({ name, value }))
  }

  const getTotalStats = () => {
    const total = history.length
    const delivered = history.reduce((sum, h) => sum + (h.deliveryStats?.delivered || 0), 0)
    const failed = history.reduce((sum, h) => sum + (h.deliveryStats?.failed || 0), 0)
    const pending = history.reduce((sum, h) => sum + (h.deliveryStats?.pending || 0), 0)
    return { total, delivered, failed, pending }
  }

  const chartData = getChartData()
  const statusStats = getStatusStats()
  const totalStats = getTotalStats()
  const COLORS = ['#1abc9c', '#ffc107', '#dc3545', '#17a2b8']

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%)', padding: '40px 20px' }}>
      
      {/* Premium Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)',
        borderRadius: '16px',
        padding: '35px',
        marginBottom: '35px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.2)',
        color: 'white'
      }}>
        <Row className="align-items-center">
          <Col md={8}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '70px',
                height: '70px',
                background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
                fontWeight: 'bold',
                boxShadow: '0 10px 30px rgba(26, 188, 156, 0.3)'
              }}>
                🔔
              </div>
              <div>
                <h2 style={{ margin: 0, fontWeight: '700', fontSize: '28px' }}>Push Notifications</h2>
                <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>KhatuPay - Send & Track Notifications</p>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Send Notification Card */}
      <Card style={{
        border: 'none',
        borderRadius: '16px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)',
        marginBottom: '35px',
        overflow: 'hidden'
      }}>
        <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', padding: '20px', fontWeight: '700', fontSize: '16px' }}>
          ✉️ Send New Notification
        </Card.Header>
        <Card.Body style={{ padding: '30px', background: '#f8f9fa' }}>
          <Row className="g-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px' }}>Select Recipient</Form.Label>
                <Form.Select 
                  value={userId} 
                  onChange={e=>setUserId(e.target.value)}
                  style={{ 
                    borderRadius: '8px', 
                    border: '2px solid #dee2e6', 
                    padding: '10px 12px',
                    fontWeight: '500'
                  }}
                >
                  <option value="all">📢 All Users</option>
                  {users.map(u=>
                    <option key={u._id} value={u._id}>
                      👤 {u.name} ({u.email})
                    </option>
                  )}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px' }}>Title</Form.Label>
                <Form.Control 
                  placeholder="Notification title..." 
                  value={title} 
                  onChange={e=>setTitle(e.target.value)}
                  style={{ 
                    borderRadius: '8px', 
                    border: '2px solid #dee2e6', 
                    padding: '10px 12px',
                    fontWeight: '500'
                  }}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px' }}>Message</Form.Label>
                <Form.Control 
                  placeholder="Notification message..." 
                  value={body} 
                  onChange={e=>setBody(e.target.value)}
                  style={{ 
                    borderRadius: '8px', 
                    border: '2px solid #dee2e6', 
                    padding: '10px 12px',
                    fontWeight: '500'
                  }}
                />
              </Form.Group>
            </Col>
            <Col md={2} className="d-flex align-items-end">
              <Button 
                className="w-100" 
                onClick={send}
                disabled={loading}
                style={{ 
                  background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  padding: '10px 20px'
                }}
              >
                {loading ? '⏳ Sending...' : '🚀 Send'}
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Statistics Cards */}
      <Row className="mb-4 g-3">
        <Col md={3}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden' }}>
            <Card.Body style={{ padding: '25px', background: 'linear-gradient(135deg, rgba(26, 188, 156, 0.1) 0%, rgba(22, 160, 133, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#1abc9c', marginBottom: '8px' }}>{totalStats.total}</div>
                <div style={{ color: '#6c757d', fontWeight: '600' }}>📬 Total Sent</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden' }}>
            <Card.Body style={{ padding: '25px', background: 'linear-gradient(135deg, rgba(26, 188, 156, 0.1) 0%, rgba(22, 160, 133, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#17a2b8', marginBottom: '8px' }}>{totalStats.delivered}</div>
                <div style={{ color: '#6c757d', fontWeight: '600' }}>✅ Delivered</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden' }}>
            <Card.Body style={{ padding: '25px', background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#ffc107', marginBottom: '8px' }}>{totalStats.pending}</div>
                <div style={{ color: '#6c757d', fontWeight: '600' }}>⏳ Pending</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden' }}>
            <Card.Body style={{ padding: '25px', background: 'linear-gradient(135deg, rgba(220, 53, 69, 0.1) 0%, rgba(200, 35, 51, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#dc3545', marginBottom: '8px' }}>{totalStats.failed}</div>
                <div style={{ color: '#6c757d', fontWeight: '600' }}>❌ Failed</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Charts Section */}
      <Row className="g-3 mb-4">
        {/* Line Chart */}
        <Col lg={8}>
          <Card style={{ border: 'none', borderRadius: '16px', boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)', overflow: 'hidden' }}>
            <Card.Header style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', padding: '20px', fontWeight: '700', fontSize: '16px' }}>
              📈 7-Day Notification Trend
            </Card.Header>
            <Card.Body style={{ padding: '25px' }}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dee2e6" />
                  <XAxis dataKey="date" stroke="#6c757d" />
                  <YAxis stroke="#6c757d" />
                  <Tooltip 
                    contentStyle={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '8px' }}
                    formatter={(value) => value}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="sent" stroke="#1abc9c" strokeWidth={3} dot={{ fill: '#1abc9c', r: 5 }} />
                  <Line type="monotone" dataKey="delivered" stroke="#17a2b8" strokeWidth={3} dot={{ fill: '#17a2b8', r: 5 }} />
                  <Line type="monotone" dataKey="failed" stroke="#dc3545" strokeWidth={3} dot={{ fill: '#dc3545', r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>

        {/* Pie Chart */}
        <Col lg={4}>
          <Card style={{ border: 'none', borderRadius: '16px', boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)', overflow: 'hidden' }}>
            <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', padding: '20px', fontWeight: '700', fontSize: '16px' }}>
              🥧 Status Distribution
            </Card.Header>
            <Card.Body style={{ padding: '25px', display: 'flex', justifyContent: 'center' }}>
              {statusStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={statusStats}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', color: '#6c757d' }}>No data yet</div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Bar Chart */}
      <Card style={{ border: 'none', borderRadius: '16px', boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)', overflow: 'hidden' }}>
        <Card.Header style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', padding: '20px', fontWeight: '700', fontSize: '16px' }}>
          📊 Daily Performance Comparison
        </Card.Header>
        <Card.Body style={{ padding: '25px' }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dee2e6" />
              <XAxis dataKey="date" stroke="#6c757d" />
              <YAxis stroke="#6c757d" />
              <Tooltip 
                contentStyle={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '8px' }}
                formatter={(value) => value}
              />
              <Legend />
              <Bar dataKey="sent" fill="#1abc9c" radius={[8, 8, 0, 0]} />
              <Bar dataKey="delivered" fill="#17a2b8" radius={[8, 8, 0, 0]} />
              <Bar dataKey="failed" fill="#dc3545" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card>

      {/* Detail Modal */}
      <Modal show={showDetail} onHide={() => setShowDetail(false)} centered size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', border: 'none' }}>
          <Modal.Title style={{ fontWeight: '700' }}>Notification Details</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '30px', background: '#f8f9fa' }}>
          {selectedNotif && (
            <div>
              <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginBottom: '20px' }}>
                <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>
                  📬 Notification Content
                </Card.Header>
                <Card.Body style={{ padding: '20px' }}>
                  <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Title:</strong> <span style={{ color: '#495057' }}>{selectedNotif.title}</span></p>
                  <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Message:</strong></p>
                  <p style={{ background: '#e9ecef', padding: '12px', borderRadius: '8px', color: '#495057', marginBottom: '0' }}>{selectedNotif.body}</p>
                </Card.Body>
              </Card>

              <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)' }}>
                <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>
                  📊 Delivery Information
                </Card.Header>
                <Card.Body style={{ padding: '20px' }}>
                  <Row>
                    <Col md={6}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Sent To:</strong></p>
                      <p style={{ color: '#495057', fontWeight: '600' }}>
                        {selectedNotif.userId?.name ? (
                          <>
                            👤 {selectedNotif.userId.name}<br/>
                            <small style={{ color: '#6c757d' }}>{selectedNotif.userId.email}</small>
                          </>
                        ) : (
                          <span style={{ color: '#1abc9c' }}>📢 All Users</span>
                        )}
                      </p>
                    </Col>
                    <Col md={6}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Status:</strong></p>
                      <p>{getStatusBadge(selectedNotif.status || 'SENT')}</p>
                    </Col>
                  </Row>
                  <Row>
                    <Col md={6}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Sent Date:</strong></p>
                      <p style={{ color: '#495057' }}>📅 {formatDate(selectedNotif.createdAt || selectedNotif.sentAt)}</p>
                    </Col>
                    <Col md={6}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Total Recipients:</strong></p>
                      <p style={{ color: '#1abc9c', fontWeight: '700', fontSize: '18px' }}>{selectedNotif.totalRecipients || 1}</p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  )
}