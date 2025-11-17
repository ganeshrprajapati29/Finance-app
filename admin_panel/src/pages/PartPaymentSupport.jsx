import { useState, useEffect } from 'react'
import { Card, Table, Button, Badge, Alert, Row, Col, Form, Modal, InputGroup, ProgressBar } from 'react-bootstrap'
import api from '../api/axios'
import { Split, DollarSign, CheckCircle, Clock, AlertTriangle, Calculator } from 'lucide-react'

export default function PartPaymentSupport(){
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [selectedInstallment, setSelectedInstallment] = useState(null)
  const [partPaymentData, setPartPaymentData] = useState({
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

  useEffect(()=>{ loadLoans() }, [])

  const handlePartPayment = (loan, installment)=>{
    setSelectedLoan(loan)
    setSelectedInstallment(installment)
    setPartPaymentData({
      amount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      reference: '',
      notes: `Part payment for EMI ${installment.installmentNo}`
    })
    setShowModal(true)
  }

  const submitPartPayment = async ()=>{
    try {
      await api.post(`/admin/emi-control/part-payment/${selectedLoan._id}/${selectedInstallment.installmentNo}`, {
        amount: partPaymentData.amount,
        paymentDate: partPaymentData.paymentDate,
        reference: partPaymentData.reference,
        notes: partPaymentData.notes
      })
      setShowModal(false)
      await loadLoans()
      alert('Part payment recorded successfully')
    } catch (error) {
      console.error('Failed to submit part payment:', error)
      alert('Failed to record part payment')
    }
  }

  const getPendingInstallments = (loan)=>{
    return loan.schedule?.filter(inst => !inst.paid) || []
  }

  const getPartPaymentProgress = (installment)=>{
    // Calculate actual part payment progress based on installment data
    // In real implementation, this would track part payments from database
    const total = installment.total || 0
    const paid = installment.partPayments?.reduce((sum, payment) => sum + payment.amount, 0) || 0
    const remaining = total - paid
    const percentage = total > 0 ? Math.round((paid / total) * 100) : 0

    return {
      paid,
      remaining: Math.max(0, remaining),
      percentage: Math.min(100, percentage)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <Split className="me-2" />
          Part Payment Support
        </h2>
      </div>

      <Alert variant="info" className="mb-4">
        <strong>Note:</strong> Part payment allows customers to pay partial amounts towards their EMI.
        This helps maintain payment history while providing flexibility for customers facing temporary financial difficulties.
      </Alert>

      <Row className="mb-4">
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <Clock size={32} className="text-warning mb-2" />
              <h4>{Array.isArray(loans) ? loans.reduce((sum, loan) => sum + getPendingInstallments(loan).length, 0) : 0}</h4>
              <small className="text-muted">Pending EMIs</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <Split size={32} className="text-info mb-2" />
              <h4>{Array.isArray(loans) ? loans.filter(loan => loan.schedule?.some(inst => inst.partPayments && inst.partPayments.length > 0)).length : 0}</h4>
              <small className="text-muted">Part Payments Active</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <Calculator size={32} className="text-success mb-2" />
              <h4>₹{Array.isArray(loans) ? loans.reduce((sum, loan) => sum + (loan.schedule?.reduce((s, inst) => s + (inst.total || 0), 0) || 0), 0).toLocaleString() : '0'}</h4>
              <small className="text-muted">Total EMI Value</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">EMIs Eligible for Part Payment</h5>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : !Array.isArray(loans) || loans.length === 0 ? (
            <div className="text-center text-muted py-5">
              <Split size={48} className="mb-3 opacity-50" />
              <p>No active loans found</p>
            </div>
          ) : (
            <Table striped hover responsive>
              <thead className="table-dark">
                <tr>
                  <th>Loan ID</th>
                  <th>Customer Name</th>
                  <th>EMI No</th>
                  <th>Due Date</th>
                  <th>Total Amount</th>
                  <th>Payment Progress</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map(loan =>
                  getPendingInstallments(loan).map((inst, index) => {
                    const progress = getPartPaymentProgress(inst)
                    return (
                      <tr key={`${loan._id}-${index}`}>
                        <td>{loan.loanAccountNumber}</td>
                        <td>{loan.application?.personal?.name}</td>
                        <td>{inst.installmentNo}</td>
                        <td>{new Date(inst.dueDate).toLocaleDateString()}</td>
                        <td>₹{inst.total?.toLocaleString()}</td>
                        <td>
                          <div style={{ minWidth: '120px' }}>
                            <div className="d-flex justify-content-between small mb-1">
                              <span>₹{progress.paid}</span>
                              <span>₹{progress.remaining}</span>
                            </div>
                            <ProgressBar
                              now={progress.percentage}
                              variant={progress.percentage > 50 ? 'success' : 'warning'}
                              style={{ height: '6px' }}
                            />
                          </div>
                        </td>
                        <td>
                          <Badge bg={new Date(inst.dueDate) < new Date() ? 'danger' : 'warning'}>
                            {new Date(inst.dueDate) < new Date() ? 'Overdue' : 'Pending'}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => handlePartPayment(loan, inst)}
                          >
                            Add Payment
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
          <h5 className="mb-0">Part Payment History</h5>
        </Card.Header>
        <Card.Body>

          <Table striped hover responsive>
            <thead className="table-dark">
              <tr>
                <th>Date</th>
                <th>Loan ID</th>
                <th>EMI No</th>
                <th>Part Amount</th>
                <th>Remaining</th>
                <th>Reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(loans) && loans.map(loan =>
                loan.schedule?.filter(inst => inst.partPayments && inst.partPayments.length > 0).map((inst, index) =>
                  inst.partPayments?.map((payment, paymentIndex) => (
                    <tr key={`${loan._id}-${inst.installmentNo}-${paymentIndex}`}>
                      <td>{new Date(payment.paymentDate).toLocaleDateString()}</td>
                      <td>{loan.loanAccountNumber}</td>
                      <td>{inst.installmentNo}</td>
                      <td>₹{payment.amount.toLocaleString()}</td>
                      <td>₹{(inst.total - (inst.partPayments?.reduce((sum, p) => sum + p.amount, 0) || 0)).toLocaleString()}</td>
                      <td>{payment.reference || 'N/A'}</td>
                      <td><Badge bg="success">Completed</Badge></td>
                    </tr>
                  ))
                )
              ).flat().slice(0, 10)}
              {(!Array.isArray(loans) || loans.filter(loan => loan.schedule?.some(inst => inst.partPayments && inst.partPayments.length > 0)).length === 0) && (
                <tr>
                  <td colSpan="7" className="text-center text-muted py-3">
                    No part payment history available
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Part Payment Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Record Part Payment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedLoan && selectedInstallment && (
            <div className="mb-3">
              <Alert variant="info">
                <strong>Loan:</strong> {selectedLoan.loanAccountNumber} |
                <strong>EMI:</strong> {selectedInstallment.installmentNo} |
                <strong>Total Amount:</strong> ₹{selectedInstallment.total} |
                <strong>Due Date:</strong> {new Date(selectedInstallment.dueDate).toLocaleDateString()}
              </Alert>
            </div>
          )}

          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Part Payment Amount *</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>₹</InputGroup.Text>
                    <Form.Control
                      type="number"
                      value={partPaymentData.amount}
                      onChange={(e) => setPartPaymentData({...partPaymentData, amount: e.target.value})}
                      placeholder="Enter part payment amount"
                      max={selectedInstallment?.total || 0}
                    />
                  </InputGroup>
                  {selectedInstallment && (
                    <Form.Text className="text-muted">
                      Maximum allowed: ₹{selectedInstallment.total}
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Payment Date *</Form.Label>
                  <Form.Control
                    type="date"
                    value={partPaymentData.paymentDate}
                    onChange={(e) => setPartPaymentData({...partPaymentData, paymentDate: e.target.value})}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Reference/Transaction ID</Form.Label>
              <Form.Control
                type="text"
                value={partPaymentData.reference}
                onChange={(e) => setPartPaymentData({...partPaymentData, reference: e.target.value})}
                placeholder="Bank reference, receipt number, etc."
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={partPaymentData.notes}
                onChange={(e) => setPartPaymentData({...partPaymentData, notes: e.target.value})}
                placeholder="Additional notes about the part payment"
              />
            </Form.Group>

            {partPaymentData.amount && selectedInstallment && (
              <Alert variant="info">
                <strong>Payment Summary:</strong><br />
                Part Payment: ₹{parseInt(partPaymentData.amount).toLocaleString()}<br />
                Remaining Amount: ₹{(selectedInstallment.total - parseInt(partPaymentData.amount || 0)).toLocaleString()}<br />
                Payment Progress: {Math.round((parseInt(partPaymentData.amount || 0) / selectedInstallment.total) * 100)}%
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
            onClick={submitPartPayment}
            disabled={!partPaymentData.amount || !partPaymentData.paymentDate}
          >
            Record Part Payment
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
