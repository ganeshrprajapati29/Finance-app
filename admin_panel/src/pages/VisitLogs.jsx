import { useState, useEffect } from 'react'
import { Card, Table, Button, Badge, Alert, Row, Col, Form, Modal, InputGroup } from 'react-bootstrap'
import api from '../api/axios'
import { MapPin, User, MessageSquare, Camera, FileText, Phone } from 'lucide-react'

export default function VisitLogs(){
  const [visitLogs, setVisitLogs] = useState([])
  const [loans, setLoans] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [filters, setFilters] = useState({
    loanId: '',
    agentId: '',
    page: 1,
    limit: 20
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })
  const [visitData, setVisitData] = useState({
    collectionId: '',
    loanId: '',
    userId: '',
    agentId: '',
    visitType: 'FIELD_VISIT',
    visitStatus: 'COMPLETED',
    contactPerson: '',
    relationship: '',
    location: '',
    visitPurpose: 'COLLECTION',
    conversationSummary: '',
    nextAction: 'FOLLOW_UP',
    nextActionDate: '',
    documentsCollected: '',
    paymentReceived: 0,
    promiseToPay: {
      amount: '',
      date: ''
    },
    photos: [],
    notes: ''
  })

  const loadVisitLogs = async ()=>{
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.loanId) params.append('loanId', filters.loanId)
      if (filters.agentId) params.append('agentId', filters.agentId)
      params.append('page', filters.page)
      params.append('limit', filters.limit)

      const r = await api.get(`/admin/collections/visit-logs?${params}`)
      setVisitLogs(r.data.data.visitLogs)
      setPagination(r.data.data.pagination)
    } catch (error) {
      console.error('Failed to load visit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadLoans = async ()=>{
    try {
      const r = await api.get('/admin/loans')
      setLoans(r.data.data.items || r.data.data || [])
    } catch (error) {
      console.error('Failed to load loans:', error)
    }
  }

  const loadAgents = async ()=>{
    try {
      const r = await api.get('/admin/agents')
      setAgents(r.data.data.agents || [])
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  useEffect(()=>{ 
    loadVisitLogs()
    loadLoans()
    loadAgents()
  }, [filters])

  const handleAddVisitLog = ()=>{
    setVisitData({
      collectionId: '',
      loanId: '',
      userId: '',
      agentId: '',
      visitType: 'FIELD_VISIT',
      visitStatus: 'COMPLETED',
      contactPerson: '',
      relationship: '',
      location: '',
      visitPurpose: 'COLLECTION',
      conversationSummary: '',
      nextAction: 'FOLLOW_UP',
      nextActionDate: '',
      documentsCollected: '',
      paymentReceived: 0,
      promiseToPay: {
        amount: '',
        date: ''
      },
      photos: [],
      notes: ''
    })
    setShowModal(true)
  }

  const submitVisitLog = async ()=>{
    try {
      await api.post('/admin/collections/visit-log', visitData)
      setShowModal(false)
      await loadVisitLogs()
      alert('Visit log added successfully')
    } catch (error) {
      console.error('Failed to add visit log:', error)
      alert('Failed to add visit log')
    }
  }

  const getVisitStatusIcon = (status)=>{
    switch(status) {
      case 'COMPLETED': return <MapPin size={16} className="text-success" />
      case 'PARTIAL': return <MapPin size={16} className="text-warning" />
      case 'FAILED': return <MapPin size={16} className="text-danger" />
      case 'RESCHEDULED': return <MapPin size={16} className="text-info" />
      default: return <MapPin size={16} />
    }
  }

  const getVisitStatusColor = (status)=>{
    switch(status) {
      case 'COMPLETED': return 'success'
      case 'PARTIAL': return 'warning'
      case 'FAILED': return 'danger'
      case 'RESCHEDULED': return 'info'
      default: return 'primary'
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <MapPin className="me-2" />
          Visit Logs
        </h2>
        <Button variant="primary" onClick={handleAddVisitLog}>
          <MapPin className="me-2" size={16} />
          Add Visit Log
        </Button>
      </div>

      <Alert variant="info" className="mb-4">
        <strong>Note:</strong> Track all field visits made by collection agents to customers.
        Maintain detailed visit records, photos, and follow-up actions.
      </Alert>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Filters</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Loan ID</Form.Label>
                <Form.Select
                  value={filters.loanId}
                  onChange={(e) => setFilters({...filters, loanId: e.target.value, page: 1})}
                >
                  <option value="">All Loans</option>
                  {loans.map(loan => (
                    <option key={loan._id} value={loan._id}>
                      {loan.loanAccountNumber} - {loan.application?.personal?.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
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
            <Col md={4}>
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
              <MapPin size={32} className="text-success mb-2" />
              <h4>{visitLogs.filter(log => log.visitStatus === 'COMPLETED').length}</h4>
              <small className="text-muted">Completed Visits</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <MapPin size={32} className="text-warning mb-2" />
              <h4>{visitLogs.filter(log => log.visitStatus === 'PARTIAL').length}</h4>
              <small className="text-muted">Partial Visits</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Camera size={32} className="text-info mb-2" />
              <h4>{visitLogs.filter(log => log.photos?.length > 0).length}</h4>
              <small className="text-muted">Visits with Photos</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <MessageSquare size={32} className="text-primary mb-2" />
              <h4>{visitLogs.filter(log => log.promiseToPay?.amount).length}</h4>
              <small className="text-muted">PTP Created</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Visit Logs Table */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Visit Logs ({pagination.total} records)</h5>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : visitLogs.length === 0 ? (
            <div className="text-center text-muted py-5">
              <MapPin size={48} className="mb-3 opacity-50" />
              <p>No visit logs found</p>
            </div>
          ) : (
            <>
              <Table striped hover responsive>
                <thead className="table-dark">
                  <tr>
                    <th>Date</th>
                    <th>Loan ID</th>
                    <th>Customer</th>
                    <th>Agent</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Location</th>
                    <th>Contact Person</th>
                    <th>Payment Received</th>
                    <th>PTP</th>
                  </tr>
                </thead>
                <tbody>
                  {visitLogs.map(log => (
                    <tr key={log._id}>
                      <td>{new Date(log.createdAt).toLocaleDateString()}</td>
                      <td>{log.loanId?.loanAccountNumber}</td>
                      <td>{log.userId?.name}</td>
                      <td>{log.agentId?.name}</td>
                      <td>
                        <Badge bg={log.visitType === 'FIELD_VISIT' ? 'primary' : 'secondary'}>
                          {log.visitType}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          {getVisitStatusIcon(log.visitStatus)}
                          <Badge bg={getVisitStatusColor(log.visitStatus)}>
                            {log.visitStatus}
                          </Badge>
                        </div>
                      </td>
                      <td>{log.location || 'N/A'}</td>
                      <td>
                        <div>
                          <div>{log.contactPerson}</div>
                          <small className="text-muted">{log.relationship}</small>
                        </div>
                      </td>
                      <td>
                        {log.paymentReceived ? (
                          <Badge bg="success">₹{log.paymentReceived.toLocaleString()}</Badge>
                        ) : (
                          <Badge bg="secondary">No Payment</Badge>
                        )}
                      </td>
                      <td>
                        {log.promiseToPay?.amount ? (
                          <div>
                            <div>₹{log.promiseToPay.amount.toLocaleString()}</div>
                            <small className="text-muted">
                              {new Date(log.promiseToPay.date).toLocaleDateString()}
                            </small>
                          </div>
                        ) : (
                          <Badge bg="secondary">No PTP</Badge>
                        )}
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

      {/* Add Visit Log Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Add Visit Log</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Loan *</Form.Label>
                  <Form.Select
                    value={visitData.loanId}
                    onChange={(e) => {
                      const selectedLoan = loans.find(l => l._id === e.target.value)
                      setVisitData({
                        ...visitData,
                        loanId: e.target.value,
                        userId: selectedLoan?.userId || '',
                        collectionId: '' // Will be set when collection is found
                      })
                    }}
                  >
                    <option value="">Select loan</option>
                    {loans.map(loan => (
                      <option key={loan._id} value={loan._id}>
                        {loan.loanAccountNumber} - {loan.application?.personal?.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Agent *</Form.Label>
                  <Form.Select
                    value={visitData.agentId}
                    onChange={(e) => setVisitData({...visitData, agentId: e.target.value})}
                  >
                    <option value="">Select agent</option>
                    {agents.map(agent => (
                      <option key={agent._id} value={agent._id}>{agent.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Visit Type *</Form.Label>
                  <Form.Select
                    value={visitData.visitType}
                    onChange={(e) => setVisitData({...visitData, visitType: e.target.value})}
                  >
                    <option value="FIELD_VISIT">Field Visit</option>
                    <option value="OFFICE_VISIT">Office Visit</option>
                    <option value="HOME_VISIT">Home Visit</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Visit Status *</Form.Label>
                  <Form.Select
                    value={visitData.visitStatus}
                    onChange={(e) => setVisitData({...visitData, visitStatus: e.target.value})}
                  >
                    <option value="COMPLETED">Completed</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="FAILED">Failed</option>
                    <option value="RESCHEDULED">Rescheduled</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Payment Received</Form.Label>
                  <Form.Control
                    type="number"
                    value={visitData.paymentReceived}
                    onChange={(e) => setVisitData({...visitData, paymentReceived: parseInt(e.target.value) || 0})}
                    placeholder="0"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Contact Person *</Form.Label>
                  <Form.Control
                    type="text"
                    value={visitData.contactPerson}
                    onChange={(e) => setVisitData({...visitData, contactPerson: e.target.value})}
                    placeholder="Person who was contacted"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Relationship *</Form.Label>
                  <Form.Select
                    value={visitData.relationship}
                    onChange={(e) => setVisitData({...visitData, relationship: e.target.value})}
                  >
                    <option value="">Select relationship</option>
                    <option value="SELF">Self</option>
                    <option value="FAMILY">Family</option>
                    <option value="FRIEND">Friend</option>
                    <option value="NEIGHBOR">Neighbor</option>
                    <option value="OTHER">Other</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Location</Form.Label>
              <Form.Control
                type="text"
                value={visitData.location}
                onChange={(e) => setVisitData({...visitData, location: e.target.value})}
                placeholder="Visit location/address"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Visit Purpose</Form.Label>
              <Form.Select
                value={visitData.visitPurpose}
                onChange={(e) => setVisitData({...visitData, visitPurpose: e.target.value})}
              >
                <option value="COLLECTION">Collection</option>
                <option value="VERIFICATION">Verification</option>
                <option value="LEGAL_NOTICE">Legal Notice</option>
                <option value="SETTLEMENT">Settlement</option>
                <option value="OTHER">Other</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Conversation Summary *</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={visitData.conversationSummary}
                onChange={(e) => setVisitData({...visitData, conversationSummary: e.target.value})}
                placeholder="Brief summary of the visit conversation"
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Next Action *</Form.Label>
                  <Form.Select
                    value={visitData.nextAction}
                    onChange={(e) => setVisitData({...visitData, nextAction: e.target.value})}
                  >
                    <option value="FOLLOW_UP">Follow Up</option>
                    <option value="VISIT_AGAIN">Visit Again</option>
                    <option value="LEGAL">Legal Action</option>
                    <option value="SETTLEMENT">Settlement</option>
                    <option value="PAYMENT_REMINDER">Payment Reminder</option>
                    <option value="NONE">None</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Next Action Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={visitData.nextActionDate}
                    onChange={(e) => setVisitData({...visitData, nextActionDate: e.target.value})}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>PTP (Promise to Pay)</Form.Label>
              <Row>
                <Col md={6}>
                  <Form.Control
                    type="number"
                    placeholder="Amount"
                    value={visitData.promiseToPay.amount}
                    onChange={(e) => setVisitData({
                      ...visitData,
                      promiseToPay: {...visitData.promiseToPay, amount: e.target.value}
                    })}
                  />
                </Col>
                <Col md={6}>
                  <Form.Control
                    type="date"
                    placeholder="Date"
                    value={visitData.promiseToPay.date}
                    onChange={(e) => setVisitData({
                      ...visitData,
                      promiseToPay: {...visitData.promiseToPay, date: e.target.value}
                    })}
                  />
                </Col>
              </Row>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Documents Collected</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={visitData.documentsCollected}
                onChange={(e) => setVisitData({...visitData, documentsCollected: e.target.value})}
                placeholder="List any documents collected during visit"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Additional Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={visitData.notes}
                onChange={(e) => setVisitData({...visitData, notes: e.target.value})}
                placeholder="Any additional notes"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submitVisitLog}
            disabled={!visitData.loanId || !visitData.agentId || !visitData.contactPerson || !visitData.relationship || !visitData.conversationSummary}
          >
            Save Visit Log
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
