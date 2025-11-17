import { useState, useEffect } from 'react'
import { Card, Table, Button, Badge, Alert, Row, Col, Form, Modal } from 'react-bootstrap'
import api from '../api/axios'
import { Zap, CheckCircle, XCircle, Clock, Settings } from 'lucide-react'

export default function AutoDebitStatus(){
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [autoDebitEnabled, setAutoDebitEnabled] = useState(false)

  const loadLoans = async ()=>{
    setLoading(true)
    try {
      const r = await api.get('/admin/emi-control/auto-debit')
      setLoans(r.data.data.loans || [])
    } catch (error) {
      console.error('Failed to load loans:', error)
      setLoans([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ loadLoans() }, [])

  const toggleAutoDebit = async (loanId, enabled)=>{
    try {
      await api.post(`/admin/emi-control/auto-debit/${loanId}/toggle`, { enabled })
      alert(`Auto debit ${enabled ? 'enabled' : 'disabled'} successfully`)
      await loadLoans()
    } catch (error) {
      console.error('Failed to toggle auto debit:', error)
      alert('Failed to update auto debit status')
    }
  }

  const getAutoDebitStatus = (loan)=>{
    // Mock logic - in real implementation, this would come from loan data
    return Math.random() > 0.5
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <Zap className="me-2" />
          Auto Debit Status
        </h2>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <Settings className="me-2" size={16} />
          Configure Auto Debit
        </Button>
      </div>

      <Alert variant="info" className="mb-4">
        <strong>Note:</strong> Auto debit allows automatic deduction of EMI amounts from customer's bank account on due dates.
        This feature helps reduce manual follow-ups and ensures timely payments.
      </Alert>

      <Row className="mb-4">
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <CheckCircle size={32} className="text-success mb-2" />
              <h4>{Array.isArray(loans) ? loans.filter(loan => loan.autoDebit?.enabled).length : 0}</h4>
              <small className="text-muted">Auto Debit Enabled</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <XCircle size={32} className="text-danger mb-2" />
              <h4>{Array.isArray(loans) ? loans.filter(loan => !loan.autoDebit?.enabled).length : 0}</h4>
              <small className="text-muted">Auto Debit Disabled</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <Clock size={32} className="text-warning mb-2" />
              <h4>{Array.isArray(loans) ? loans.length : 0}</h4>
              <small className="text-muted">Total Active Loans</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card>
        <Card.Header>
          <h5 className="mb-0">Loan Auto Debit Status</h5>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : !Array.isArray(loans) || loans.length === 0 ? (
            <div className="text-center text-muted py-5">
              <Zap size={48} className="mb-3 opacity-50" />
              <p>No active loans found</p>
            </div>
          ) : (
            <Table striped hover responsive>
              <thead className="table-dark">
                <tr>
                  <th>Loan ID</th>
                  <th>Customer Name</th>
                  <th>Loan Amount</th>
                  <th>Auto Debit Status</th>
                  <th>Last Attempt</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map(loan => {
                  const isEnabled = loan.autoDebit?.enabled || false
                  return (
                    <tr key={loan._id}>
                      <td>{loan.loanAccountNumber}</td>
                      <td>{loan.application?.personal?.name}</td>
                      <td>₹{loan.decision?.amountApproved?.toLocaleString()}</td>
                      <td>
                        <Badge bg={isEnabled ? 'success' : 'secondary'}>
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </td>
                      <td>
                        {isEnabled ? new Date(loan.autoDebit?.updatedAt || new Date()).toLocaleDateString() : 'N/A'}
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant={isEnabled ? 'outline-danger' : 'outline-success'}
                          onClick={() => toggleAutoDebit(loan._id, !isEnabled)}
                        >
                          {isEnabled ? 'Disable' : 'Enable'}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Configuration Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Auto Debit Configuration</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            This feature is under development. Configuration options will be available soon.
          </Alert>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Default Auto Debit Setting</Form.Label>
              <Form.Check
                type="switch"
                label="Enable auto debit for new loans by default"
                checked={autoDebitEnabled}
                onChange={(e) => setAutoDebitEnabled(e.target.checked)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Grace Period (days)</Form.Label>
              <Form.Control type="number" placeholder="3" />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Retry Attempts</Form.Label>
              <Form.Control type="number" placeholder="3" />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => setShowModal(false)}>
            Save Configuration
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
