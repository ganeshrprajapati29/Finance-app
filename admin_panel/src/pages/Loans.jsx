import { useEffect, useState } from 'react'
import { Table, Badge, Button, Form, Modal, Card, Row, Col, Alert, InputGroup } from 'react-bootstrap'
import api from '../api/axios'

export default function Loans(){
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('PENDING')
  const [showDetail, setShowDetail] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [showDecision, setShowDecision] = useState(false)
  const [decisionType, setDecisionType] = useState('')
  const [decisionForm, setDecisionForm] = useState({
    amountApproved: '',
    rateAPR: '18',
    tenureMonths: '12',
    remarks: ''
  })
  const [loading, setLoading] = useState(false)

  const load = async ()=>{ const r = await api.get('/admin/loans?status='+status); setRows(r.data.data) }
  useEffect(()=>{ load() }, [status])

  const getStatusBadge = (status) => {
    const variants = {
      'PENDING': 'warning',
      'APPROVED': 'success',
      'REJECTED': 'danger',
      'DISBURSED': 'info',
      'CLOSED': 'secondary'
    }
    return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>
  }

  const viewDetails = (loan) => {
    setSelectedLoan(loan)
    setShowDetail(true)
  }

  const openDecision = (loan, type) => {
    setSelectedLoan(loan)
    setDecisionType(type)
    setDecisionForm({
      amountApproved: loan.application?.amountRequested || '',
      rateAPR: '18',
      tenureMonths: loan.application?.tenureMonths || '12',
      remarks: ''
    })
    setShowDecision(true)
  }

  const submitDecision = async () => {
    if (!selectedLoan) return
    setLoading(true)
    try {
      const payload = decisionType === 'APPROVED'
        ? {
            decision: 'APPROVED',
            amountApproved: Number(decisionForm.amountApproved),
            rateAPR: Number(decisionForm.rateAPR),
            tenureMonths: Number(decisionForm.tenureMonths)
          }
        : {
            decision: 'REJECTED'
          }

      await api.post(`/admin/loans/${selectedLoan._id}/decision`, payload)
      setShowDecision(false)
      await load()
    } catch (e) {
      alert('Error: ' + (e.response?.data?.message || e.message))
    } finally {
      setLoading(false)
    }
  }

  const disburseLoan = async (loan) => {
    const txnId = prompt('Enter Transaction ID for disbursement:')
    if (!txnId) return

    try {
      await api.post(`/admin/loans/${loan._id}/disburse`, { txnId })
      await load()
    } catch (e) {
      alert('Error: ' + (e.response?.data?.message || e.message))
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Loan Applications</h4>
        <Form.Select value={status} onChange={e=>setStatus(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="ALL">All Status</option>
          {['PENDING','APPROVED','REJECTED','DISBURSED','CLOSED'].map(s=><option key={s} value={s}>{s}</option>)}
        </Form.Select>
      </div>

      <Table striped hover responsive>
        <thead>
          <tr>
            <th>Application ID</th>
            <th>User</th>
            <th>Requested Amount</th>
            <th>Tenure</th>
            <th>Status</th>
            <th>Approved Terms</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
        {rows.map(r=>(
          <tr key={r._id}>
            <td><code>{r._id.slice(-8)}</code></td>
            <td>
              <div>{r.userId?.name || 'N/A'}</div>
              <small className="text-muted">{r.userId?.email}</small>
            </td>
            <td><strong>₹{r.application?.amountRequested?.toLocaleString()}</strong></td>
            <td>{r.application?.tenureMonths} months</td>
            <td>{getStatusBadge(r.status)}</td>
            <td>
              {r.decision?.amountApproved ?
                <div>
                  <div>₹{r.decision.amountApproved.toLocaleString()}</div>
                  <small className="text-muted">{r.decision.rateAPR}% APR, {r.decision.tenureMonths}m</small>
                </div>
                : '-'
              }
            </td>
            <td>
              <Button size="sm" variant="outline-primary" onClick={()=>viewDetails(r)}>View</Button>{' '}
              {r.status==='PENDING' && (
                <>
                  <Button size="sm" variant="success" onClick={()=>openDecision(r, 'APPROVED')}>Approve</Button>{' '}
                  <Button size="sm" variant="danger" onClick={()=>openDecision(r, 'REJECTED')}>Reject</Button>
                </>
              )}
              {r.status==='APPROVED' && (
                <Button size="sm" variant="info" onClick={()=>disburseLoan(r)}>Disburse</Button>
              )}
            </td>
          </tr>
        ))}
        </tbody>
      </Table>

      {/* Detail Modal */}
      <Modal show={showDetail} onHide={()=>setShowDetail(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Loan Application Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedLoan && (
            <div>
              <Row className="mb-3">
                <Col md={6}>
                  <Card>
                    <Card.Header><strong>Personal Information</strong></Card.Header>
                    <Card.Body>
                      <p><strong>Name:</strong> {selectedLoan.application?.personal?.name}</p>
                      <p><strong>Email:</strong> {selectedLoan.application?.personal?.email}</p>
                      <p><strong>Mobile:</strong> {selectedLoan.application?.personal?.mobile}</p>
                      <p><strong>Address:</strong> {selectedLoan.application?.personal?.address}</p>
                      <p><strong>Father:</strong> {selectedLoan.application?.personal?.fatherName}</p>
                      <p><strong>Mother:</strong> {selectedLoan.application?.personal?.motherName}</p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card>
                    <Card.Header><strong>Qualification & Employment</strong></Card.Header>
                    <Card.Body>
                      <p><strong>Education:</strong> {selectedLoan.application?.qualification?.highestEducation}</p>
                      <p><strong>Stream:</strong> {selectedLoan.application?.qualification?.stream}</p>
                      <p><strong>Employment:</strong> {selectedLoan.application?.employment?.employmentType}</p>
                      <p><strong>Income:</strong> ₹{selectedLoan.application?.employment?.monthlyIncome}</p>
                      <p><strong>Experience:</strong> {selectedLoan.application?.employment?.experienceYears} years</p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <Card>
                    <Card.Header><strong>Loan Request</strong></Card.Header>
                    <Card.Body>
                      <p><strong>Amount:</strong> ₹{selectedLoan.application?.amountRequested}</p>
                      <p><strong>Tenure:</strong> {selectedLoan.application?.tenureMonths} months</p>
                      <p><strong>Purpose:</strong> {selectedLoan.application?.purpose}</p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card>
                    <Card.Header><strong>References</strong></Card.Header>
                    <Card.Body>
                      {selectedLoan.application?.references?.map((ref, i) => (
                        <div key={i} className="mb-2">
                          <strong>{ref.name}</strong> ({ref.relation})<br/>
                          <small>{ref.mobile}</small>
                        </div>
                      ))}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {selectedLoan.application?.documents && (
                <Card className="mb-3">
                  <Card.Header><strong>Documents</strong></Card.Header>
                  <Card.Body>
                    <Row>
                      {selectedLoan.application.documents.aadhaarFrontUrl && (
                        <Col md={3}><a href={selectedLoan.application.documents.aadhaarFrontUrl} target="_blank" rel="noopener noreferrer">Aadhaar Front</a></Col>
                      )}
                      {selectedLoan.application.documents.aadhaarBackUrl && (
                        <Col md={3}><a href={selectedLoan.application.documents.aadhaarBackUrl} target="_blank" rel="noopener noreferrer">Aadhaar Back</a></Col>
                      )}
                      {selectedLoan.application.documents.panUrl && (
                        <Col md={3}><a href={selectedLoan.application.documents.panUrl} target="_blank" rel="noopener noreferrer">PAN Card</a></Col>
                      )}
                      {selectedLoan.application.documents.selfieUrl && (
                        <Col md={3}><a href={selectedLoan.application.documents.selfieUrl} target="_blank" rel="noopener noreferrer">Selfie</a></Col>
                      )}
                    </Row>
                  </Card.Body>
                </Card>
              )}
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* Decision Modal */}
      <Modal show={showDecision} onHide={()=>setShowDecision(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{decisionType === 'APPROVED' ? 'Approve' : 'Reject'} Loan Application</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {decisionType === 'APPROVED' ? (
            <div>
              <Alert variant="info">
                <strong>Application:</strong> ₹{selectedLoan?.application?.amountRequested} for {selectedLoan?.application?.tenureMonths} months
              </Alert>
              <Form.Group className="mb-3">
                <Form.Label>Approved Amount (₹)</Form.Label>
                <Form.Control
                  type="number"
                  value={decisionForm.amountApproved}
                  onChange={(e)=>setDecisionForm({...decisionForm, amountApproved: e.target.value})}
                />
              </Form.Group>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Interest Rate (APR %)</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.1"
                      value={decisionForm.rateAPR}
                      onChange={(e)=>setDecisionForm({...decisionForm, rateAPR: e.target.value})}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Tenure (months)</Form.Label>
                    <Form.Control
                      type="number"
                      value={decisionForm.tenureMonths}
                      onChange={(e)=>setDecisionForm({...decisionForm, tenureMonths: e.target.value})}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </div>
          ) : (
            <Form.Group className="mb-3">
              <Form.Label>Rejection Remarks</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={decisionForm.remarks}
                onChange={(e)=>setDecisionForm({...decisionForm, remarks: e.target.value})}
                placeholder="Reason for rejection..."
              />
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={()=>setShowDecision(false)}>Cancel</Button>
          <Button
            variant={decisionType === 'APPROVED' ? 'success' : 'danger'}
            onClick={submitDecision}
            disabled={loading}
          >
            {loading ? 'Processing...' : (decisionType === 'APPROVED' ? 'Approve Loan' : 'Reject Loan')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )

}
