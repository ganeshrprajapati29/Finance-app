import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Modal, Form, Alert, Badge, Spinner } from 'react-bootstrap';
import { DollarSign, Calendar, User, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import api from '../api/axios';

export default function LoanSettlement() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementData, setSettlementData] = useState({
    settlementAmount: '',
    reason: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchOverdueLoans = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/settlements/loans/overdue');
      setLoans(response.data.data);
    } catch (error) {
      console.error('Error fetching overdue loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettlementOffer = async () => {
    if (!settlementData.settlementAmount || !settlementData.reason) {
      alert('Please fill in all required fields');
      return;
    }

    if (parseFloat(settlementData.settlementAmount) > selectedLoan.outstandingAmount) {
      alert('Settlement amount cannot be greater than outstanding amount');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(`/admin/settlements/loans/${selectedLoan._id}/settlement`, {
        settlementAmount: parseFloat(settlementData.settlementAmount),
        reason: settlementData.reason,
        notes: settlementData.notes
      });

      if (response.data.success) {
        alert('Settlement completed successfully! Loan has been closed.');
        setShowSettlementModal(false);
        setSettlementData({ settlementAmount: '', reason: '', notes: '' });
        setSelectedLoan(null);
        fetchOverdueLoans();
      } else {
        alert('Failed to complete settlement: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating settlement:', error);
      alert('Failed to complete settlement: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'overdue':
        return <Badge bg="danger">Overdue</Badge>;
      case 'defaulted':
        return <Badge bg="dark">Defaulted</Badge>;
      case 'active':
        return <Badge bg="warning">Active</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  const calculateDaysOverdue = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today - due;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  useEffect(() => {
    fetchOverdueLoans();
  }, []);

  return (
    <Container fluid>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Loan Settlement</h2>
        <Button variant="primary" onClick={fetchOverdueLoans} disabled={loading}>
          {loading ? <Spinner size="sm" /> : <AlertTriangle size={16} />}
          {' '}Refresh
        </Button>
      </div>

      <Card>
        <Card.Header>
          <h5 className="mb-0">Overdue Loans</h5>
          <small className="text-muted">Loans that require settlement offers</small>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
              <p className="mt-2">Loading overdue loans...</p>
            </div>
          ) : loans.length === 0 ? (
            <Alert variant="info" className="text-center">
              No overdue loans found.
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead className="table-dark">
                  <tr>
                    <th>Loan ID</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                    <th>Days Overdue</th>
                    <th>Last Payment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan) => (
                    <tr key={loan._id}>
                      <td>{loan._id.slice(-8)}</td>
                      <td>
                        <div>
                          <strong>{loan.userId?.name || 'N/A'}</strong>
                          <br />
                          <small className="text-muted">{loan.userId?.email || 'N/A'}</small>
                        </div>
                      </td>
                      <td>₹{loan.decision?.amountApproved || 0}</td>
                      <td>₹{loan.outstandingAmount || 0}</td>
                      <td>{getStatusBadge(loan.status)}</td>
                      <td>
                        <span className={calculateDaysOverdue(loan.nextPaymentDate) > 30 ? 'text-danger fw-bold' : 'text-warning fw-bold'}>
                          {calculateDaysOverdue(loan.nextPaymentDate)} days
                        </span>
                      </td>
                      <td>
                        {loan.lastPaymentDate ? new Date(loan.lastPaymentDate).toLocaleDateString() : 'Never'}
                      </td>
                      <td>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => {
                            setSelectedLoan(loan);
                            setShowSettlementModal(true);
                          }}
                        >
                          <DollarSign size={14} />
                          {' '}Offer Settlement
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Settlement Modal */}
      <Modal show={showSettlementModal} onHide={() => setShowSettlementModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Create Settlement Offer</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedLoan && (
            <div className="mb-3">
              <Alert variant="warning">
                <strong>Loan Details:</strong>
                <br />
                User: {selectedLoan.userId?.name} ({selectedLoan.userId?.email})
                <br />
                Loan Amount: ₹{selectedLoan.decision?.amountApproved || 0}
                <br />
                Outstanding: ₹{selectedLoan.outstandingAmount || 0}
                <br />
                Days Overdue: {calculateDaysOverdue(selectedLoan.nextPaymentDate)}
              </Alert>

              <Form>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Settlement Amount *</Form.Label>
                      <Form.Control
                        type="number"
                        placeholder="Enter settlement amount"
                        value={settlementData.settlementAmount}
                        onChange={(e) => setSettlementData(prev => ({ ...prev, settlementAmount: e.target.value }))}
                        required
                      />
                      <Form.Text className="text-muted">
                        Amount user needs to pay to close the loan
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Reason *</Form.Label>
                      <Form.Select
                        value={settlementData.reason}
                        onChange={(e) => setSettlementData(prev => ({ ...prev, reason: e.target.value }))}
                        required
                      >
                        <option value="">Select reason</option>
                        <option value="financial_hardship">Financial Hardship</option>
                        <option value="negotiation">Negotiation</option>
                        <option value="legal_risk">Legal Risk</option>
                        <option value="goodwill">Goodwill Settlement</option>
                        <option value="other">Other</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className="mb-3">
                  <Form.Label>Notes</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Additional notes about the settlement"
                    value={settlementData.notes}
                    onChange={(e) => setSettlementData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </Form.Group>
              </Form>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSettlementModal(false)}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSettlementOffer}
            disabled={submitting}
          >
            {submitting ? <Spinner size="sm" /> : <CheckCircle size={16} />}
            {' '}Send Settlement Offer
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
