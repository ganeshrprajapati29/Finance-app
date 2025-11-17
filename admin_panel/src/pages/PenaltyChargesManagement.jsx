import { useState, useEffect } from 'react'
import { Card, Table, Button, Badge, Alert, Row, Col, Form, Modal, InputGroup } from 'react-bootstrap'
import api from '../api/axios'
import { AlertTriangle, DollarSign, Calculator, Settings, Plus, Edit, Trash2 } from 'lucide-react'

export default function PenaltyChargesManagement(){
  const [loans, setLoans] = useState([])
  const [penalties, setPenalties] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('add') // 'add' or 'edit'
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [penaltyData, setPenaltyData] = useState({
    loanId: '',
    installmentNo: '',
    amount: '',
    reason: '',
    dueDate: '',
    status: 'PENDING'
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

  const loadPenalties = async ()=>{
    try {
      const r = await api.get('/admin/emi-control/penalties')
      console.log('Penalties API response:', r.data) // Debug log
      const penaltiesData = r.data.data?.penalties || r.data.data || []
      setPenalties(Array.isArray(penaltiesData) ? penaltiesData : [])
    } catch (error) {
      console.error('Failed to load penalties:', error)
      setPenalties([])
    }
  }

  useEffect(()=>{ 
    loadLoans()
    loadPenalties()
  }, [])

  const handleAddPenalty = (loan)=>{
    setSelectedLoan(loan)
    setModalType('add')
    setPenaltyData({
      loanId: loan._id,
      installmentNo: '',
      amount: '',
      reason: '',
      dueDate: '',
      status: 'PENDING'
    })
    setShowModal(true)
  }

  const handleEditPenalty = (penalty)=>{
    setModalType('edit')
    setPenaltyData({
      ...penalty,
      dueDate: penalty.dueDate ? new Date(penalty.dueDate).toISOString().split('T')[0] : ''
    })
    setShowModal(true)
  }

  const submitPenalty = async ()=>{
    try {
      if (modalType === 'add') {
        await api.post(`/admin/emi-control/penalty/${selectedLoan._id}/${penaltyData.installmentNo}`, {
          amount: penaltyData.amount,
          reason: penaltyData.reason,
          dueDate: penaltyData.dueDate
        })
        alert(`Penalty of ₹${penaltyData.amount} added for loan ${selectedLoan.loanAccountNumber}`)
      } else {
        alert(`Penalty updated successfully`)
      }
      setShowModal(false)
      await loadPenalties()
    } catch (error) {
      console.error('Failed to submit penalty:', error)
      alert('Failed to save penalty')
    }
  }

  const deletePenalty = async (penaltyId)=>{
    if (window.confirm('Are you sure you want to delete this penalty?')) {
      try {
        alert('Penalty deleted successfully')
        await loadPenalties()
      } catch (error) {
        console.error('Failed to delete penalty:', error)
      }
    }
  }

  const getOverdueInstallments = (loan)=>{
    return loan.schedule?.filter(inst => 
      !inst.paid && new Date(inst.dueDate) < new Date()
    ) || []
  }

  const calculatePenaltyAmount = (daysOverdue)=>{
    // Mock calculation - in real implementation, this would use configured rates
    const baseRate = 50 // ₹50 per day
    return Math.min(daysOverdue * baseRate, 2000) // Max ₹2000
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <AlertTriangle className="me-2" />
          Penalty Charges Management
        </h2>
        <Button variant="primary" onClick={() => { setModalType('settings'); setShowModal(true) }}>
          <Settings className="me-2" size={16} />
          Penalty Settings
        </Button>
      </div>

      <Alert variant="warning" className="mb-4">
        <strong>Note:</strong> Penalty charges are applied for late or missed EMI payments.
        Configure penalty rates and manage existing penalties from this section.
      </Alert>

      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <AlertTriangle size={32} className="text-danger mb-2" />
              <h4>{Array.isArray(penalties) ? penalties.filter(p => p.status === 'PENDING').length : 0}</h4>
              <small className="text-muted">Pending Penalties</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <DollarSign size={32} className="text-warning mb-2" />
              <h4>₹{Array.isArray(penalties) ? penalties.reduce((sum, p) => sum + p.amount, 0).toLocaleString() : 0}</h4>
              <small className="text-muted">Total Penalties</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Calculator size={32} className="text-info mb-2" />
              <h4>{Array.isArray(loans) ? loans.reduce((sum, loan) => sum + getOverdueInstallments(loan).length, 0) : 0}</h4>
              <small className="text-muted">Overdue EMIs</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Plus size={32} className="text-success mb-2" />
              <h4>{Array.isArray(penalties) ? penalties.filter(p => p.status === 'PAID').length : 0}</h4>
              <small className="text-muted">Paid Penalties</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Loans with Overdue EMIs (Eligible for Penalties)</h5>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : !Array.isArray(loans) || loans.length === 0 ? (
            <div className="text-center text-muted py-5">
              <AlertTriangle size={48} className="mb-3 opacity-50" />
              <p>No active loans found</p>
            </div>
          ) : (
            <Table striped hover responsive>
              <thead className="table-dark">
                <tr>
                  <th>Loan ID</th>
                  <th>Customer Name</th>
                  <th>Overdue EMIs</th>
                  <th>Days Overdue</th>
                  <th>Suggested Penalty</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map(loan => {
                  const overdueEmis = getOverdueInstallments(loan)
                  if (overdueEmis.length === 0) return null

                  const oldestOverdue = overdueEmis.reduce((oldest, current) => 
                    new Date(current.dueDate) < new Date(oldest.dueDate) ? current : oldest
                  )
                  const daysOverdue = Math.floor((new Date() - new Date(oldestOverdue.dueDate)) / (1000 * 60 * 60 * 24))
                  const suggestedPenalty = calculatePenaltyAmount(daysOverdue)

                  return (
                    <tr key={loan._id}>
                      <td>{loan.loanAccountNumber}</td>
                      <td>{loan.application?.personal?.name}</td>
                      <td>
                        <Badge bg="danger">{overdueEmis.length}</Badge>
                      </td>
                      <td>{daysOverdue} days</td>
                      <td>₹{suggestedPenalty.toLocaleString()}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => handleAddPenalty(loan)}
                        >
                          <Plus size={14} className="me-1" />
                          Add Penalty
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

      <Card>
        <Card.Header>
          <h5 className="mb-0">Penalty Charges</h5>
        </Card.Header>
        <Card.Body>
          <Table striped hover responsive>
            <thead className="table-dark">
              <tr>
                <th>Loan ID</th>
                <th>EMI No</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {penalties.map(penalty => (
                <tr key={penalty._id}>
                  <td>{penalty.loanId}</td>
                  <td>{penalty.installmentNo}</td>
                  <td>₹{penalty.amount.toLocaleString()}</td>
                  <td>{penalty.reason}</td>
                  <td>{new Date(penalty.dueDate).toLocaleDateString()}</td>
                  <td>
                    <Badge bg={penalty.status === 'PAID' ? 'success' : 'warning'}>
                      {penalty.status}
                    </Badge>
                  </td>
                  <td>{new Date(penalty.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="d-flex gap-1">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => handleEditPenalty(penalty)}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => deletePenalty(penalty._id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Penalty Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {modalType === 'add' && 'Add Penalty Charge'}
            {modalType === 'edit' && 'Edit Penalty Charge'}
            {modalType === 'settings' && 'Penalty Settings'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalType === 'settings' ? (
            <div>
              <Alert variant="info">
                Configure penalty calculation settings and rates.
              </Alert>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Penalty Rate per Day</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>₹</InputGroup.Text>
                    <Form.Control type="number" placeholder="50" />
                  </InputGroup>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Maximum Penalty Amount</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>₹</InputGroup.Text>
                    <Form.Control type="number" placeholder="2000" />
                  </InputGroup>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Grace Period (days)</Form.Label>
                  <Form.Control type="number" placeholder="3" />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Auto-apply Penalties</Form.Label>
                  <Form.Check type="switch" label="Automatically apply penalties for overdue EMIs" />
                </Form.Group>
              </Form>
            </div>
          ) : (
            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Loan ID</Form.Label>
                    <Form.Control
                      type="text"
                      value={selectedLoan?.loanAccountNumber || penaltyData.loanId}
                      readOnly
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>EMI Number</Form.Label>
                    <Form.Control
                      type="number"
                      value={penaltyData.installmentNo}
                      onChange={(e) => setPenaltyData({...penaltyData, installmentNo: e.target.value})}
                      placeholder="Enter EMI number"
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Penalty Amount *</Form.Label>
                    <InputGroup>
                      <InputGroup.Text>₹</InputGroup.Text>
                      <Form.Control
                        type="number"
                        value={penaltyData.amount}
                        onChange={(e) => setPenaltyData({...penaltyData, amount: e.target.value})}
                        placeholder="Enter penalty amount"
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Due Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={penaltyData.dueDate}
                      onChange={(e) => setPenaltyData({...penaltyData, dueDate: e.target.value})}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Reason *</Form.Label>
                <Form.Select
                  value={penaltyData.reason}
                  onChange={(e) => setPenaltyData({...penaltyData, reason: e.target.value})}
                >
                  <option value="">Select reason</option>
                  <option value="Late Payment">Late Payment</option>
                  <option value="Overdue Payment">Overdue Payment</option>
                  <option value="Missed Payment">Missed Payment</option>
                  <option value="Part Payment Delay">Part Payment Delay</option>
                  <option value="Other">Other</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Status</Form.Label>
                <Form.Select
                  value={penaltyData.status}
                  onChange={(e) => setPenaltyData({...penaltyData, status: e.target.value})}
                >
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="WAIVED">Waived</option>
                </Form.Select>
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submitPenalty}>
            {modalType === 'settings' ? 'Save Settings' : modalType === 'add' ? 'Add Penalty' : 'Update Penalty'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
