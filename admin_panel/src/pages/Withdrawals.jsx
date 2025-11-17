import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { Table, Card, Row, Col, Badge, Button, Modal, Form, Spinner, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';

const Withdrawals = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [actionType, setActionType] = useState('');
  const [formData, setFormData] = useState({
    txnId: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadWithdrawals();
  }, [filterStatus]);

  const loadWithdrawals = async () => {
    setLoading(true);
    try {
      let url = '/admin/withdrawals';
      if (filterStatus !== 'ALL') url += `?status=${filterStatus}`;
      
      const response = await axios.get(url);
      const responseData = response.data.data || response.data;
      setWithdrawals(responseData.items || responseData.data || []);
    } catch (error) {
      console.error('Error loading withdrawals:', error);
      setWithdrawals([]);
      toast.error('❌ Error loading withdrawals');
    } finally {
      setLoading(false);
    }
  };

  const openDecisionModal = (withdrawal, type) => {
    setSelectedWithdrawal(withdrawal);
    setActionType(type);
    setFormData({ txnId: '', notes: '' });
    setShowModal(true);
  };

  const handleDecision = async () => {
    if (actionType === 'APPROVED' && !formData.txnId.trim()) {
      toast.error('❌ Transaction ID is required for approval');
      return;
    }

    if (actionType === 'REJECTED' && !formData.notes.trim()) {
      toast.error('❌ Rejection notes are required');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`/admin/withdrawals/${selectedWithdrawal._id}/decision`, {
        decision: actionType,
        txnId: formData.txnId,
        notes: formData.notes,
      });
      toast.success(`✅ Withdrawal ${actionType.toLowerCase()} successfully`);
      setShowModal(false);
      loadWithdrawals();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      toast.error('❌ ' + (error.response?.data?.message || 'Error processing withdrawal'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      'PENDING': 'warning',
      'APPROVED': 'success',
      'REJECTED': 'danger',
      'PROCESSING': 'info',
      'COMPLETED': 'success'
    };
    const icons = {
      'PENDING': '⏳',
      'APPROVED': '✅',
      'REJECTED': '❌',
      'PROCESSING': '⚙️',
      'COMPLETED': '✔️'
    };
    return (
      <Badge bg={variants[status] || 'secondary'} style={{ padding: '8px 12px', borderRadius: '6px', fontWeight: '600' }}>
        {icons[status]} {status}
      </Badge>
    );
  };

  const getStats = () => {
    const withdrawalsArray = Array.isArray(withdrawals) ? withdrawals : [];
    return {
      total: withdrawalsArray.length,
      pending: withdrawalsArray.filter(w => w.status === 'PENDING').length,
      approved: withdrawalsArray.filter(w => w.status === 'APPROVED').length,
      rejected: withdrawalsArray.filter(w => w.status === 'REJECTED').length,
      totalAmount: withdrawalsArray.reduce((sum, w) => sum + (w.amount || 0), 0)
    };
  };

  const filteredWithdrawals = filterStatus === 'ALL'
    ? (Array.isArray(withdrawals) ? withdrawals : [])
    : (Array.isArray(withdrawals) ? withdrawals.filter(w => w.status === filterStatus) : []);

  const stats = getStats();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spinner animation="border" style={{ color: '#1abc9c' }} />
      </div>
    );
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
                💸
              </div>
              <div>
                <h2 style={{ margin: 0, fontWeight: '700', fontSize: '28px' }}>Withdrawal Requests</h2>
                <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>KhatuPay - Manage User Withdrawals</p>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Statistics Cards */}
      <Row className="mb-4" style={{ display: 'flex', gap: '15px' }}>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(26, 188, 156, 0.1) 0%, rgba(22, 160, 133, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#1abc9c', marginBottom: '8px' }}>{stats.total}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>📋 Total Requests</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#ffc107', marginBottom: '8px' }}>{stats.pending}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>⏳ Pending</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(32, 130, 55, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#28a745', marginBottom: '8px' }}>{stats.approved}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>✅ Approved</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(220, 53, 69, 0.1) 0%, rgba(200, 35, 51, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#dc3545', marginBottom: '8px' }}>{stats.rejected}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>❌ Rejected</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(23, 162, 184, 0.1) 0%, rgba(20, 130, 155, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#17a2b8', marginBottom: '8px' }}>₹{(stats.totalAmount / 100000).toFixed(1)}L</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>💰 Total Amount</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filter Card */}
      <Card style={{
        border: 'none',
        borderRadius: '16px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)',
        marginBottom: '25px',
        overflow: 'hidden'
      }}>
        <Card.Body style={{ padding: '20px', background: '#f8f9fa' }}>
          <Row className="g-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '8px' }}>Filter by Status</Form.Label>
                <Form.Select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ 
                    borderRadius: '8px', 
                    border: '2px solid #dee2e6', 
                    padding: '10px 12px',
                    fontWeight: '500'
                  }}
                >
                  <option value="ALL">All Requests</option>
                  <option value="PENDING">⏳ Pending</option>
                  <option value="APPROVED">✅ Approved</option>
                  <option value="REJECTED">❌ Rejected</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Withdrawals Table */}
      <Card style={{
        border: 'none',
        borderRadius: '16px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)',
        overflow: 'hidden'
      }}>
        <Card.Header style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', padding: '20px', fontWeight: '700', fontSize: '16px' }}>
          💸 All Withdrawal Requests
        </Card.Header>
        <Card.Body style={{ padding: '0' }}>
          {filteredWithdrawals.length === 0 ? (
            <Alert variant="info" style={{ margin: '30px', borderRadius: '8px' }}>
              📭 No withdrawal requests found
            </Alert>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table striped hover responsive style={{ marginBottom: '0' }}>
                <thead style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', borderBottom: '2px solid #dee2e6' }}>
                  <tr>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>User Details</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Amount</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Bank Details</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Date</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Status</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWithdrawals.map((withdrawal) => (
                    <tr key={withdrawal._id} style={{ borderBottom: '1px solid #dee2e6', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: '700', color: '#001f5c', marginBottom: '4px' }}>👤 {withdrawal.userId?.name}</div>
                        <div style={{ color: '#6c757d', fontSize: '13px', marginBottom: '4px' }}>📧 {withdrawal.userId?.email}</div>
                        <div style={{ color: '#6c757d', fontSize: '13px', marginBottom: '4px' }}>📱 Mobile: {withdrawal.userId?.mobile}</div>
                        <div style={{ color: '#6c757d', fontSize: '13px', marginBottom: '4px' }}>💳 Loan Limit: ₹{(withdrawal.userId?.loanLimit?.amount || withdrawal.userId?.loanLimit || 0).toLocaleString()}</div>
                        <div style={{ color: '#6c757d', fontSize: '13px' }}>💰 Wallet Balance: ₹{(withdrawal.userId?.walletBalance || 0).toLocaleString()}</div>
                      </td>
                      <td style={{ padding: '16px', fontWeight: '700', color: '#1abc9c', fontSize: '16px' }}>
                        ₹{withdrawal.amount?.toLocaleString()}
                      </td>
                      <td style={{ padding: '16px', fontSize: '13px' }}>
                        <div style={{ marginBottom: '6px' }}><strong style={{ color: '#001f5c' }}>🏦 Bank:</strong> <span style={{ color: '#495057' }}>{withdrawal.bankDetails?.bankName}</span></div>
                        <div style={{ marginBottom: '6px' }}><strong style={{ color: '#001f5c' }}>🔢 Account:</strong> <span style={{ color: '#495057' }}>****{withdrawal.bankDetails?.accountNumber?.slice(-4)}</span></div>
                        <div style={{ marginBottom: '6px' }}><strong style={{ color: '#001f5c' }}>📌 IFSC:</strong> <span style={{ color: '#495057' }}>{withdrawal.bankDetails?.ifscCode}</span></div>
                        <div><strong style={{ color: '#001f5c' }}>👤 Holder:</strong> <span style={{ color: '#495057' }}>{withdrawal.bankDetails?.accountHolderName}</span></div>
                      </td>
                      <td style={{ padding: '16px', color: '#495057', fontSize: '13px', fontWeight: '600' }}>
                        🕐 {new Date(withdrawal.createdAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ marginBottom: '8px' }}>
                          {getStatusBadge(withdrawal.status)}
                        </div>
                        {withdrawal.txnId && (
                          <div style={{ marginTop: '6px', padding: '6px', background: '#e9ecef', borderRadius: '4px', fontSize: '11px', color: '#6c757d' }}>
                            <strong>TXN:</strong> {withdrawal.txnId}
                          </div>
                        )}
                        {withdrawal.notes && (
                          <div style={{ marginTop: '6px', padding: '6px', background: '#fff3cd', borderRadius: '4px', fontSize: '11px', color: '#856404' }}>
                            <strong>Note:</strong> {withdrawal.notes}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px' }}>
                        {withdrawal.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <Button 
                              size="sm" 
                              variant="outline-success"
                              onClick={() => openDecisionModal(withdrawal, 'APPROVED')}
                              style={{ borderRadius: '6px', fontWeight: '600', fontSize: '12px' }}
                            >
                              ✅ Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline-danger"
                              onClick={() => openDecisionModal(withdrawal, 'REJECTED')}
                              style={{ borderRadius: '6px', fontWeight: '600', fontSize: '12px' }}
                            >
                              ❌ Reject
                            </Button>
                          </div>
                        )}
                        {withdrawal.status !== 'PENDING' && (
                          <span style={{ color: '#6c757d', fontSize: '13px' }}>—</span>
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

      {/* Decision Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', border: 'none' }}>
          <Modal.Title style={{ fontWeight: '700' }}>
            {actionType === 'APPROVED' ? '✅ Approve' : '❌ Reject'} Withdrawal
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '30px', background: '#f8f9fa' }}>
          {selectedWithdrawal && (
            <>
              <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginBottom: '20px' }}>
                <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>
                  💸 Withdrawal Details
                </Card.Header>
                <Card.Body style={{ padding: '20px' }}>
                  <Row>
                    <Col md={6}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Amount:</strong></p>
                      <p style={{ color: '#1abc9c', fontWeight: '700', fontSize: '18px' }}>₹{selectedWithdrawal.amount?.toLocaleString()}</p>
                    </Col>
                    <Col md={6}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>User:</strong></p>
                      <p style={{ color: '#495057', fontWeight: '600' }}>{selectedWithdrawal.userId?.name}</p>
                    </Col>
                  </Row>
                  <Row style={{ marginTop: '12px' }}>
                    <Col md={6}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Account:</strong></p>
                      <p style={{ color: '#495057', fontSize: '13px' }}>****{selectedWithdrawal.bankDetails?.accountNumber?.slice(-4)}</p>
                    </Col>
                    <Col md={6}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Bank:</strong></p>
                      <p style={{ color: '#495057', fontSize: '13px' }}>{selectedWithdrawal.bankDetails?.bankName}</p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {actionType === 'APPROVED' ? (
                <Form.Group className="mb-0">
                  <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px' }}>📤 Transaction ID</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.txnId}
                    onChange={(e) => setFormData({ ...formData, txnId: e.target.value })}
                    placeholder="Enter transaction ID"
                    style={{ borderRadius: '8px', border: '2px solid #dee2e6', padding: '10px 12px', fontWeight: '500' }}
                  />
                  <Form.Text style={{ color: '#6c757d', marginTop: '8px', display: 'block' }}>
                    Enter the transaction ID from your payment gateway
                  </Form.Text>
                </Form.Group>
              ) : (
                <Form.Group className="mb-0">
                  <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px' }}>📝 Rejection Reason</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Enter reason for rejection"
                    style={{ borderRadius: '8px', border: '2px solid #dee2e6', padding: '10px 12px', fontWeight: '500' }}
                  />
                  <Form.Text style={{ color: '#6c757d', marginTop: '8px', display: 'block' }}>
                    This will be sent to the user
                  </Form.Text>
                </Form.Group>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid #dee2e6', padding: '20px', background: '#f8f9fa' }}>
          <Button 
            variant="secondary" 
            onClick={() => setShowModal(false)}
            style={{ borderRadius: '8px', fontWeight: '600' }}
          >
            Cancel
          </Button>
          <Button 
            variant={actionType === 'APPROVED' ? 'success' : 'danger'}
            onClick={handleDecision}
            disabled={submitting}
            style={{ 
              borderRadius: '8px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {submitting ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                Processing...
              </>
            ) : (
              <>
                {actionType === 'APPROVED' ? '✅ Approve' : '❌ Reject'}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Withdrawals;