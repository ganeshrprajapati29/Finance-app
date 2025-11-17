import { useEffect, useState } from 'react'
import { Table, Badge, Button, Form, Modal, Card, Row, Col, Alert, InputGroup } from 'react-bootstrap'
import api from '../api/axios'

export default function Loans(){
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('ALL')
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

  const load = async ()=>{
    try {
      const url = status === 'ALL' ? '/admin/loans' : '/admin/loans?status=' + status
      const r = await api.get(url)
      setRows(r.data.data)
    } catch(e) {
      console.error(e)
    }
  }

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
            decision: 'REJECTED',
            remarks: decisionForm.remarks
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%)', padding: '40px 20px' }}>
      {/* Premium Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)',
        borderRadius: '16px',
        padding: '35px',
        marginBottom: '35px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.2)',
        color: 'white'
      }}>
        <Row className="align-items-center">
          <Col md={8}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '70px',
                height: '70px',
                background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
                fontWeight: 'bold',
                boxShadow: '0 10px 30px rgba(26, 188, 156, 0.3)'
              }}>
                K
              </div>
              <div>
                <h2 style={{ margin: 0, fontWeight: '700', fontSize: '28px' }}>Loan Applications</h2>
                <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>KhatuPay - Credit is Happiness</p>
              </div>
            </div>
          </Col>
          <Col md={4} className="text-end">
            <div>
              <small style={{ opacity: 0.85, display: 'block', marginBottom: '8px', fontWeight: '600' }}>Filter by Status</small>
              <Form.Select 
                value={status} 
                onChange={e=>setStatus(e.target.value)} 
                style={{ 
                  maxWidth: '240px',
                  marginLeft: 'auto',
                  background: 'rgba(255,255,255,0.95)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#001f5c',
                  fontWeight: '500',
                  padding: '10px 15px',
                  boxShadow: '0 5px 15px rgba(0, 0, 0, 0.1)'
                }}
              >
                <option value="ALL">All Status</option>
                {['PENDING','APPROVED','REJECTED','DISBURSED','CLOSED'].map(s=>
                  <option key={s} value={s}>{s}</option>
                )}
              </Form.Select>
            </div>
          </Col>
        </Row>
      </div>

      {/* Main Table Card */}
      <Card style={{
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)',
        border: 'none',
        borderRadius: '16px',
        overflow: 'hidden'
      }}>
        <Card.Body style={{ padding: '0' }}>
          <div style={{ overflowX: 'auto' }}>
            <Table striped hover responsive style={{ marginBottom: '0' }}>
              <thead style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', borderBottom: '2px solid #dee2e6' }}>
                <tr>
                  <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Application ID</th>
                  <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>User Name</th>
                  <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Email</th>
                  <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Mobile</th>
                  <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Requested Amount</th>
                  <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Tenure</th>
                  <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Status</th>
                  <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Approved Terms</th>
                  <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
              {rows.map((r, idx)=>(
                <tr key={r._id} style={{ borderBottom: '1px solid #dee2e6', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <td style={{ padding: '16px', color: '#495057' }}><code style={{ background: '#e9ecef', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', color: '#001f5c' }}>{r._id.slice(-8)}</code></td>
                  <td style={{ padding: '16px', fontWeight: '700', color: '#001f5c' }}>{r.userId?.name || r.application?.personal?.name || 'N/A'}</td>
                  <td style={{ padding: '16px', color: '#495057', fontSize: '13px' }}>{r.userId?.email || r.application?.personal?.email || 'N/A'}</td>
                  <td style={{ padding: '16px', color: '#495057', fontSize: '13px' }}>{r.application?.personal?.mobile || 'N/A'}</td>
                  <td style={{ padding: '16px', fontWeight: '700', color: '#1abc9c' }}>₹{r.application?.amountRequested?.toLocaleString()}</td>
                  <td style={{ padding: '16px', color: '#495057' }}>{r.application?.tenureMonths} months</td>
                  <td style={{ padding: '16px' }}>{getStatusBadge(r.status)}</td>
                  <td style={{ padding: '16px', fontSize: '13px' }}>
                    {r.decision?.amountApproved ?
                      <div>
                        <div style={{ fontWeight: '700', color: '#001f5c' }}>₹{r.decision.amountApproved.toLocaleString()}</div>
                        <small style={{ color: '#6c757d' }}>{r.decision.rateAPR}% APR, {r.decision.tenureMonths}m</small>
                      </div>
                      : <span style={{ color: '#6c757d' }}>-</span>
                    }
                  </td>
                  <td style={{ padding: '16px' }}>
                    <Button size="sm" variant="outline-primary" onClick={()=>viewDetails(r)} style={{ marginRight: '6px', borderRadius: '6px', fontWeight: '600', fontSize: '12px' }}>View</Button>
                    {r.status==='PENDING' && (
                      <>
                        <Button size="sm" variant="success" onClick={()=>openDecision(r, 'APPROVED')} style={{ marginRight: '6px', borderRadius: '6px', fontWeight: '600', fontSize: '12px' }}>Approve</Button>
                        <Button size="sm" variant="danger" onClick={()=>openDecision(r, 'REJECTED')} style={{ borderRadius: '6px', fontWeight: '600', fontSize: '12px' }}>Reject</Button>
                      </>
                    )}
                    {r.status==='APPROVED' && (
                      <Button size="sm" variant="info" onClick={()=>disburseLoan(r)} style={{ borderRadius: '6px', fontWeight: '600', fontSize: '12px' }}>Disburse</Button>
                    )}
                  </td>
                </tr>
              ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Detail Modal */}
      <Modal show={showDetail} onHide={()=>setShowDetail(false)} size="lg" centered>
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', borderRadius: '16px 16px 0 0', border: 'none' }}>
          <Modal.Title style={{ fontWeight: '700' }}>Loan Application Details</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '30px', background: '#f8f9fa' }}>
          {selectedLoan && (
            <div>
              <Row className="mb-4">
                <Col md={6}>
                  <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)' }}>
                    <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>Personal Information</Card.Header>
                    <Card.Body style={{ padding: '20px' }}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Name:</strong> <span style={{ color: '#495057' }}>{selectedLoan.application?.personal?.name}</span></p>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Email:</strong> <span style={{ color: '#495057' }}>{selectedLoan.application?.personal?.email}</span></p>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Mobile:</strong> <span style={{ color: '#495057' }}>{selectedLoan.application?.personal?.mobile}</span></p>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Address:</strong> <span style={{ color: '#495057' }}>{selectedLoan.application?.personal?.address}</span></p>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Father Name:</strong> <span style={{ color: '#495057' }}>{selectedLoan.application?.personal?.fatherName}</span></p>
                      <p style={{ marginBottom: '0' }}><strong style={{ color: '#001f5c' }}>Mother Name:</strong> <span style={{ color: '#495057' }}>{selectedLoan.application?.personal?.motherName}</span></p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)' }}>
                    <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>Qualification & Employment</Card.Header>
                    <Card.Body style={{ padding: '20px' }}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Education:</strong> <span style={{ color: '#495057' }}>{selectedLoan.application?.qualification?.highestEducation}</span></p>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Stream:</strong> <span style={{ color: '#495057' }}>{selectedLoan.application?.qualification?.stream}</span></p>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Employment Type:</strong> <span style={{ color: '#495057' }}>{selectedLoan.application?.employment?.employmentType}</span></p>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Monthly Income:</strong> <span style={{ color: '#495057' }}>₹{selectedLoan.application?.employment?.monthlyIncome?.toLocaleString()}</span></p>
                      <p style={{ marginBottom: '0' }}><strong style={{ color: '#001f5c' }}>Experience:</strong> <span style={{ color: '#495057' }}>{selectedLoan.application?.employment?.experienceYears} years</span></p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Row className="mb-4">
                <Col md={6}>
                  <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)' }}>
                    <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>Loan Request Details</Card.Header>
                    <Card.Body style={{ padding: '20px' }}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Amount Requested:</strong> <span style={{ color: '#1abc9c', fontWeight: '700', fontSize: '16px' }}>₹{selectedLoan.application?.amountRequested?.toLocaleString()}</span></p>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Tenure:</strong> <span style={{ color: '#495057' }}>{selectedLoan.application?.tenureMonths} months</span></p>
                      <p style={{ marginBottom: '0' }}><strong style={{ color: '#001f5c' }}>Purpose:</strong> <span style={{ color: '#495057' }}>{selectedLoan.application?.purpose}</span></p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)' }}>
                    <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>References</Card.Header>
                    <Card.Body style={{ padding: '20px' }}>
                      {selectedLoan.application?.references && selectedLoan.application.references.length > 0 ? (
                        selectedLoan.application.references.map((ref, i) => (
                          <div key={i} style={{ marginBottom: i < selectedLoan.application.references.length - 1 ? '15px' : '0', paddingBottom: i < selectedLoan.application.references.length - 1 ? '15px' : '0', borderBottom: i < selectedLoan.application.references.length - 1 ? '1px solid #dee2e6' : 'none' }}>
                            <strong style={{ color: '#001f5c', fontSize: '14px' }}>{ref.name}</strong> <span style={{ color: '#6c757d', fontSize: '12px' }}>({ref.relation})</span><br/>
                            <small style={{ color: '#6c757d' }}>📱 {ref.mobile}</small>
                          </div>
                        ))
                      ) : (
                        <span style={{ color: '#6c757d' }}>No references available</span>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {selectedLoan.application?.documents && (
                <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginBottom: '0' }}>
                  <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>Documents</Card.Header>
                  <Card.Body style={{ padding: '20px' }}>
                    <Row>
                      {selectedLoan.application.documents.aadhaarFrontUrl && (
                        <Col md={3} className="mb-2"><a href={selectedLoan.application.documents.aadhaarFrontUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1abc9c', fontWeight: '600', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>📄 Aadhaar Front</a></Col>
                      )}
                      {selectedLoan.application.documents.aadhaarBackUrl && (
                        <Col md={3} className="mb-2"><a href={selectedLoan.application.documents.aadhaarBackUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1abc9c', fontWeight: '600', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>📄 Aadhaar Back</a></Col>
                      )}
                      {selectedLoan.application.documents.panUrl && (
                        <Col md={3} className="mb-2"><a href={selectedLoan.application.documents.panUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1abc9c', fontWeight: '600', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>📄 PAN Card</a></Col>
                      )}
                      {selectedLoan.application.documents.selfieUrl && (
                        <Col md={3} className="mb-2"><a href={selectedLoan.application.documents.selfieUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1abc9c', fontWeight: '600', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>📸 Selfie</a></Col>
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
      <Modal show={showDecision} onHide={()=>setShowDecision(false)} centered>
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', borderRadius: '16px 16px 0 0', border: 'none' }}>
          <Modal.Title style={{ fontWeight: '700' }}>{decisionType === 'APPROVED' ? '✓ Approve' : '✕ Reject'} Loan Application</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '30px', background: '#f8f9fa' }}>
          {decisionType === 'APPROVED' ? (
            <div>
              <Alert variant="info" style={{ background: 'rgba(26, 188, 156, 0.1)', border: '2px solid #1abc9c', borderRadius: '8px', color: '#001f5c', padding: '15px' }}>
                <strong>📋 Application Summary:</strong><br/>
                Amount: <strong>₹{selectedLoan?.application?.amountRequested?.toLocaleString()}</strong> | Tenure: <strong>{selectedLoan?.application?.tenureMonths} months</strong>
              </Alert>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontWeight: '700', color: '#001f5c' }}>Approved Amount (₹)</Form.Label>
                <Form.Control
                  type="number"
                  value={decisionForm.amountApproved}
                  onChange={(e)=>setDecisionForm({...decisionForm, amountApproved: e.target.value})}
                  style={{ borderRadius: '8px', border: '2px solid #dee2e6', padding: '10px' }}
                />
              </Form.Group>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label style={{ fontWeight: '700', color: '#001f5c' }}>Interest Rate (APR %)</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.1"
                      value={decisionForm.rateAPR}
                      onChange={(e)=>setDecisionForm({...decisionForm, rateAPR: e.target.value})}
                      style={{ borderRadius: '8px', border: '2px solid #dee2e6', padding: '10px' }}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label style={{ fontWeight: '700', color: '#001f5c' }}>Tenure (months)</Form.Label>
                    <Form.Control
                      type="number"
                      value={decisionForm.tenureMonths}
                      onChange={(e)=>setDecisionForm({...decisionForm, tenureMonths: e.target.value})}
                      style={{ borderRadius: '8px', border: '2px solid #dee2e6', padding: '10px' }}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </div>
          ) : (
            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: '700', color: '#001f5c' }}>Rejection Remarks</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={decisionForm.remarks}
                onChange={(e)=>setDecisionForm({...decisionForm, remarks: e.target.value})}
                placeholder="Please provide reason for rejection..."
                style={{ borderRadius: '8px', border: '2px solid #dee2e6', padding: '10px' }}
              />
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid #dee2e6', padding: '20px', background: '#f8f9fa' }}>
          <Button variant="secondary" onClick={()=>setShowDecision(false)} style={{ borderRadius: '8px', fontWeight: '600' }}>Cancel</Button>
          <Button
            variant={decisionType === 'APPROVED' ? 'success' : 'danger'}
            onClick={submitDecision}
            disabled={loading}
            style={{ borderRadius: '8px', fontWeight: '600' }}
          >
            {loading ? 'Processing...' : (decisionType === 'APPROVED' ? '✓ Approve Loan' : '✕ Reject Loan')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}