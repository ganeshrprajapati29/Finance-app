import { useState, useEffect } from 'react'
import { Card, Row, Col, Table, Button, Form, Modal, Alert, Badge } from 'react-bootstrap'
import api from '../api/axios'
import { Calendar, Users, DollarSign, TrendingUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import AutoDebitModal from './AutoDebitStatus.jsx'
import ManualPaymentModal from './ManualPaymentUpdate.jsx'
import PartPaymentModal from './PartPaymentSupport.jsx'
import PenaltyModal from './PenaltyChargesManagement.jsx'
import ExtendModal from './ExtendEmiDueDate.jsx'
import MarkPaidModal from './MarkPaidModal.jsx'

export default function EmiControl(){
  const [loans, setLoans] = useState([])
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('')

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

  const loadSchedule = async (loanId)=>{
    try {
      const r = await api.get(`/admin/emi-control/schedule/${loanId}`)
      setSchedule(Array.isArray(r.data.data?.schedule) ? r.data.data.schedule : [])
      setSelectedLoan(r.data.data || null)
    } catch (error) {
      console.error('Failed to load schedule:', error)
      setSchedule([])
      setSelectedLoan(null)
    }
  }

  useEffect(()=>{ loadLoans() }, [])

  const getStatusBadge = (paid, dueDate)=>{
    const now = new Date()
    const due = new Date(dueDate)
    if (paid) return <Badge bg="success">Paid</Badge>
    if (due < now) return <Badge bg="danger">Overdue</Badge>
    return <Badge bg="warning">Pending</Badge>
  }

  const totalPaid = schedule && Array.isArray(schedule) ? schedule.filter(s => s.paid).length : 0
  const totalOverdue = schedule && Array.isArray(schedule) ? schedule.filter(s => !s.paid && new Date(s.dueDate) < new Date()).length : 0
  const totalAmount = schedule && Array.isArray(schedule) ? schedule.reduce((sum, s) => sum + s.total, 0) : 0
  const paidAmount = schedule && Array.isArray(schedule) ? schedule.filter(s => s.paid).reduce((sum, s) => sum + s.total, 0) : 0

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <Calendar className="me-2" />
          EMI Schedule Generator
        </h2>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" onClick={() => { setModalType('auto-debit'); setShowModal(true) }}>
            Auto Debit Status
          </Button>
          <Button variant="outline-secondary" onClick={() => { setModalType('manual-payment'); setShowModal(true) }}>
            Manual Payment Update
          </Button>
          <Button variant="outline-info" onClick={() => { setModalType('part-payment'); setShowModal(true) }}>
            Part Payment Support
          </Button>
          <Button variant="outline-warning" onClick={() => { setModalType('penalty'); setShowModal(true) }}>
            Penalty Charges
          </Button>
          <Button variant="outline-success" onClick={() => { setModalType('extend'); setShowModal(true) }}>
            Extend Due Date
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Users size={32} className="text-primary mb-2" />
              <h4>{Array.isArray(loans) ? loans.length : 0}</h4>
              <small className="text-muted">Active Loans</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <CheckCircle size={32} className="text-success mb-2" />
              <h4>{totalPaid}</h4>
              <small className="text-muted">EMIs Paid</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <XCircle size={32} className="text-danger mb-2" />
              <h4>{totalOverdue}</h4>
              <small className="text-muted">Overdue EMIs</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <DollarSign size={32} className="text-info mb-2" />
              <h4>₹{paidAmount.toLocaleString()}</h4>
              <small className="text-muted">Total Collected</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col md={4}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Active Loans</h5>
            </Card.Header>
            <Card.Body style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {loading ? (
                <div className="text-center">Loading...</div>
              ) : !Array.isArray(loans) || loans.length === 0 ? (
                <div className="text-center text-muted">No active loans found</div>
              ) : (
                loans.map(loan => (
                  <div
                    key={loan._id}
                    className={`p-3 mb-2 border rounded cursor-pointer ${
                      selectedLoan?._id === loan._id ? 'border-primary bg-light' : 'border-secondary'
                    }`}
                    onClick={() => loadSchedule(loan._id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-bold">Loan #{loan.loanAccountNumber}</div>
                        <div className="text-muted small">{loan.application?.personal?.name}</div>
                        <div className="text-muted small">₹{loan.decision?.amountApproved?.toLocaleString()}</div>
                      </div>
                      <Badge bg={loan.status === 'DISBURSED' ? 'success' : 'warning'}>
                        {loan.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={8}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">
                EMI Schedule
                {selectedLoan && (
                  <span className="ms-2 text-muted">
                    - Loan #{selectedLoan.loanAccountNumber}
                  </span>
                )}
              </h5>
            </Card.Header>
            <Card.Body>
              {!selectedLoan ? (
                <div className="text-center text-muted py-5">
                  <Calendar size={48} className="mb-3 opacity-50" />
                  <p>Select a loan to view EMI schedule</p>
                </div>
              ) : !schedule || !Array.isArray(schedule) || schedule.length === 0 ? (
                <div className="text-center text-muted py-5">
                  <AlertTriangle size={48} className="mb-3 opacity-50" />
                  <p>No EMI schedule found</p>
                </div>
              ) : (
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <Table striped hover responsive>
                    <thead className="table-dark">
                      <tr>
                        <th>Installment</th>
                        <th>Due Date</th>
                        <th>Principal</th>
                        <th>Interest</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule && Array.isArray(schedule) && schedule.map((emi, index) => (
                        <tr key={index}>
                          <td>{emi.installmentNo}</td>
                          <td>{new Date(emi.dueDate).toLocaleDateString()}</td>
                          <td>₹{emi.principal?.toLocaleString()}</td>
                          <td>₹{emi.interest?.toLocaleString()}</td>
                          <td>₹{emi.total?.toLocaleString()}</td>
                          <td>{getStatusBadge(emi.paid, emi.dueDate)}</td>
                          <td>
                            {!emi.paid && (
                              <Button
                                size="sm"
                                variant="outline-success"
                                onClick={() => { setModalType('mark-paid'); setShowModal(true) }}
                              >
                                Mark Paid
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Modal for EMI Actions */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {modalType === 'auto-debit' && 'Auto Debit Status'}
            {modalType === 'manual-payment' && 'Manual Payment Update'}
            {modalType === 'part-payment' && 'Part Payment Support'}
            {modalType === 'penalty' && 'Penalty Charges Management'}
            {modalType === 'extend' && 'Extend EMI Due Date'}
            {modalType === 'mark-paid' && 'Mark EMI as Paid'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalType === 'auto-debit' && <AutoDebitModal selectedLoan={selectedLoan} onClose={() => setShowModal(false)} />}
          {modalType === 'manual-payment' && <ManualPaymentModal selectedLoan={selectedLoan} onClose={() => setShowModal(false)} />}
          {modalType === 'part-payment' && <PartPaymentModal selectedLoan={selectedLoan} onClose={() => setShowModal(false)} />}
          {modalType === 'penalty' && <PenaltyModal selectedLoan={selectedLoan} onClose={() => setShowModal(false)} />}
          {modalType === 'extend' && <ExtendModal selectedLoan={selectedLoan} onClose={() => setShowModal(false)} />}
          {modalType === 'mark-paid' && <MarkPaidModal selectedLoan={selectedLoan} schedule={schedule} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); loadSchedule(selectedLoan._id); }} />}
        </Modal.Body>
      </Modal>
    </div>
  )
}
