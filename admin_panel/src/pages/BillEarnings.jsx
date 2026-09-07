import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Form, Row, Col, Badge, Modal } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const BillEarnings = () => {
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [operatorFilter, setOperatorFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  
  // Stats
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalAmount: 0,
    totalConvenienceFee: 0,
    totalNetProfit: 0,
    successRate: 0
  });

  // Modal
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchBillEarnings();
  }, [filter, operatorFilter, dateRange, page, limit]);

  const fetchBillEarnings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let queryParams = `?page=${page}&limit=${limit}`;
      if (filter !== 'ALL') queryParams += `&status=${filter}`;
      if (operatorFilter !== 'ALL') queryParams += `&operator=${operatorFilter}`;
      if (dateRange.start) queryParams += `&dateFrom=${dateRange.start}`;
      if (dateRange.end) queryParams += `&dateTo=${dateRange.end}`;
      
      const res = await api.get(`/admin/earnings/bills${queryParams}`);
      
      const data = res.data?.data;
      const earningsData = data?.items || data || [];
      
      setEarnings(earningsData);
      
      // Calculate stats
      const totalTransactions = earningsData.length;
      const totalAmount = earningsData.reduce((sum, item) => sum + (item.amount || 0), 0);
      const totalConvenienceFee = earningsData.reduce((sum, item) => sum + (item.convenienceFee || 0), 0);
      const totalNetProfit = earningsData.reduce((sum, item) => sum + (item.netProfit || 0), 0);
      const successfulTransactions = earningsData.filter(item => item.status === 'CONFIRMED' || item.status === 'success').length;
      const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;
      
      setStats({
        totalTransactions,
        totalAmount,
        totalConvenienceFee,
        totalNetProfit,
        successRate
      });
    } catch (error) {
      console.error('Error fetching bill earnings:', error);
      setError(error.response?.data?.message || error.message);
      setEarnings([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '₹0';
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'CONFIRMED': { bg: 'success', text: 'Confirmed' },
      'PENDING': { bg: 'warning', text: 'Pending' },
      'FAILED': { bg: 'danger', text: 'Failed' },
      'success': { bg: 'success', text: 'Success' },
      'pending': { bg: 'warning', text: 'Pending' },
      'failed': { bg: 'danger', text: 'Failed' }
    };
    const statusInfo = statusMap[status] || { bg: 'secondary', text: status || 'N/A' };
    return <Badge bg={statusInfo.bg}>{statusInfo.text}</Badge>;
  };

  const getOperatorBadge = (operator) => {
    const operatorMap = {
      'electricity': { bg: 'warning', text: 'Electricity' },
      'water': { bg: 'info', text: 'Water' },
      'gas': { bg: 'danger', text: 'Gas' },
      'mobile': { bg: 'primary', text: 'Mobile' },
      'dth': { bg: 'purple', text: 'DTH' },
      'insurance': { bg: 'success', text: 'Insurance' },
      'broadband': { bg: 'dark', text: 'Broadband' }
    };
    const operatorInfo = operatorMap[operator?.toLowerCase()] || { bg: 'secondary', text: operator || 'N/A' };
    return <Badge bg={operatorInfo.bg}>{operatorInfo.text}</Badge>;
  };

  const viewTransactionDetail = (transaction) => {
    setSelectedTransaction(transaction);
    setShowDetailModal(true);
  };

  // Filter earnings based on search
  const filteredEarnings = earnings.filter(item => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.user?.name?.toLowerCase().includes(search) ||
      item.user?.phone?.includes(search) ||
      item.operator?.toLowerCase().includes(search) ||
      item.txnId?.includes(search)
    );
  });

  const totalPages = Math.ceil(filteredEarnings.length / limit);

  if (loading) {
    return (
      <div className="container-fluid p-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading bill earnings...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Bill Payments Earnings</h2>
        <Button variant="outline-primary" onClick={fetchBillEarnings}>
          ↻ Refresh
        </Button>
      </div>

      {error && (
        <div className="alert alert-warning mb-4">
          <strong>Warning:</strong> {error}
          <Button variant="link" size="sm" onClick={fetchBillEarnings}>Retry</Button>
        </div>
      )}

      {/* Stats Cards */}
      <Row className="mb-4">
        <Col md={2}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title className="small text-muted">Total Transactions</Card.Title>
              <h4>{stats.totalTransactions}</h4>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-primary">
            <Card.Body>
              <Card.Title className="small text-primary">Total Amount</Card.Title>
              <h4 className="text-primary">{formatCurrency(stats.totalAmount)}</h4>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-success">
            <Card.Body>
              <Card.Title className="small text-success">Convenience Fee</Card.Title>
              <h4 className="text-success">{formatCurrency(stats.totalConvenienceFee)}</h4>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className="text-center border-info">
            <Card.Body>
              <Card.Title className="small text-info">Net Profit</Card.Title>
              <h4 className="text-info">{formatCurrency(stats.totalNetProfit)}</h4>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className="text-center border-warning">
            <Card.Body>
              <Card.Title className="small text-warning">Success Rate</Card.Title>
              <h4 className="text-warning">{stats.successRate.toFixed(1)}%</h4>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={2}>
              <Form.Select 
                value={filter} 
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Status</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Select 
                value={operatorFilter} 
                onChange={(e) => {
                  setOperatorFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Operators</option>
                <option value="electricity">Electricity</option>
                <option value="water">Water</option>
                <option value="gas">Gas</option>
                <option value="mobile">Mobile</option>
                <option value="dth">DTH</option>
                <option value="insurance">Insurance</option>
                <option value="broadband">Broadband</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Control
                type="date"
                placeholder="Start Date"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
            </Col>
            <Col md={2}>
              <Form.Control
                type="date"
                placeholder="End Date"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              />
            </Col>
            <Col md={2}>
              <Form.Select 
                value={limit} 
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Control
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Earnings Table */}
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Bill Payment Transactions</h5>
          <Button variant="success" size="sm">
            Export Report
          </Button>
        </Card.Header>
        <Card.Body className="p-0">
          <Table responsive striped hover className="mb-0">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>User</th>
                <th>Operator</th>
                <th>Bill Amount</th>
                <th>Convenience Fee</th>
                <th>Net Profit</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEarnings.length > 0 ? (
                filteredEarnings.slice((page - 1) * limit, page * limit).map((item) => (
                  <tr key={item.txnId || item._id}>
                    <td>
                      <small className="text-muted">{item.txnId?.slice(-8) || item._id?.slice(-8)}</small>
                    </td>
                    <td>
                      <div>{item.user?.name || 'N/A'}</div>
                      <small className="text-muted">{item.user?.phone || item.user?.mobile || ''}</small>
                    </td>
                    <td>{getOperatorBadge(item.operator)}</td>
                    <td>{formatCurrency(item.amount)}</td>
                    <td>{formatCurrency(item.convenienceFee)}</td>
                    <td>
                      <strong className="text-success">{formatCurrency(item.netProfit)}</strong>
                    </td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td>
                      <small>{formatDate(item.date)}</small>
                    </td>
                    <td>
                      <Button 
                        variant="info" 
                        size="sm"
                        onClick={() => viewTransactionDetail(item)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="text-center py-4">
                    <em className="text-muted">No bill earnings data found</em>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center p-3 border-top">
              <div className="text-muted">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, filteredEarnings.length)} of {filteredEarnings.length}
              </div>
              <div className="d-flex gap-2">
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  disabled={page === 1} 
                  onClick={() => setPage(page - 1)}
                >
                  ← Previous
                </Button>
                <span className="align-self-center mx-2">
                  Page {page} of {totalPages}
                </span>
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  disabled={page === totalPages} 
                  onClick={() => setPage(page + 1)}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Transaction Detail Modal */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Transaction Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTransaction && (
            <div>
              <Row className="mb-3">
                <Col md={6}>
                  <strong>Transaction ID:</strong>
                  <p className="text-muted">{selectedTransaction.txnId || selectedTransaction._id}</p>
                </Col>
                <Col md={6}>
                  <strong>Status:</strong>
                  <p>{getStatusBadge(selectedTransaction.status)}</p>
                </Col>
              </Row>
              <Row className="mb-3">
                <Col md={6}>
                  <strong>User:</strong>
                  <p className="text-muted">
                    {selectedTransaction.user?.name || 'N/A'}
                    <br/>
                    <small>{selectedTransaction.user?.phone || selectedTransaction.user?.mobile || ''}</small>
                    <br/>
                    <small>{selectedTransaction.user?.email || ''}</small>
                  </p>
                </Col>
                <Col md={6}>
                  <strong>Operator:</strong>
                  <p>{getOperatorBadge(selectedTransaction.operator)}</p>
                </Col>
              </Row>
              <Row className="mb-3">
                <Col md={4}>
                  <strong>Bill Amount:</strong>
                  <p className="h5">{formatCurrency(selectedTransaction.amount)}</p>
                </Col>
                <Col md={4}>
                  <strong>Convenience Fee:</strong>
                  <p className="h5 text-primary">{formatCurrency(selectedTransaction.convenienceFee)}</p>
                </Col>
                <Col md={4}>
                  <strong>Net Profit:</strong>
                  <p className="h5 text-success">{formatCurrency(selectedTransaction.netProfit)}</p>
                </Col>
              </Row>
              <Row className="mb-3">
                <Col md={6}>
                  <strong>Created At:</strong>
                  <p className="text-muted">{formatDate(selectedTransaction.date)}</p>
                </Col>
                <Col md={6}>
                  <strong>Bill ID:</strong>
                  <p className="text-muted">{selectedTransaction.billId || 'N/A'}</p>
                </Col>
              </Row>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={() => setShowDetailModal(false)}>
            Download Receipt
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default BillEarnings;

