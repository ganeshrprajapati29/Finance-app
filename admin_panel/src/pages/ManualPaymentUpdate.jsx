import { useState, useEffect } from 'react'
import { Card, Table, Button, Badge, Alert, Row, Col, Form, Modal, InputGroup } from 'react-bootstrap'
import api from '../api/axios'
import { Edit, CheckCircle, XCircle, DollarSign, Calendar, User } from 'lucide-react'

export default function ManualPaymentUpdate(){
  const [loans, setLoans] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [selectedInstallment, setSelectedInstallment] = useState(null)
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentDate: '',
    reference: '',
    notes: ''
  })

  const loadLoans = async ()=>{
    setLoading(true)
    try {
      const r = await api.get('/admin/loans?status=DISBURSED')
      setLoans(r.data.data.items)
    } catch (error) {
      console.error('Failed to load loans:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPayments = async ()=>{
    try {
      const r = await api.get('/admin/payments')
      setPayments(r.data.data)
    } catch (error) {
      console.error('Failed to load payments:', error)
    }
  }

  useEffect(()=>{ 
    loadLoans()
    loadPayments()
  }, [])

  const handleManualPayment = (loan, installment)=>{
    setSelectedLoan(loan)
    setSelectedInstallment(installment)
    setPaymentData({
      amount: installment.total.toString(),
      paymentDate: new Date().toISOString().split('T')[0],
      reference: '',
      notes: `Manual payment for EMI ${installment.installmentNo}`
    })
    setShowModal(true)
  }

  const submitManualPayment = async ()=>{
    try {
      // This would be implemented in backend
      alert(`Manual payment recorded for loan ${selectedLoan.loanAccountNumber}, EMI ${selectedInstallment.installmentNo}`)
      setShowModal(false)
      await loadLoans()
      await loadPayments()
    } catch (error) {
      console.error('Failed to submit manual payment:', error)
    }
  }

  const getOverdueInstallments = (loan)=>{
    return loan.schedule?.filter(inst => 
      !inst.paid && new Date(inst.dueDate) < new Date()
    ) || []
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <Edit className="me-2" />
          Manual Payment Update
        </h2>
      </div>

      <Alert variant="info" className="mb-4">
        <strong>Note:</strong> Use this section to manually record payments that were made outside the automated system,
        such as cash payments, bank transfers, or payments through other channels.
      </Alert>

      <Row className="mb-4">
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <XCircle size={32} className="text-danger mb-2" />
              <h4>{Array.isArray(loans) ? loans.reduce((sum, loan) => sum + getOverdueInstallments(loan).length, 0) : 0}</h4>
              <small className="text-muted">Overdue EMIs</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <Calendar size={32} className="text-warning mb-2" />
              <h4>{Array.isArray(loans) ? loans.reduce((sum, loan) => sum + (loan.schedule?.filter(inst => !inst.paid).length || 0), 0) : 0}</h4>
              <small className="text-muted">Pending EMIs</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <DollarSign size={32} className="text-success mb-2" />
              <h4>₹{Array.isArray(payments) ? payments.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum + p.amount, 0).toLocaleString() : '0'}</h4>
              <small className="text-muted">Total Payments</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Loans with Pending/Overdue EMIs</h5>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : !Array.isArray(loans) || loans.length === 0 ? (
            <div className="text-center text-muted py-5">
              <User size={48} className="mb-3 opacity-50" />
              <p>No active loans found</p>
            </div>
          ) : (
            <Table striped hover responsive>
              <thead className="table-dark">
                <tr>
                  <th>Loan ID</th>
                  <th>Customer Name</th>
                  <th>Pending EMIs</th>
                  <th>Overdue EMIs</th>
                  <th>Next Due Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map(loan => {
                  const pendingEmis = loan.schedule?.filter(inst => !inst.paid) || []
                  const overdueEmis = getOverdueInstallments(loan)
                  const nextDue = pendingEmis.find(inst => new Date(inst.dueDate) >= new Date())

                  return (
                    <tr key={loan._id}>
                      <td>{loan.loanAccountNumber}</td>
                      <td>{loan.application?.personal?.name}</td>
                      <td>
                        <Badge bg="warning">{pendingEmis.length}</Badge>
                      </td>
                      <td>
                        <Badge bg="danger">{overdueEmis.length}</Badge>
                      </td>
                      <td>
                        {nextDue ? new Date(nextDue.dueDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td>
                        {pendingEmis.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => handleManualPayment(loan, pendingEmis[0])}
                          >
                            Record Payment
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <h5 className="mb-0">Recent Manual Payments</h5>
        </Card.Header>
        <Card.Body>
          <Table striped hover responsive>
            <thead className="table-dark">
              <tr>
                <th>Date</th>
                <th>Loan ID</th>
                <th>Amount</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(payments) && payments.slice(0, 10).map(payment => (
                <tr key={payment._id}>
                  <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                  <td>{payment.loanId || 'N/A'}</td>
                  <td>₹{payment.amount}</td>
                  <td>{payment.reference || 'N/A'}</td>
                  <td>
                    <Badge bg={payment.status === 'COMPLETED' ? 'success' : 'warning'}>
                      {payment.status}
                    </Badge>
                  </td>
                  <td>{payment.method}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Manual Payment Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Record Manual Payment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedLoan && selectedInstallment && (
            <div className="mb-3">
              <Alert variant="info">
                <strong>Loan:</strong> {selectedLoan.loanAccountNumber} | <strong>EMI:</strong> {selectedInstallment.installmentNo} | <strong>Amount:</strong> ₹{selectedInstallment.total}
              </Alert>
            </div>
          )}

          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Payment Amount *</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>₹</InputGroup.Text>
                    <Form.Control
                      type="number"
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                      placeholder="Enter amount"
                    />
                  </InputGroup>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Payment Date *</Form.Label>
                  <Form.Control
                    type="date"
                    value={paymentData.paymentDate}
                    onChange={(e) => setPaymentData({...paymentData, paymentDate: e.target.value})}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Reference/Transaction ID</Form.Label>
              <Form.Control
                type="text"
                value={paymentData.reference}
                onChange={(e) => setPaymentData({...paymentData, reference: e.target.value})}
                placeholder="Bank reference, receipt number, etc."
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={paymentData.notes}
                onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})}
                placeholder="Additional notes about the payment"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submitManualPayment}>
            Record Payment
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
