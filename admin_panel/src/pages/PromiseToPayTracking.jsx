import { useState, useEffect } from 'react'
import { Card, Table, Button, Badge, Alert, Row, Col, Form, Modal, InputGroup } from 'react-bootstrap'
import api from '../api/axios'
import { Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'

export default function PromiseToPayTracking(){
  const [ptps, setPtps] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
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
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [selectedPtp, setSelectedPtp] = useState(null)
  const [updateData, setUpdateData] = useState({
    status: '',
    actualPaymentDate: '',
    actualPaymentAmount: '',
    notes: ''
  })

  const loadPtps = async ()=>{
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.agentId) params.append('agentId', filters.agentId)
      params.append('page', filters.page)
      params.append('limit', filters.limit)

      const r = await api.get(`/admin/collections/ptp-tracking?${params}`)
      setPtps(r.data.data.ptps)
      setPagination(r.data.data.pagination)
    } catch (error) {
      console.error('Failed to load PTPs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ 
    loadPtps()
  }, [filters])

  const handleUpdatePtp = (ptp)=>{
    setSelectedPtp(ptp)
    setUpdateData({
      status: ptp.status,
      actualPaymentDate: ptp.actualPaymentDate ? ptp.actualPaymentDate.split('T')[0] : '',
      actualPaymentAmount: ptp.actualPaymentAmount || '',
      notes: ptp.notes || ''
    })
    setShowUpdateModal(true)
  }

  const submitPtpUpdate = async ()=>{
    try {
      await api.put(`/admin/collections/ptp/${selectedPtp._id}`, updateData)
      setShowUpdateModal(false)
      await loadPtps()
      alert('PTP updated successfully')
    } catch (error) {
      console.error('Failed to update PTP:', error)
      alert('Failed to update PTP')
    }
  }

  const getStatusIcon = (status)=>{
    switch(status) {
      case 'KEPT': return <CheckCircle size={16} className="text-success" />
      case 'BROKEN': return <XCircle size={16} className="text-danger" />
      case 'EXTENDED': return <RefreshCw size={16} className="text-warning" />
      default: return <Clock size={16} className="text-primary" />
    }
  }

  const getStatusColor = (status)=>{
    switch(status) {
      case 'KEPT': return 'success'
      case 'BROKEN': return 'danger'
      case 'EXTENDED': return 'warning'
      default: return 'primary'
    }
  }

  const getDaysUntilDue = (promisedDate)=>{
    const now = new Date()
    const due = new Date(promisedDate)
    const diffTime = due - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getUrgencyColor = (daysUntilDue)=>{
    if (daysUntilDue < 0) return 'danger'
    if (daysUntilDue <= 3) return 'warning'
    return 'success'
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <Clock className="me-2" />
          Promise to Pay (PTP) Tracking
        </h2>
      </div>

      <Alert variant="info" className="mb-4">
        <strong>Note:</strong> Track all customer promises to pay. Monitor payment commitments,
        follow up on due dates, and maintain detailed records of PTP fulfillment.
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
                <Form.Label>Status</Form.Label>
                <Form.Select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value, page: 1})}
                >
                  <option value="">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="KEPT">Kept</option>
                  <option value="BROKEN">Broken</option>
                  <option value="EXTENDED">Extended</option>
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
                  {/* Agent options would be loaded dynamically */}
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
              <Clock size={32} className="text-primary mb-2" />
              <h4>{ptps.filter(ptp => ptp.status === 'PENDING').length}</h4>
              <small className="text-muted">Pending PTPs</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <CheckCircle size={32} className="text-success mb-2" />
              <h4>{ptps.filter(ptp => ptp.status === 'KEPT').length}</h4>
              <small className="text-muted">Kept PTPs</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <XCircle size={32} className="text-danger mb-2" />
              <h4>{ptps.filter(ptp => ptp.status === 'BROKEN').length}</h4>
              <small className="text-muted">Broken PTPs</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <RefreshCw size={32} className="text-warning mb-2" />
              <h4>{ptps.filter(ptp => ptp.status === 'EXTENDED').length}</h4>
              <small className="text-muted">Extended PTPs</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* PTP Table */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Promise to Pay Records ({pagination.total} records)</h5>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : ptps.length === 0 ? (
            <div className="text-center text-muted py-5">
              <Clock size={48} className="mb-3 opacity-50" />
              <p>No PTP records found</p>
            </div>
          ) : (
            <>
              <Table striped hover responsive>
                <thead className="table-dark">
                  <tr>
                    <th>Loan ID</th>
                    <th>Customer</th>
                    <th>Agent</th>
                    <th>Promised Amount</th>
                    <th>Promised Date</th>
                    <th>Days Until Due</th>
                    <th>Status</th>
                    <th>Contact Method</th>
                    <th>Follow-up Date</th>
                    <th>Actual Payment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ptps.map(ptp => {
                    const daysUntilDue = getDaysUntilDue(ptp.promisedDate)
                    const urgencyColor = getUrgencyColor(daysUntilDue)

                    return (
                      <tr key={ptp._id}>
                        <td>{ptp.loanId?.loanAccountNumber}</td>
                        <td>{ptp.userId?.name}</td>
                        <td>{ptp.agentId?.name}</td>
                        <td>₹{ptp.promisedAmount.toLocaleString()}</td>
                        <td>{new Date(ptp.promisedDate).toLocaleDateString()}</td>
                        <td>
                          <Badge bg={urgencyColor}>
                            {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} days overdue` : `${daysUntilDue} days left`}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-1">
                            {getStatusIcon(ptp.status)}
                            <Badge bg={getStatusColor(ptp.status)}>
                              {ptp.status}
                            </Badge>
                          </div>
                        </td>
                        <td>
                          <Badge bg="secondary">{ptp.contactMethod}</Badge>
                        </td>
                        <td>
                          {ptp.followUpDate ? new Date(ptp.followUpDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td>
                          {ptp.actualPaymentAmount ? (
                            <div>
                              <div>₹{ptp.actualPaymentAmount.toLocaleString()}</div>
                              <small className="text-muted">
                                {new Date(ptp.actualPaymentDate).toLocaleDateString()}
                              </small>
                            </div>
                          ) : (
                            <Badge bg="secondary">Not Paid</Badge>
                          )}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => handleUpdatePtp(ptp)}
                          >
                            Update Status
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
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

      {/* Update PTP Modal */}
      <Modal show={showUpdateModal} onHide={() => setShowUpdateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Update Promise to Pay Status</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedPtp && (
            <div className="mb-3">
              <Alert variant="info">
                <strong>Loan:</strong> {selectedPtp.loanId?.loanAccountNumber} |
                <strong>Customer:</strong> {selectedPtp.userId?.name} |
                <strong>Promised:</strong> ₹{selectedPtp.promisedAmount.toLocaleString()} by {new Date(selectedPtp.promisedDate).toLocaleDateString()}
              </Alert>
            </div>
          )}

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Status *</Form.Label>
              <Form.Select
                value={updateData.status}
                onChange={(e) => setUpdateData({...updateData, status: e.target.value})}
              >
                <option value="PENDING">Pending</option>
                <option value="KEPT">Kept</option>
                <option value="BROKEN">Broken</option>
                <option value="EXTENDED">Extended</option>
              </Form.Select>
            </Form.Group>

            {(updateData.status === 'KEPT' || updateData.status === 'EXTENDED') && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Actual Payment Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={updateData.actualPaymentDate}
                    onChange={(e) => setUpdateData({...updateData, actualPaymentDate: e.target.value})}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Actual Payment Amount</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>₹</InputGroup.Text>
                    <Form.Control
                      type="number"
                      value={updateData.actualPaymentAmount}
                      onChange={(e) => setUpdateData({...updateData, actualPaymentAmount: e.target.value})}
                      placeholder="0"
                    />
                  </InputGroup>
                </Form.Group>
              </>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={updateData.notes}
                onChange={(e) => setUpdateData({...updateData, notes: e.target.value})}
                placeholder="Additional notes about the PTP status update"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowUpdateModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submitPtpUpdate}
            disabled={!updateData.status}
          >
            Update PTP
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
