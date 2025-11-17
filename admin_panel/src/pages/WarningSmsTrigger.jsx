import { useState, useEffect } from 'react'
import { Card, Table, Button, Badge, Alert, Row, Col, Form, Modal, InputGroup } from 'react-bootstrap'
import api from '../api/axios'
import { MessageSquare, Send, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

export default function WarningSmsTrigger(){
  const [collections, setCollections] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [filters, setFilters] = useState({
    bucket: '',
    agentId: '',
    status: '',
    page: 1,
    limit: 20
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })
  const [smsData, setSmsData] = useState({
    collectionId: '',
    message: ''
  })

  const loadCollections = async ()=>{
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.bucket) params.append('bucket', filters.bucket)
      if (filters.agentId) params.append('agentId', filters.agentId)
      if (filters.status) params.append('status', filters.status)
      params.append('page', filters.page)
      params.append('limit', filters.limit)

      const r = await api.get(`/admin/collections/overdue-users?${params}`)
      setCollections(r.data.data.users)
      setPagination({
        ...pagination,
        total: r.data.data.summary.total,
        pages: Math.ceil(r.data.data.summary.total / filters.limit)
      })
    } catch (error) {
      console.error('Failed to load collections:', error)
      setError('Failed to load collections. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadAgents = async ()=>{
    try {
      const r = await api.get('/employees?role=COLLECTION_AGENT')
      setAgents(r.data.data.employees || [])
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  useEffect(()=>{ 
    loadCollections()
    loadAgents()
  }, [filters])

  const handleSendSms = (collection)=>{
    setSelectedCollection(collection)
    setSmsData({
      collectionId: collection._id,
      message: `Dear ${collection.userName}, your loan account ${collection.loanAccountNumber} has overdue payments. Please contact us immediately to avoid legal action.`
    })
    setShowModal(true)
  }

  const submitSms = async ()=>{
    try {
      await api.post('/admin/collections/warning-sms', smsData)
      setShowModal(false)
      alert('Warning SMS and Email sent successfully')
      await loadCollections()
    } catch (error) {
      console.error('Failed to send SMS:', error)
      alert('Failed to send warning SMS')
    }
  }

  const getBucketColor = (bucket)=>{
    switch(bucket) {
      case '1-7': return 'success'
      case '8-15': return 'warning'
      case '16-30': return 'warning'
      case '31-60': return 'danger'
      case '60-90': return 'danger'
      default: return 'secondary'
    }
  }

  const getStatusColor = (status)=>{
    switch(status) {
      case 'ACTIVE': return 'primary'
      case 'LEGAL': return 'danger'
      case 'SETTLED': return 'success'
      case 'CLOSED': return 'secondary'
      default: return 'secondary'
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <MessageSquare className="me-2" />
          Warning SMS Trigger
        </h2>
      </div>

      <Alert variant="warning" className="mb-4">
        <strong>Note:</strong> Send warning SMS to customers with overdue payments.
        Use this feature carefully and ensure compliance with local regulations.
      </Alert>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Filters</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Bucket</Form.Label>
                <Form.Select
                  value={filters.bucket}
                  onChange={(e) => setFilters({...filters, bucket: e.target.value, page: 1})}
                >
                  <option value="">All Buckets</option>
                  <option value="1-7">1-7 days</option>
                  <option value="8-15">8-15 days</option>
                  <option value="16-30">16-30 days</option>
                  <option value="31-60">31-60 days</option>
                  <option value="60-90">60-90 days</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Agent</Form.Label>
                <Form.Select
                  value={filters.agentId}
                  onChange={(e) => setFilters({...filters, agentId: e.target.value, page: 1})}
                >
                  <option value="">All Agents</option>
                  {agents.map(agent => (
                    <option key={agent._id} value={agent._id}>{agent.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Status</Form.Label>
                <Form.Select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value, page: 1})}
                >
                  <option value="">All Status</option>
                  <option value="UNASSIGNED">Unassigned</option>
                  <option value="ACTIVE">Active</option>
                  <option value="LEGAL">Legal</option>
                  <option value="SETTLED">Settled</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Records per page</Form.Label>
                <Form.Select
                  value={filters.limit}
                  onChange={(e) => setFilters({...filters, limit: e.target.value, page: 1})}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Summary Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <AlertTriangle size={32} className="text-danger mb-2" />
              <h4>{collections.filter(c => c.bucket === '60-90').length}</h4>
              <small className="text-muted">Critical (60-90 days)</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <AlertTriangle size={32} className="text-warning mb-2" />
              <h4>{collections.filter(c => c.bucket === '31-60').length}</h4>
              <small className="text-muted">High Risk (31-60 days)</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <CheckCircle size={32} className="text-success mb-2" />
              <h4>{collections.filter(c => c.assignedAgent).length}</h4>
              <small className="text-muted">Assigned Cases</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <XCircle size={32} className="text-secondary mb-2" />
              <h4>{collections.filter(c => !c.assignedAgent).length}</h4>
              <small className="text-muted">Unassigned Cases</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Collections Table */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Overdue Customers ({pagination.total} records)</h5>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : collections.length === 0 ? (
            <div className="text-center text-muted py-5">
              <MessageSquare size={48} className="mb-3 opacity-50" />
              <p>No overdue customers found</p>
            </div>
          ) : (
            <>
              <Table striped hover responsive>
                <thead className="table-dark">
                  <tr>
                    <th>Loan ID</th>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Bucket</th>
                    <th>Overdue Amount</th>
                    <th>Days Overdue</th>
                    <th>Agent</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map(collection => (
                    <tr key={collection.loanId}>
                      <td>{collection.loanAccountNumber}</td>
                      <td>{collection.userName}</td>
                      <td>{collection.userPhone}</td>
                      <td>
                        <Badge bg={getBucketColor(collection.bucket)}>
                          {collection.bucket} days
                        </Badge>
                      </td>
                      <td>₹{collection.overdueAmount?.toLocaleString() || 0}</td>
                      <td>{collection.daysOverdue}</td>
                      <td>
                        {collection.assignedAgent ? (
                          <Badge bg="info">{collection.assignedAgent.name}</Badge>
                        ) : (
                          <Badge bg="secondary">Unassigned</Badge>
                        )}
                      </td>
                      <td>
                        <Badge bg={getStatusColor(collection.collectionStatus)}>
                          {collection.collectionStatus}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleSendSms(collection)}
                        >
                          <Send size={14} className="me-1" />
                          Send SMS
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div>
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
                  </div>
                  <div>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => setFilters({...filters, page: pagination.page - 1})}
                    >
                      Previous
                    </Button>
                    <span className="mx-2">
                      Page {pagination.page} of {pagination.pages}
                    </span>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      disabled={pagination.page === pagination.pages}
                      onClick={() => setFilters({...filters, page: pagination.page + 1})}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Send SMS Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Send Warning SMS</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedCollection && (
            <div className="mb-3">
              <Alert variant="info">
                <strong>Customer:</strong> {selectedCollection.userName}<br />
                <strong>Loan ID:</strong> {selectedCollection.loanAccountNumber}<br />
                <strong>Phone:</strong> {selectedCollection.userPhone}<br />
                <strong>Overdue Amount:</strong> ₹{selectedCollection.overdueAmount?.toLocaleString() || 0}<br />
                <strong>Days Overdue:</strong> {selectedCollection.daysOverdue}
              </Alert>
            </div>
          )}

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>SMS Message *</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={smsData.message}
                onChange={(e) => setSmsData({...smsData, message: e.target.value})}
                placeholder="Enter warning message"
              />
              <Form.Text className="text-muted">
                Characters: {smsData.message.length} (SMS limit: 160 characters)
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submitSms}
            disabled={!smsData.message.trim() || smsData.message.length > 160}
          >
            <Send className="me-2" size={16} />
            Send SMS
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
