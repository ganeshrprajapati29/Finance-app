import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Badge, Alert, Row, Col, Card, Spinner } from 'react-bootstrap'
import api from '../api/axios.js'

export default function Support(){
  const [tickets, setTickets] = useState([])
  const [show, setShow] = useState(false)
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  useEffect(() => { loadTickets() }, [filter])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const url = filter === 'ALL' ? '/support' : `/support?status=${filter}`
      const r = await api.get(url)
      setTickets(r.data?.data || [])
    } catch (e) {
      console.error(e)
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  const updateTicket = async () => {
    try {
      await api.put(`/support/${selected._id}`, { status, adminNotes: notes })
      setShow(false)
      setMessage('✅ Ticket updated successfully!')
      setMessageType('success')
      setTimeout(() => setMessage(''), 3000)
      await loadTickets()
    } catch (e) {
      setMessage('❌ Failed to update ticket')
      setMessageType('danger')
      console.error(e)
    }
  }

  const getStatusBadge = (s) => {
    const variants = { 
      OPEN: 'danger', 
      IN_PROGRESS: 'warning', 
      RESOLVED: 'success', 
      CLOSED: 'secondary' 
    }
    const icons = {
      OPEN: '🔴',
      IN_PROGRESS: '🟡',
      RESOLVED: '✅',
      CLOSED: '⚫'
    }
    return (
      <Badge bg={variants[s] || 'secondary'} style={{ padding: '8px 12px', borderRadius: '6px', fontWeight: '600' }}>
        {icons[s]} {s.replace('_', ' ')}
      </Badge>
    )
  }

  const getPriorityBadge = (priority) => {
    const colors = {
      'HIGH': '#dc3545',
      'MEDIUM': '#ffc107',
      'LOW': '#28a745'
    }
    return (
      <Badge style={{ background: colors[priority] || '#6c757d', padding: '6px 10px', borderRadius: '4px', fontWeight: '600' }}>
        {priority || 'MEDIUM'}
      </Badge>
    )
  }

  const getTicketStats = () => {
    return {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'OPEN').length,
      inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
      resolved: tickets.filter(t => t.status === 'RESOLVED').length,
      closed: tickets.filter(t => t.status === 'CLOSED').length
    }
  }

  const stats = getTicketStats()
  const filteredTickets = filter === 'ALL' ? tickets : tickets.filter(t => t.status === filter)

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
                🎟️
              </div>
              <div>
                <h2 style={{ margin: 0, fontWeight: '700', fontSize: '28px' }}>Support Tickets</h2>
                <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>KhatuPay - Customer Support Management</p>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Alert Message */}
      {message && (
        <Alert 
          variant={messageType} 
          dismissible 
          onClose={() => setMessage('')}
          style={{
            marginBottom: '25px',
            borderRadius: '12px',
            border: 'none',
            boxShadow: '0 5px 20px rgba(0, 0, 0, 0.1)',
            fontWeight: '600'
          }}
        >
          {message}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Row className="mb-4" style={{ display: 'flex', gap: '15px' }}>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(220, 53, 69, 0.1) 0%, rgba(200, 35, 51, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#dc3545', marginBottom: '8px' }}>{stats.total}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>📋 Total</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(220, 53, 69, 0.1) 0%, rgba(200, 35, 51, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#dc3545', marginBottom: '8px' }}>{stats.open}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>🔴 Open</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#ffc107', marginBottom: '8px' }}>{stats.inProgress}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>🟡 Progress</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(32, 130, 55, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#28a745', marginBottom: '8px' }}>{stats.resolved}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>✅ Resolved</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(108, 117, 125, 0.1) 0%, rgba(80, 90, 100, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#6c757d', marginBottom: '8px' }}>{stats.closed}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>⚫ Closed</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filter and Table */}
      <Card style={{
        border: 'none',
        borderRadius: '16px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)',
        overflow: 'hidden',
        marginBottom: '30px'
      }}>
        <Card.Header style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', padding: '20px', fontWeight: '700' }}>
          <Row className="align-items-center">
            <Col md={8}>
              📋 All Support Tickets
            </Col>
            <Col md={4} className="text-end">
              <Form.Select 
                value={filter} 
                onChange={e => setFilter(e.target.value)}
                style={{ 
                  maxWidth: '200px',
                  marginLeft: 'auto',
                  background: 'rgba(255,255,255,0.95)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#001f5c',
                  fontWeight: '500',
                  padding: '8px 12px'
                }}
              >
                <option value="ALL">All Tickets</option>
                <option value="OPEN">🔴 Open</option>
                <option value="IN_PROGRESS">🟡 In Progress</option>
                <option value="RESOLVED">✅ Resolved</option>
                <option value="CLOSED">⚫ Closed</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Header>
        <Card.Body style={{ padding: '0' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <Spinner animation="border" style={{ color: '#1abc9c' }} />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: '#6c757d' }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>🎫</div>
              <p style={{ fontSize: '18px', margin: '0', fontWeight: '600' }}>No Tickets Found</p>
              <small>No support tickets match your filter criteria</small>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table striped hover responsive style={{ marginBottom: '0' }}>
                <thead style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', borderBottom: '2px solid #dee2e6' }}>
                  <tr>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Subject</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Message</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Status</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>User</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Created</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map(t => (
                    <tr key={t._id} style={{ borderBottom: '1px solid #dee2e6', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                      <td style={{ padding: '16px', fontWeight: '700', color: '#001f5c' }}>{t.subject}</td>
                      <td style={{ padding: '16px', color: '#495057', maxWidth: '250px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {t.message}
                      </td>
                      <td style={{ padding: '16px' }}>
                        {getStatusBadge(t.status)}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: '600', color: '#001f5c' }}>👤 {t.userId?.name || 'Unknown'}</div>
                        <small style={{ color: '#6c757d' }}>{t.userId?.email}</small>
                      </td>
                      <td style={{ padding: '16px', color: '#495057', fontSize: '13px' }}>
                        🕐 {new Date(t.createdAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <Button 
                          variant="primary" 
                          size="sm" 
                          onClick={() => {
                            setSelected(t)
                            setStatus(t.status)
                            setNotes(t.adminNotes || '')
                            setShow(true)
                          }}
                          style={{ borderRadius: '6px', fontWeight: '600', fontSize: '12px', background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', border: 'none' }}
                        >
                          ✏️ Update
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Update Modal */}
      <Modal show={show} onHide={() => setShow(false)} size="lg" centered>
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', border: 'none' }}>
          <Modal.Title style={{ fontWeight: '700' }}>🎟️ Update Support Ticket</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '30px', background: '#f8f9fa' }}>
          {selected && (
            <>
              <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginBottom: '20px' }}>
                <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>
                  📋 Ticket Information
                </Card.Header>
                <Card.Body style={{ padding: '20px' }}>
                  <Row className="g-3">
                    <Col md={6}>
                      <p style={{ marginBottom: '8px' }}><strong style={{ color: '#001f5c' }}>Subject:</strong></p>
                      <p style={{ color: '#495057', fontWeight: '600', fontSize: '15px' }}>{selected.subject}</p>
                    </Col>
                    <Col md={6}>
                      <p style={{ marginBottom: '8px' }}><strong style={{ color: '#001f5c' }}>Created:</strong></p>
                      <p style={{ color: '#495057', fontSize: '13px' }}>
                        🕐 {new Date(selected.createdAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </Col>
                  </Row>
                  <Row className="g-3 mt-1">
                    <Col md={6}>
                      <p style={{ marginBottom: '8px' }}><strong style={{ color: '#001f5c' }}>User Name:</strong></p>
                      <p style={{ color: '#495057', fontWeight: '600' }}>👤 {selected.userId?.name || 'Unknown'}</p>
                    </Col>
                    <Col md={6}>
                      <p style={{ marginBottom: '8px' }}><strong style={{ color: '#001f5c' }}>Email:</strong></p>
                      <p style={{ color: '#495057', fontSize: '13px' }}>📧 {selected.userId?.email || 'N/A'}</p>
                    </Col>
                  </Row>
                  <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #dee2e6' }}>
                    <p style={{ marginBottom: '8px' }}><strong style={{ color: '#001f5c' }}>Message:</strong></p>
                    <p style={{ background: '#e9ecef', padding: '12px', borderRadius: '8px', color: '#495057', marginBottom: '0', lineHeight: '1.6' }}>
                      {selected.message}
                    </p>
                  </div>
                </Card.Body>
              </Card>

              <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)' }}>
                <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>
                  ⚙️ Update Ticket
                </Card.Header>
                <Card.Body style={{ padding: '20px' }}>
                  <Form>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px' }}>Status</Form.Label>
                      <Form.Select 
                        value={status} 
                        onChange={e => setStatus(e.target.value)}
                        style={{ 
                          borderRadius: '8px', 
                          border: '2px solid #dee2e6', 
                          padding: '10px 12px',
                          fontWeight: '500'
                        }}
                      >
                        <option value="OPEN">🔴 Open</option>
                        <option value="IN_PROGRESS">🟡 In Progress</option>
                        <option value="RESOLVED">✅ Resolved</option>
                        <option value="CLOSED">⚫ Closed</option>
                      </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-0">
                      <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px' }}>Admin Notes</Form.Label>
                      <Form.Control 
                        as="textarea" 
                        rows={4} 
                        value={notes} 
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Add internal notes about this ticket..."
                        style={{ 
                          borderRadius: '8px', 
                          border: '2px solid #dee2e6', 
                          padding: '10px 12px',
                          fontWeight: '500',
                          fontFamily: 'monospace',
                          fontSize: '13px'
                        }}
                      />
                      <Form.Text style={{ color: '#6c757d', marginTop: '5px', display: 'block' }}>
                        These notes are only visible to admin staff
                      </Form.Text>
                    </Form.Group>
                  </Form>
                </Card.Body>
              </Card>
            </>
          )}
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid #dee2e6', padding: '20px', background: '#f8f9fa' }}>
          <Button 
            variant="secondary" 
            onClick={() => setShow(false)}
            style={{ borderRadius: '8px', fontWeight: '600' }}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={updateTicket}
            style={{ 
              background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700'
            }}
          >
            💾 Update Ticket
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}