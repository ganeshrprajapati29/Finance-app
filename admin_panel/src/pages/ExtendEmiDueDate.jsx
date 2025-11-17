import { useState, useEffect } from 'react'
import { Card, Table, Button, Badge, Alert, Row, Col, Form, Modal, InputGroup } from 'react-bootstrap'
import api from '../api/axios'
import { Clock, Calendar, AlertTriangle, CheckCircle, Edit, RefreshCw } from 'lucide-react'

export default function ExtendEmiDueDate(){
  const [loans, setLoans] = useState([])
  const [extensions, setExtensions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [selectedInstallment, setSelectedInstallment] = useState(null)
  const [extensionData, setExtensionData] = useState({
    newDueDate: '',
    reason: '',
    notes: '',
    approvedBy: ''
  })

  const loadLoans = async ()=>{
    setLoading(true)
    try {
      const r = await api.get('/admin/loans?status=DISBURSED')
      setLoans(r.data.data.items || [])
    } catch (error) {
      console.error('Failed to load loans:', error)
      setLoans([])
    } finally {
      setLoading(false)
    }
  }

  const loadExtensions = async ()=>{
    try {
      const r = await api.get('/admin/emi-control/extensions')
      setExtensions(r.data.data.extensions || [])
    } catch (error) {
      console.error('Failed to load extensions:', error)
      setExtensions([])
    }
  }

  useEffect(()=>{ 
    loadLoans()
    loadExtensions()
  }, [])

  const handleExtendDueDate = (loan, installment)=>{
    setSelectedLoan(loan)
    setSelectedInstallment(installment)
    setExtensionData({
      newDueDate: '',
      reason: '',
      notes: '',
      approvedBy: 'Admin'
    })
    setShowModal(true)
  }

  const submitExtension = async ()=>{
    try {
      await api.post(`/admin/emi-control/extend-due-date/${selectedLoan._id}/${selectedInstallment.installmentNo}`, {
        newDueDate: extensionData.newDueDate,
        reason: extensionData.reason,
        notes: extensionData.notes,
        approvedBy: extensionData.approvedBy
      })
      setShowModal(false)
      await loadExtensions()
      await loadLoans()
      alert('Due date extended successfully')
    } catch (error) {
      console.error('Failed to submit extension:', error)
      alert('Failed to extend due date')
    }
  }

  const getOverdueInstallments = (loan)=>{
    return loan.schedule?.filter(inst => 
      !inst.paid && new Date(inst.dueDate) < new Date()
    ) || []
  }

  const getUpcomingInstallments = (loan)=>{
    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return loan.schedule?.filter(inst => 
      !inst.paid && 
      new Date(inst.dueDate) >= now && 
      new Date(inst.dueDate) <= nextWeek
    ) || []
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <Clock className="me-2" />
          Extend EMI / Due Date Option
        </h2>
      </div>

      <Alert variant="info" className="mb-4">
        <strong>Note:</strong> Due date extensions can be granted for customers facing genuine difficulties.
        This helps maintain customer relationships while ensuring eventual payment collection.
      </Alert>

      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <AlertTriangle size={32} className="text-danger mb-2" />
              <h4>{Array.isArray(loans) ? loans.reduce((sum, loan) => sum + getOverdueInstallments(loan).length, 0) : 0}</h4>
              <small className="text-muted">Overdue EMIs</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Calendar size={32} className="text-warning mb-2" />
              <h4>{Array.isArray(loans) ? loans.reduce((sum, loan) => sum + getUpcomingInstallments(loan).length, 0) : 0}</h4>
              <small className="text-muted">Due This Week</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <RefreshCw size={32} className="text-info mb-2" />
              <h4>{Array.isArray(extensions) ? extensions.filter(e => e.status === 'APPROVED').length : 0}</h4>
              <small className="text-muted">Extensions Granted</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <CheckCircle size={32} className="text-success mb-2" />
              <h4>{Array.isArray(extensions) ? extensions.filter(e => e.status === 'PENDING').length : 0}</h4>
              <small className="text-muted">Pending Requests</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">EMIs Eligible for Due Date Extension</h5>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : !Array.isArray(loans) || loans.length === 0 ? (
            <div className="text-center text-muted py-5">
              <Clock size={48} className="mb-3 opacity-50" />
              <p>No active loans found</p>
            </div>
          ) : (
            <Table striped hover responsive>
              <thead className="table-dark">
                <tr>
                  <th>Loan ID</th>
                  <th>Customer Name</th>
                  <th>EMI No</th>
                  <th>Current Due Date</th>
                  <th>Days Overdue</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map(loan =>
                  loan.schedule?.filter(inst => !inst.paid).map((inst, index) => {
                    const dueDate = new Date(inst.dueDate)
                    const now = new Date()
                    const daysOverdue = dueDate < now ? Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)) : 0
                    const isOverdue = dueDate < now

                    return (
                      <tr key={`${loan._id}-${index}`}>
                        <td>{loan.loanAccountNumber}</td>
                        <td>{loan.application?.personal?.name}</td>
                        <td>{inst.installmentNo}</td>
                        <td>{dueDate.toLocaleDateString()}</td>
                        <td>
                          {isOverdue ? (
                            <Badge bg="danger">{daysOverdue} days</Badge>
                          ) : (
                            <Badge bg="success">Upcoming</Badge>
                          )}
                        </td>
                        <td>
                          <Badge bg={isOverdue ? 'danger' : 'warning'}>
                            {isOverdue ? 'Overdue' : 'Pending'}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => handleExtendDueDate(loan, inst)}
                          >
                            <Edit size={14} className="me-1" />
                            Extend Date
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <h5 className="mb-0">Due Date Extension History</h5>
        </Card.Header>
        <Card.Body>
          <Table striped hover responsive>
            <thead className="table-dark">
              <tr>
                <th>Loan ID</th>
                <th>EMI No</th>
                <th>Original Due Date</th>
                <th>New Due Date</th>
                <th>Extension (Days)</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(extensions) && extensions.map(extension => {
                const originalDate = new Date(extension.originalDueDate)
                const newDate = new Date(extension.newDueDate)
                const extensionDays = Math.floor((newDate - originalDate) / (1000 * 60 * 60 * 24))

                return (
                  <tr key={extension._id}>
                    <td>{extension.loanId}</td>
                    <td>{extension.installmentNo}</td>
                    <td>{originalDate.toLocaleDateString()}</td>
                    <td>{newDate.toLocaleDateString()}</td>
                    <td>
                      <Badge bg="info">+{extensionDays} days</Badge>
                    </td>
                    <td>{extension.reason}</td>
                    <td>
                      <Badge bg={extension.status === 'APPROVED' ? 'success' : 'warning'}>
                        {extension.status}
                      </Badge>
                    </td>
                    <td>{new Date(extension.requestedAt).toLocaleDateString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Extension Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Extend EMI Due Date</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedLoan && selectedInstallment && (
            <div className="mb-3">
              <Alert variant="info">
                <strong>Loan:</strong> {selectedLoan.loanAccountNumber} |
                <strong>EMI:</strong> {selectedInstallment.installmentNo} |
                <strong>Current Due Date:</strong> {new Date(selectedInstallment.dueDate).toLocaleDateString()} |
                <strong>Amount:</strong> ₹{selectedInstallment.total}
              </Alert>
            </div>
          )}

          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>New Due Date *</Form.Label>
                  <Form.Control
                    type="date"
                    value={extensionData.newDueDate}
                    onChange={(e) => setExtensionData({...extensionData, newDueDate: e.target.value})}
                    min={selectedInstallment ? new Date(selectedInstallment.dueDate).toISOString().split('T')[0] : ''}
                  />
                  {extensionData.newDueDate && selectedInstallment && (
                    <Form.Text className="text-muted">
                      Extension: +{Math.floor((new Date(extensionData.newDueDate) - new Date(selectedInstallment.dueDate)) / (1000 * 60 * 60 * 24))} days
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Approved By</Form.Label>
                  <Form.Control
                    type="text"
                    value={extensionData.approvedBy}
                    onChange={(e) => setExtensionData({...extensionData, approvedBy: e.target.value})}
                    placeholder="Admin name"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Reason for Extension *</Form.Label>
              <Form.Select
                value={extensionData.reason}
                onChange={(e) => setExtensionData({...extensionData, reason: e.target.value})}
              >
                <option value="">Select reason</option>
                <option value="Customer requested extension">Customer requested extension</option>
                <option value="Financial difficulty">Financial difficulty</option>
                <option value="Medical emergency">Medical emergency</option>
                <option value="Business loss">Business loss</option>
                <option value="Natural disaster">Natural disaster</option>
                <option value="Technical issues">Technical issues</option>
                <option value="Other">Other</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Additional Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={extensionData.notes}
                onChange={(e) => setExtensionData({...extensionData, notes: e.target.value})}
                placeholder="Any additional notes about the extension request"
              />
            </Form.Group>

            {extensionData.newDueDate && selectedInstallment && (
              <Alert variant="warning">
                <strong>Extension Summary:</strong><br />
                Original Due Date: {new Date(selectedInstallment.dueDate).toLocaleDateString()}<br />
                New Due Date: {new Date(extensionData.newDueDate).toLocaleDateString()}<br />
                Extension Period: {Math.floor((new Date(extensionData.newDueDate) - new Date(selectedInstallment.dueDate)) / (1000 * 60 * 60 * 24))} days
              </Alert>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submitExtension}
            disabled={!extensionData.newDueDate || !extensionData.reason}
          >
            Grant Extension
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
