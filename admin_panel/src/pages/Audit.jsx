import { useEffect, useState } from 'react'
import { Table, Card, Row, Col, Badge, Spinner, Alert, Form, Pagination } from 'react-bootstrap'
import api from '../api/axios'

export default function Audit(){
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterAction, setFilterAction] = useState('ALL')
  const [filterEntity, setFilterEntity] = useState('ALL')

  useEffect(()=>{ 
    loadAuditLogs()
  }, [page, filterAction, filterEntity])

  const loadAuditLogs = async () => {
    setLoading(true)
    try {
      let url = `/admin/audit?page=${page}`
      if (filterAction !== 'ALL') url += `&action=${filterAction}`
      if (filterEntity !== 'ALL') url += `&entityType=${filterEntity}`
      
      const r = await api.get(url)
      setRows(r.data.data || [])
      setTotalPages(r.data.data?.pagination?.pages || 1)
    } catch(e) {
      console.error(e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const getActionBadge = (action) => {
    const variants = {
      'CREATE': 'success',
      'UPDATE': 'info',
      'DELETE': 'danger',
      'LOGIN': 'warning',
      'LOGOUT': 'secondary',
      'APPROVE': 'success',
      'REJECT': 'danger',
      'DISBURSE': 'info',
      'SEND': 'primary'
    }
    const icons = {
      'CREATE': '✨ Create',
      'UPDATE': '✏️ Update',
      'DELETE': '🗑️ Delete',
      'LOGIN': '🔓 Login',
      'LOGOUT': '🔒 Logout',
      'APPROVE': '✅ Approve',
      'REJECT': '❌ Reject',
      'DISBURSE': '💰 Disburse',
      'SEND': '📤 Send'
    }
    return (
      <Badge bg={variants[action] || 'secondary'} style={{ padding: '8px 12px', borderRadius: '6px', fontWeight: '600' }}>
        {icons[action] || action}
      </Badge>
    )
  }

  const getEntityBadge = (entityType) => {
    const colors = {
      'LOAN': '#1abc9c',
      'USER': '#17a2b8',
      'NOTIFICATION': '#ffc107',
      'TICKET': '#6c757d',
      'SETTINGS': '#001f5c',
      'ADMIN': '#dc3545'
    }
    const icons = {
      'LOAN': '💰',
      'USER': '👤',
      'NOTIFICATION': '📢',
      'TICKET': '🎟️',
      'SETTINGS': '⚙️',
      'ADMIN': '🔐'
    }
    return (
      <Badge style={{ background: colors[entityType] || '#6c757d', padding: '6px 10px', borderRadius: '4px', fontWeight: '600' }}>
        {icons[entityType]} {entityType}
      </Badge>
    )
  }

  const getStats = () => {
    return {
      total: rows.length,
      creates: rows.filter(r => r.action === 'CREATE').length,
      updates: rows.filter(r => r.action === 'UPDATE').length,
      deletes: rows.filter(r => r.action === 'DELETE').length
    }
  }

  const stats = getStats()
  const uniqueActions = [...new Set(rows.map(r => r.action))]
  const uniqueEntities = [...new Set(rows.map(r => r.entityType))]

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
                📜
              </div>
              <div>
                <h2 style={{ margin: 0, fontWeight: '700', fontSize: '28px' }}>Audit Logs</h2>
                <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>KhatuPay - Complete Activity History</p>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Statistics Cards */}
      <Row className="mb-4" style={{ display: 'flex', gap: '15px' }}>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(26, 188, 156, 0.1) 0%, rgba(22, 160, 133, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#1abc9c', marginBottom: '8px' }}>{stats.total}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>📋 Total Events</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(32, 130, 55, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#28a745', marginBottom: '8px' }}>{stats.creates}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>✨ Created</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(23, 162, 184, 0.1) 0%, rgba(20, 130, 155, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#17a2b8', marginBottom: '8px' }}>{stats.updates}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>✏️ Updated</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(220, 53, 69, 0.1) 0%, rgba(200, 35, 51, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#dc3545', marginBottom: '8px' }}>{stats.deletes}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>🗑️ Deleted</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filters Card */}
      <Card style={{
        border: 'none',
        borderRadius: '16px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)',
        marginBottom: '25px',
        overflow: 'hidden'
      }}>
        <Card.Header style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', padding: '20px', fontWeight: '700' }}>
          🔍 Filter Logs
        </Card.Header>
        <Card.Body style={{ padding: '20px', background: '#f8f9fa' }}>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '8px' }}>Action Type</Form.Label>
                <Form.Select 
                  value={filterAction} 
                  onChange={(e) => {
                    setFilterAction(e.target.value)
                    setPage(1)
                  }}
                  style={{ 
                    borderRadius: '8px', 
                    border: '2px solid #dee2e6', 
                    padding: '10px 12px',
                    fontWeight: '500'
                  }}
                >
                  <option value="ALL">All Actions</option>
                  {uniqueActions.map(action => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '8px' }}>Entity Type</Form.Label>
                <Form.Select 
                  value={filterEntity} 
                  onChange={(e) => {
                    setFilterEntity(e.target.value)
                    setPage(1)
                  }}
                  style={{ 
                    borderRadius: '8px', 
                    border: '2px solid #dee2e6', 
                    padding: '10px 12px',
                    fontWeight: '500'
                  }}
                >
                  <option value="ALL">All Entities</option>
                  {uniqueEntities.map(entity => (
                    <option key={entity} value={entity}>{entity}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Audit Logs Table */}
      <Card style={{
        border: 'none',
        borderRadius: '16px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)',
        overflow: 'hidden'
      }}>
        <Card.Header style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', padding: '20px', fontWeight: '700' }}>
          📜 Activity Logs
        </Card.Header>
        <Card.Body style={{ padding: '0' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <Spinner animation="border" style={{ color: '#1abc9c' }} />
            </div>
          ) : rows.length === 0 ? (
            <Alert variant="info" style={{ margin: '30px', borderRadius: '8px' }}>
              📭 No audit logs found
            </Alert>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <Table striped hover responsive style={{ marginBottom: '0' }}>
                  <thead style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', borderBottom: '2px solid #dee2e6' }}>
                    <tr>
                      <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Time</th>
                      <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Actor ID</th>
                      <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Action</th>
                      <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Entity</th>
                      <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={r._id || idx} style={{ borderBottom: '1px solid #dee2e6', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                        <td style={{ padding: '16px', color: '#495057', fontSize: '13px', fontWeight: '600' }}>
                          🕐 {new Date(r.createdAt).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <code style={{ background: '#e9ecef', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', color: '#001f5c' }}>
                            {String(r.actorId).slice(-8)}
                          </code>
                        </td>
                        <td style={{ padding: '16px' }}>
                          {getActionBadge(r.action)}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ marginBottom: '6px' }}>
                            {getEntityBadge(r.entityType)}
                          </div>
                          <code style={{ background: '#e9ecef', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', color: '#495057' }}>
                            ID: {String(r.entityId).slice(-8)}
                          </code>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <details style={{ cursor: 'pointer' }}>
                            <summary style={{ fontWeight: '600', color: '#1abc9c', userSelect: 'none' }}>
                              📋 View
                            </summary>
                            <div style={{ marginTop: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '6px', maxWidth: '300px' }}>
                              <code style={{ fontSize: '11px', color: '#495057', display: 'block', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                {JSON.stringify(r.meta, null, 2)}
                              </code>
                            </div>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ padding: '25px', background: '#f8f9fa', borderTop: '1px solid #dee2e6', display: 'flex', justifyContent: 'center' }}>
                  <Pagination style={{ margin: '0', gap: '8px' }}>
                    <Pagination.First onClick={() => setPage(1)} disabled={page === 1} />
                    <Pagination.Prev onClick={() => setPage(page - 1)} disabled={page === 1} />
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      const pageNum = page + i - 2;
                      return pageNum > 0 && pageNum <= totalPages ? (
                        <Pagination.Item
                          key={pageNum}
                          active={pageNum === page}
                          onClick={() => setPage(pageNum)}
                          style={{
                            background: pageNum === page ? 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)' : 'white',
                            color: pageNum === page ? 'white' : '#001f5c',
                            border: pageNum === page ? 'none' : '1px solid #dee2e6',
                            borderRadius: '6px',
                            fontWeight: '600'
                          }}
                        >
                          {pageNum}
                        </Pagination.Item>
                      ) : null;
                    })}
                    <Pagination.Next onClick={() => setPage(page + 1)} disabled={page === totalPages} />
                    <Pagination.Last onClick={() => setPage(totalPages)} disabled={page === totalPages} />
                  </Pagination>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  )
}