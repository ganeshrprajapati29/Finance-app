import { useState, useEffect } from 'react'
import { Card, Table, Button, Badge, Alert, Row, Col, Form, Modal, InputGroup } from 'react-bootstrap'
import api from '../api/axios'
import { Phone, PhoneCall, PhoneOff, Clock, User, MessageSquare } from 'lucide-react'

export default function CallLogs(){
  const [callLogs, setCallLogs] = useState([])
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
  const [callData, setCallData] = useState({
    collectionId: '',
    loanId: '',
    userId: '',
    agentId: '',
    callType: 'OUTBOUND',
    callStatus: 'CONNECTED',
    callDuration: 0,
    contactPerson: '',
    relationship: '',
    conversationSummary: '',
    nextAction: 'FOLLOW_UP',
    nextActionDate: '',
    promiseToPay: {
      amount: '',
      date: ''
    },
    notes: ''
  })

  const loadCallLogs = async ()=>{
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.loanId) params.append('loanId', filters.loanId)
      if (filters.agentId) params.append('agentId', filters.agentId)
      params.append('page', filters.page)
      params.append('limit', filters.limit)

      const r = await api.get(`/admin/collections/call-logs?${params}`)
      setCallLogs(r.data.data.callLogs)
      setPagination(r.data.data.pagination)
    } catch (error) {
      console.error('Failed to load call logs:', error)
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
    loadCallLogs()
    loadLoans()
    loadAgents()
  }, [filters])

  const handleAddCallLog = ()=>{
    setCallData({
      collectionId: '',
      loanId: '',
      userId: '',
      agentId: '',
      callType: 'OUTBOUND',
      callStatus: 'CONNECTED',
      callDuration: 0,
      contactPerson: '',
      relationship: '',
      conversationSummary: '',
      nextAction: 'FOLLOW_UP',
      nextActionDate: '',
      promiseToPay: {
        amount: '',
        date: ''
      },
      notes: ''
    })
    setShowModal(true)
  }

  const submitCallLog = async ()=>{
    try {
      await api.post('/admin/collections/call-log', callData)
      setShowModal(false)
      await loadCallLogs()
      alert('Call log added successfully')
    } catch (error) {
      console.error('Failed to add call log:', error)
      alert('Failed to add call log')
    }
  }

  const getCallStatusIcon = (status)=>{
    switch(status) {
      case 'CONNECTED': return <PhoneCall size={16} className="text-success" />
      case 'NO_ANSWER': return <PhoneOff size={16} className="text-warning" />
      case 'BUSY': return <Phone size={16} className="text-warning" />
      case 'WRONG_NUMBER': return <PhoneOff size={16} className="text-danger" />
      case 'DISCONNECTED': return <PhoneOff size={16} className="text-secondary" />
      default: return <Phone size={16} />
    }
  }

  const getCallStatusColor = (status)=>{
    switch(status) {
      case 'CONNECTED': return 'success'
      case 'NO_ANSWER': return 'warning'
      case 'BUSY': return 'warning'
      case 'WRONG_NUMBER': return 'danger'
      case 'DISCONNECTED': return 'secondary'
      default: return 'primary'
    }
  }

  const formatDuration = (seconds)=>{
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <Phone className="me-2" />
          Call Logs
        </h2>
        <Button variant="primary" onClick={handleAddCallLog}>
          <PhoneCall className="me-2" size={16} />
          Add Call Log
        </Button>
      </div>

      <Alert variant="info" className="mb-4">
        <strong>Note:</strong> Track all collection calls made to customers.
        Maintain detailed conversation records and follow-up actions.
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
              <PhoneCall size={32} className="text-success mb-2" />
              <h4>{callLogs.filter(log => log.callStatus === 'CONNECTED').length}</h4>
              <small className="text-muted">Connected Calls</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <PhoneOff size={32} className="text-warning mb-2" />
              <h4>{callLogs.filter(log => log.callStatus !== 'CONNECTED').length}</h4>
              <small className="text-muted">Failed Calls</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Clock size={32} className="text-info mb-2" />
              <h4>{callLogs.reduce((sum, log) => sum + (log.callDuration || 0), 0)}</h4>
              <small className="text-muted">Total Talk Time (sec)</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <MessageSquare size={32} className="text-primary mb-2" />
              <h4>{callLogs.filter(log => log.promiseToPay?.amount).length}</h4>
              <small className="text-muted">PTP Created</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Call Logs Table */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Call Logs ({pagination.total} records)</h5>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : callLogs.length === 0 ? (
            <div className="text-center text-muted py-5">
              <Phone size={48} className="mb-3 opacity-50" />
              <p>No call logs found</p>
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
                    <th>Duration</th>
                    <th>Contact Person</th>
                    <th>Next Action</th>
                    <th>PTP</th>
                  </tr>
                </thead>
                <tbody>
                  {callLogs.map(log => (
                    <tr key={log._id}>
                      <td>{new Date(log.createdAt).toLocaleDateString()}</td>
                      <td>{log.loanId?.loanAccountNumber}</td>
                      <td>{log.userId?.name}</td>
                      <td>{log.agentId?.name}</td>
                      <td>
                        <Badge bg={log.callType === 'OUTBOUND' ? 'primary' : 'secondary'}>
                          {log.callType}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          {getCallStatusIcon(log.callStatus)}
                          <Badge bg={getCallStatusColor(log.callStatus)}>
                            {log.callStatus}
                          </Badge>
                        </div>
                      </td>
                      <td>{formatDuration(log.callDuration || 0)}</td>
                      <td>
                        <div>
                          <div>{log.contactPerson}</div>
                          <small className="text-muted">{log.relationship}</small>
                        </div>
                      </td>
                      <td>
                        <Badge bg="info">{log.nextAction}</Badge>
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

      {/* Add Call Log Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Add Call Log</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Loan *</Form.Label>
                  <Form.Select
                    value={callData.loanId}
                    onChange={(e) => {
                      const selectedLoan = loans.find(l => l._id === e.target.value)
                      setCallData({
                        ...callData,
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
                    value={callData.agentId}
                    onChange={(e) => setCallData({...callData, agentId: e.target.value})}
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
                  <Form.Label>Call Type *</Form.Label>
                  <Form.Select
                    value={callData.callType}
                    onChange={(e) => setCallData({...callData, callType: e.target.value})}
                  >
                    <option value="OUTBOUND">Outbound</option>
                    <option value="INBOUND">Inbound</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Call Status *</Form.Label>
                  <Form.Select
                    value={callData.callStatus}
                    onChange={(e) => setCallData({...callData, callStatus: e.target.value})}
                  >
                    <option value="CONNECTED">Connected</option>
                    <option value="NO_ANSWER">No Answer</option>
                    <option value="BUSY">Busy</option>
                    <option value="WRONG_NUMBER">Wrong Number</option>
                    <option value="DISCONNECTED">Disconnected</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Duration (seconds)</Form.Label>
                  <Form.Control
                    type="number"
                    value={callData.callDuration}
                    onChange={(e) => setCallData({...callData, callDuration: parseInt(e.target.value) || 0})}
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
                    value={callData.contactPerson}
                    onChange={(e) => setCallData({...callData, contactPerson: e.target.value})}
                    placeholder="Person who was contacted"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Relationship *</Form.Label>
                  <Form.Select
                    value={callData.relationship}
                    onChange={(e) => setCallData({...callData, relationship: e.target.value})}
                  >
                    <option value="">Select relationship</option>
                    <option value="SELF">Self</option>
                    <option value="FAMILY">Family</option>
                    <option value="FRIEND">Friend</option>
                    <option value="COLLEAGUE">Colleague</option>
                    <option value="OTHER">Other</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Conversation Summary *</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={callData.conversationSummary}
                onChange={(e) => setCallData({...callData, conversationSummary: e.target.value})}
                placeholder="Brief summary of the conversation"
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Next Action *</Form.Label>
                  <Form.Select
                    value={callData.nextAction}
                    onChange={(e) => setCallData({...callData, nextAction: e.target.value})}
                  >
                    <option value="FOLLOW_UP">Follow Up</option>
                    <option value="VISIT">Visit</option>
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
                    value={callData.nextActionDate}
                    onChange={(e) => setCallData({...callData, nextActionDate: e.target.value})}
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
                    value={callData.promiseToPay.amount}
                    onChange={(e) => setCallData({
                      ...callData,
                      promiseToPay: {...callData.promiseToPay, amount: e.target.value}
                    })}
                  />
                </Col>
                <Col md={6}>
                  <Form.Control
                    type="date"
                    placeholder="Date"
                    value={callData.promiseToPay.date}
                    onChange={(e) => setCallData({
                      ...callData,
                      promiseToPay: {...callData.promiseToPay, date: e.target.value}
                    })}
                  />
                </Col>
              </Row>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Additional Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={callData.notes}
                onChange={(e) => setCallData({...callData, notes: e.target.value})}
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
            onClick={submitCallLog}
            disabled={!callData.loanId || !callData.agentId || !callData.contactPerson || !callData.relationship || !callData.conversationSummary}
          >
            Save Call Log
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
