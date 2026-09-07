import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Badge, Button, Form, Tab, Tabs, Modal, Alert } from 'react-bootstrap';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, User, Mail, Phone, MapPin, Calendar, Shield,
  CreditCard, Wallet, FileText, Activity, MessageSquare,
  Edit, Lock, Bell, AlertTriangle, CheckCircle, XCircle,
  Clock, TrendingUp, DollarSign, Banknote, RefreshCw,
  Download, Eye, MoreVertical, Filter, Search, Building, KeyRound
} from 'lucide-react';
import api from '../api/axios';

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchUserDetail();
  }, [id]);

  const fetchUserDetail = async () => {
    try {
      const [userRes, transactionsRes, loansRes] = await Promise.all([
        api.get(`/admin/users/${id}`),
        api.get(`/admin/users/${id}/transactions?page=${page}&limit=10`),
        api.get(`/admin/users/${id}/loans`)
      ]);

      setUser(userRes.data?.data || userRes.data?.user || userRes.data);
      setTransactions(transactionsRes.data?.data?.items || transactionsRes.data?.transactions || []);
      setLoans(loansRes.data?.data || loansRes.data?.loans || []);
    } catch (error) {
      console.error('Error fetching user detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async () => {
    try {
      const nextStatus = user.status === 'active' ? 'blocked' : 'active';
      await api.put(`/admin/users/${id}/status`, { status: nextStatus });
      fetchUserDetail();
      setShowActionModal(false);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleResetPassword = async () => {
    try {
      const res = await api.post(`/admin/users/${id}/reset-password`, {});
      const tempPassword = res.data?.data?.tempPassword;
      alert(tempPassword ? `Temporary password: ${tempPassword}` : 'Password reset successfully');
      setShowActionModal(false);
    } catch (error) {
      console.error('Error resetting password:', error);
    }
  };

  const handleResetPin = async () => {
    try {
      await api.post(`/admin/users/${id}/reset-pin`, {});
      alert('User PIN cleared. They will be asked to set a new PIN via Forgot PIN on next login.');
      setShowActionModal(false);
      fetchUserDetail();
    } catch (error) {
      console.error('Error resetting PIN:', error);
      alert(error.response?.data?.message || 'Failed to reset PIN');
    }
  };

  const getPinStatusBadge = (pinStatus) => {
    const colors = { SET: 'success', NOT_SET: 'secondary', LOCKED: 'danger' };
    const labels = { SET: 'PIN Set', NOT_SET: 'PIN Not Set', LOCKED: 'PIN Locked' };
    return <Badge bg={colors[pinStatus] || 'secondary'}>{labels[pinStatus] || 'PIN Unknown'}</Badge>;
  };

  const handleKycReview = async (docIndex, status) => {
    try {
      await api.put(`/kyc/users/${id}/review`, { docIndex, status, notes: actionNote || '' });
      setActionNote('');
      await fetchUserDetail();
    } catch (error) {
      console.error('Error reviewing KYC:', error);
      alert(error.response?.data?.message || 'Failed to update KYC');
    }
  };

  const handleKycReviewAll = async (status) => {
    try {
      await api.put(`/kyc/users/${id}/review-all`, { status, notes: actionNote || '' });
      setActionNote('');
      await fetchUserDetail();
    } catch (error) {
      console.error('Error reviewing all KYC:', error);
      alert(error.response?.data?.message || 'Failed to update KYC');
    }
  };

  const getKYCBadge = (status) => {
    const normalized = (status || '').toString().toLowerCase();
    const colors = { verified: 'success', approved: 'success', pending: 'warning', rejected: 'danger', submitted: 'info' };
    return <Badge bg={colors[normalized] || 'secondary'}>{status || 'Not Submitted'}</Badge>;
  };

  const getStatusBadge = (status) => {
    const colors = { success: 'success', pending: 'warning', failed: 'danger', processing: 'info' };
    return <Badge bg={colors[status] || 'secondary'}>{status || 'N/A'}</Badge>;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
  };

  const kycDocs = user?.kyc?.docs || user?.kyc?.documents || [];

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <div className="text-center">
          <RefreshCw className="spin" size={40} />
          <p className="mt-2">Loading user details...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-fluid p-4">
        <Alert variant="danger">
          User not found. <Button variant="link" onClick={() => navigate('/users')}>Go Back</Button>
        </Alert>
      </div>
    );
  }

  // Filter transactions
  const filteredTransactions = transactions.filter(txn => {
    const matchesSearch = searchTerm === '' || 
      txn.transactionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      txn.amount?.toString().includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || txn.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-3">
          <Button variant="light" onClick={() => navigate('/users')} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h4 className="mb-0">User Details</h4>
            <small className="text-muted">ID: {user._id}</small>
          </div>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" onClick={() => { setActionType('notification'); setShowActionModal(true); }}>
            <Bell size={16} className="me-1" /> Send Notification
          </Button>
          <Button variant="outline-warning" onClick={() => { setActionType('reset'); setShowActionModal(true); }}>
            <Lock size={16} className="me-1" /> Reset Password
          </Button>
          <Button variant="outline-warning" onClick={() => { setActionType('reset-pin'); setShowActionModal(true); }}>
            <KeyRound size={16} className="me-1" /> Reset PIN
          </Button>
          <Button variant={user.status === 'active' ? 'outline-danger' : 'outline-success'} onClick={() => { setActionType('status'); setShowActionModal(true); }}>
            {user.status === 'active' ? <><AlertTriangle size={16} className="me-1" /> Freeze Account</> : <><CheckCircle size={16} className="me-1" /> Activate Account</>}
          </Button>
        </div>
      </div>

      {/* Main Profile Card */}
      <Row className="mb-4">
        <Col lg={4}>
          <Card className="border-0 shadow-sm" style={{ borderRadius: '16px' }}>
            <Card.Body className="text-center p-4">
              <div 
                style={{ 
                  width: '100px', 
                  height: '100px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #0066FF, #00B366)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontSize: '36px',
                  fontWeight: 'bold',
                  color: 'white'
                }}
              >
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <h4 className="mb-1">{user.name}</h4>
              <p className="text-muted mb-2">{user.email || 'No email'}</p>
              <div className="d-flex justify-content-center gap-2 mb-3">
                {getKYCBadge(user.kyc?.status)}
                <Badge bg={user.status === 'active' ? 'success' : 'danger'}>
                  {user.status === 'active' ? 'Active' : 'Blocked'}
                </Badge>
                {getPinStatusBadge(user.pinStatus)}
              </div>
              
              <div className="text-start mt-4">
                <div className="d-flex align-items-center mb-3">
                  <Phone size={16} className="text-muted me-3" />
                  <div>
                    <small className="text-muted d-block">Phone</small>
                    <strong>{user.mobile || user.phone || 'N/A'}</strong>
                  </div>
                </div>
                <div className="d-flex align-items-center mb-3">
                  <Mail size={16} className="text-muted me-3" />
                  <div>
                    <small className="text-muted d-block">Email</small>
                    <strong>{user.email || 'Not provided'}</strong>
                  </div>
                </div>
                <div className="d-flex align-items-center mb-3">
                  <MapPin size={16} className="text-muted me-3" />
                  <div>
                    <small className="text-muted d-block">Address</small>
                    <strong>{user.address?.city || 'Not provided'}, {user.address?.state}</strong>
                  </div>
                </div>
                <div className="d-flex align-items-center mb-3">
                  <Calendar size={16} className="text-muted me-3" />
                  <div>
                    <small className="text-muted d-block">Member Since</small>
                    <strong>{formatDate(user.createdAt)}</strong>
                  </div>
                </div>
                <div className="d-flex align-items-center mb-3">
                  <Clock size={16} className="text-muted me-3" />
                  <div>
                    <small className="text-muted d-block">Last Login</small>
                    <strong>{formatDate(user.lastLoginAt)}</strong>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={8}>
          {/* Statistics Cards */}
          <Row className="mb-4">
            <Col md={3}>
              <Card className="border-0 shadow-sm" style={{ borderRadius: '16px' }}>
                <Card.Body className="text-center p-3">
                  <div style={{ background: 'rgba(0, 102, 255, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Wallet size={24} color="#0066FF" />
                  </div>
                  <h5 className="mb-0">{formatCurrency(user.walletBalance)}</h5>
                  <small className="text-muted">Wallet Balance</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="border-0 shadow-sm" style={{ borderRadius: '16px' }}>
                <Card.Body className="text-center p-3">
                  <div style={{ background: 'rgba(0, 179, 102, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <CreditCard size={24} color="#00B366" />
                  </div>
                  <h5 className="mb-0">{loans.length}</h5>
                  <small className="text-muted">Total Loans</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="border-0 shadow-sm" style={{ borderRadius: '16px' }}>
                <Card.Body className="text-center p-3">
                  <div style={{ background: 'rgba(255, 159, 0, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Activity size={24} color="#FF9F00" />
                  </div>
                  <h5 className="mb-0">{transactions.length}</h5>
                  <small className="text-muted">Transactions</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="border-0 shadow-sm" style={{ borderRadius: '16px' }}>
                <Card.Body className="text-center p-3">
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Banknote size={24} color="#EF4444" />
                  </div>
                  <h5 className="mb-0">{formatCurrency(user.kyc?.totalSpent || 0)}</h5>
                  <small className="text-muted">Total Spent</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* KYC Information Card */}
          <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '16px' }}>
            <Card.Body className="p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0"><Shield size={20} className="me-2" />KYC Information</h5>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  {kycDocs.length > 0 && (
                    <>
                      <Button variant="outline-success" size="sm" onClick={() => handleKycReviewAll('APPROVED')}>
                        <CheckCircle size={14} className="me-1" /> Approve All
                      </Button>
                      <Button variant="outline-danger" size="sm" onClick={() => handleKycReviewAll('REJECTED')}>
                        <XCircle size={14} className="me-1" /> Reject All
                      </Button>
                    </>
                  )}
                  {getKYCBadge(user.kyc?.status)}
                </div>
              </div>
              <Row>
                <Col md={6}>
                  <div className="mb-3">
                    <small className="text-muted d-block">KYC Number</small>
                    <strong>{user.kyc?.kycNumber || 'Generated after approval'}</strong>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="mb-3">
                    <small className="text-muted d-block">Approved At</small>
                    <strong>{formatDate(user.kyc?.approvedAt)}</strong>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="mb-3">
                    <small className="text-muted d-block">Aadhaar Number</small>
                    <strong>{user.kyc?.aadhaarNumber ? `XXXX-XXXX-${user.kyc.aadhaarNumber.slice(-4)}` : 'Not submitted'}</strong>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="mb-3">
                    <small className="text-muted d-block">PAN Number</small>
                    <strong>{user.kyc?.panNumber || 'Not submitted'}</strong>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="mb-3">
                    <small className="text-muted d-block">Date of Birth</small>
                    <strong>{user.kyc?.dob || 'Not submitted'}</strong>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="mb-3">
                    <small className="text-muted d-block">Occupation</small>
                    <strong>{user.kyc?.occupation || 'Not submitted'}</strong>
                  </div>
                </Col>
              </Row>
              {kycDocs.length > 0 && (
                <div className="mt-3">
                  <small className="text-muted d-block mb-2">Documents</small>
                  <div className="d-grid gap-2">
                    {kycDocs.map((doc, idx) => (
                      <div key={idx} className="border rounded-3 p-3 bg-light">
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                          <div>
                            <strong>{doc.documentType || doc.type || 'Document'}</strong>
                            <div className="text-muted small">
                              {doc.documentNumber || 'No document number'} {doc.originalName ? ` - ${doc.originalName}` : ''}
                            </div>
                            {doc.notes && <div className="small text-danger mt-1">{doc.notes}</div>}
                          </div>
                          <Badge bg={doc.status === 'APPROVED' ? 'success' : doc.status === 'REJECTED' ? 'danger' : 'warning'}>
                            {doc.status || 'PENDING'}
                          </Badge>
                        </div>
                        <div className="d-flex flex-wrap gap-2 mt-3">
                          {doc.url && (
                            <Button as="a" href={doc.url} target="_blank" rel="noreferrer" variant="outline-primary" size="sm">
                              <Eye size={14} className="me-1" /> View
                            </Button>
                          )}
                          <Button variant="outline-success" size="sm" onClick={() => handleKycReview(idx, 'APPROVED')}>
                            <CheckCircle size={14} className="me-1" /> Approve
                          </Button>
                          <Button variant="outline-danger" size="sm" onClick={() => handleKycReview(idx, 'REJECTED')}>
                            <XCircle size={14} className="me-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Bank Details */}
          <Card className="border-0 shadow-sm" style={{ borderRadius: '16px' }}>
            <Card.Body className="p-4">
              <h5 className="mb-3"><Building size={20} className="me-2" />Bank Details</h5>
              {user.bankDetails ? (
                <Row>
                  <Col md={6}>
                    <div className="mb-3">
                      <small className="text-muted d-block">Bank Name</small>
                      <strong>{user.bankDetails.bankName}</strong>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="mb-3">
                      <small className="text-muted d-block">Account Number</small>
                      <strong>XXXX-XXXX-{user.bankDetails.accountNumber?.slice(-4)}</strong>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="mb-3">
                      <small className="text-muted d-block">IFSC Code</small>
                      <strong>{user.bankDetails.ifscCode}</strong>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="mb-3">
                      <small className="text-muted d-block">Account Holder</small>
                      <strong>{user.bankDetails.accountHolderName}</strong>
                    </div>
                  </Col>
                </Row>
              ) : (
                <p className="text-muted">No bank details submitted</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Tabs for detailed information */}
      <Card className="border-0 shadow-sm" style={{ borderRadius: '16px' }}>
        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="border-bottom px-3 pt-2">
          <Tab eventKey="profile" title={<><FileText size={16} className="me-1" /> Profile Details</>}>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <h6 className="text-muted mb-3">Personal Information</h6>
                  <div className="mb-3">
                    <small className="text-muted d-block">Full Name</small>
                    <strong>{user.name}</strong>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block">Phone Number</small>
                    <strong>{user.mobile || user.phone || 'N/A'}</strong>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block">Email Address</small>
                    <strong>{user.email || 'Not provided'}</strong>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block">Date of Birth</small>
                    <strong>{user.dob || 'Not provided'}</strong>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block">Gender</small>
                    <strong>{user.gender || 'Not provided'}</strong>
                  </div>
                </Col>
                <Col md={6}>
                  <h6 className="text-muted mb-3">Address Information</h6>
                  <div className="mb-3">
                    <small className="text-muted d-block">Full Address</small>
                    <strong>{user.address?.fullAddress || 'Not provided'}</strong>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block">City</small>
                    <strong>{user.address?.city || 'Not provided'}</strong>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block">State</small>
                    <strong>{user.address?.state || 'Not provided'}</strong>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block">PIN Code</small>
                    <strong>{user.address?.pincode || 'Not provided'}</strong>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Tab>

          <Tab eventKey="transactions" title={<><CreditCard size={16} className="me-1" /> Transactions ({transactions.length})</>}>
            <Card.Body>
              {/* Filters */}
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Control 
                    type="text" 
                    placeholder="Search by transaction ID or amount..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </Col>
                <Col md={3}>
                  <Form.Select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="success">Success</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Button variant="outline-primary">
                    <Download size={16} className="me-1" /> Export CSV
                  </Button>
                </Col>
              </Row>

              {/* Transactions Table */}
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((txn) => (
                      <tr key={txn._id}>
                        <td>
                          <code className="text-primary">{txn.transactionId?.slice(-10) || txn._id?.slice(-10)}</code>
                        </td>
                        <td>
                          <Badge bg="light" text="dark">{txn.type || 'N/A'}</Badge>
                        </td>
                        <td>
                          <strong className={txn.type === 'credit' ? 'text-success' : 'text-danger'}>
                            {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                          </strong>
                        </td>
                        <td>{getStatusBadge(txn.status)}</td>
                        <td>{formatDate(txn.createdAt)}</td>
                        <td>
                          <Button variant="link" size="sm">View</Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">
                        No transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Tab>

          <Tab eventKey="loans" title={<><Banknote size={16} className="me-1" /> Loans ({loans.length})</>}>
            <Card.Body>
              {loans.length > 0 ? (
                loans.map((loan) => (
                  <Card key={loan._id} className="mb-3 border" style={{ borderRadius: '12px' }}>
                    <Card.Body>
                      <Row className="align-items-center">
                        <Col md={3}>
                          <small className="text-muted d-block">Loan ID</small>
                          <code className="text-primary">{loan._id?.slice(-8)}</code>
                        </Col>
                        <Col md={2}>
                          <small className="text-muted d-block">Amount</small>
                          <strong>{formatCurrency(loan.amount)}</strong>
                        </Col>
                        <Col md={2}>
                          <small className="text-muted d-block">Interest</small>
                          <strong>{loan.interestRate}%</strong>
                        </Col>
                        <Col md={2}>
                          <small className="text-muted d-block">Status</small>
                          <Badge bg={loan.status === 'active' ? 'success' : loan.status === 'pending' ? 'warning' : 'secondary'}>
                            {loan.status}
                          </Badge>
                        </Col>
                        <Col md={2}>
                          <small className="text-muted d-block">Due Date</small>
                          <strong>{formatDate(loan.dueDate)}</strong>
                        </Col>
                        <Col md={1}>
                          <Button variant="outline-primary" size="sm">View</Button>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                ))
              ) : (
                <div className="text-center py-4 text-muted">
                  <Banknote size={48} className="mb-3 opacity-50" />
                  <p>No loans found for this user</p>
                </div>
              )}
            </Card.Body>
          </Tab>

          <Tab eventKey="activity" title={<><Activity size={16} className="me-1" /> Activity Log</>}>
            <Card.Body>
              <div className="timeline">
                {[
                  { action: 'Account Created', date: user.createdAt, icon: User, color: '#0066FF' },
                  { action: 'KYC Submitted', date: user.kyc?.submittedAt, icon: Shield, color: '#00B366' },
                  { action: 'Last Login', date: user.lastLoginAt, icon: Clock, color: '#FF9F00' },
                ].filter(item => item.date).map((item, idx) => (
                  <div key={idx} className="d-flex align-items-start mb-3">
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      background: `${item.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '16px',
                      flexShrink: 0
                    }}>
                      <item.icon size={18} color={item.color} />
                    </div>
                    <div className="flex-grow-1">
                      <strong>{item.action}</strong>
                      <small className="text-muted d-block">{formatDate(item.date)}</small>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Tab>

          <Tab eventKey="notes" title={<><MessageSquare size={16} className="me-1" /> Notes</>}>
            <Card.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Control 
                    as="textarea" 
                    rows={4} 
                    placeholder="Add a note about this user..."
                    defaultValue={user.adminNotes || ''}
                  />
                </Form.Group>
                <Button variant="primary">Save Note</Button>
              </Form>
            </Card.Body>
          </Tab>
        </Tabs>
      </Card>

      {/* Action Modal */}
      <Modal show={showActionModal} onHide={() => setShowActionModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {actionType === 'status' && (user.status === 'active' ? 'Freeze Account' : 'Activate Account')}
            {actionType === 'reset' && 'Reset Password'}
            {actionType === 'reset-pin' && 'Reset PIN'}
            {actionType === 'notification' && 'Send Notification'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {actionType === 'status' && (
            <p>Are you sure you want to {user.status === 'active' ? 'freeze' : 'activate'} this user's account?</p>
          )}
          {actionType === 'reset' && (
            <p>A password reset link will be sent to the user's email address.</p>
          )}
          {actionType === 'reset-pin' && (
            <p>This clears the user's login PIN. They'll be required to set a new PIN via Forgot PIN before they can login again.</p>
          )}
          {actionType === 'notification' && (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Notification Type</Form.Label>
                <Form.Select>
                  <option>Payment Reminder</option>
                  <option>KYC Verification</option>
                  <option>Loan Update</option>
                  <option>General Notice</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Message</Form.Label>
                <Form.Control as="textarea" rows={3} placeholder="Enter notification message..." />
              </Form.Group>
            </>
          )}
          <Form.Group className="mb-3">
            <Form.Label>Internal Note (Optional)</Form.Label>
            <Form.Control 
              as="textarea" 
              rows={2} 
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="Add a note for this action..." 
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowActionModal(false)}>Cancel</Button>
          {actionType === 'status' && (
            <Button variant={user.status === 'active' ? 'danger' : 'success'} onClick={handleStatusToggle}>
              Confirm
            </Button>
          )}
          {actionType === 'reset' && (
            <Button variant="primary" onClick={handleResetPassword}>
              Send Reset Link
            </Button>
          )}
          {actionType === 'reset-pin' && (
            <Button variant="warning" onClick={handleResetPin}>
              Reset PIN
            </Button>
          )}
          {actionType === 'notification' && (
            <Button variant="primary">
              Send Notification
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default UserDetail;

